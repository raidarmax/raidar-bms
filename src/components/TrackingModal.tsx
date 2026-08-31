import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Navigation, Clock, Bike, Radio, History, MapPinned, Play, Pause, WifiOff, Satellite, AlertCircle, Gauge, TrendingUp, Route as RouteIcon, Timer, Calendar, Compass, RefreshCw, ChevronRight, Zap, TrendingDown } from 'lucide-react';
import { supabase, type Motorcycle } from '../lib/supabase';
import { loadGoogleMaps, createMotorcycleIcon } from '../lib/googleMaps';
import BikeDetailsModal from './BikeDetailsModal';
import { fetchTrackerStatus, statusLabel, statusTone, formatRelativeTime, bearingDegrees, type TrackerStatus } from '../lib/trackerStatus';

type TrackingData = {
  id: string;
  motorcycle_id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recorded_at: string;
};

type GeofenceResult = {
  tracking_id: string;
  motorcycle_id: string;
  registration_number: string;
  owner_name: string;
  rider_name: string | null;
  latitude: number;
  longitude: number;
  recorded_at: string;
  distance: number;
};

type TrackingModalProps = {
  motorcycle: Motorcycle;
  onClose: () => void;
  fullPage?: boolean;
};

type ActiveTrip = {
  id: string;
  started_at: string;
  ended_at: string | null;
  distance_meters: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  point_count: number;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  status: string;
};

type TabType = 'live' | 'history' | 'geofence' | 'trips';

const nairobiCBD = { lat: -1.286389, lng: 36.817223 };
const kawangware = { lat: -1.282, lng: 36.735 };
const yayaCentre = { lat: -1.2823, lng: 36.8172 };

function describeWindow(minutes: number): string {
  if (minutes >= 1440) return 'whole day';
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'}`;
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

type RouteStats = {
  distanceKm: number;
  durationSeconds: number;
  movingSeconds: number;
  maxSpeed: number;
  avgSpeed: number;
  points: number;
  firstTime: string;
  lastTime: string;
};

function computeRouteStats(points: { latitude: number; longitude: number; speed: number | null; recorded_at: string }[]): RouteStats | null {
  if (points.length === 0) return null;
  const MIN_MOTION_M = 3;
  const MAX_TELEPORT_M = 2000;
  const MAX_GAP_S = 600;

  let totalDistance = 0;
  let movingSeconds = 0;
  let maxSpeed = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const segment = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    const dt = (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
    if (dt <= 0 || dt > MAX_GAP_S) continue;
    if (segment < MIN_MOTION_M || segment > MAX_TELEPORT_M) continue;

    totalDistance += segment;
    movingSeconds += dt;

    const derivedKmh = (segment / dt) * 3.6;
    const reportedKmh = Math.max(prev.speed ?? 0, curr.speed ?? 0);
    const segSpeed = Math.max(derivedKmh, reportedKmh);
    if (segSpeed > maxSpeed) maxSpeed = segSpeed;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const totalSeconds = (new Date(last.recorded_at).getTime() - new Date(first.recorded_at).getTime()) / 1000;
  const avgSpeed = movingSeconds > 0 ? (totalDistance / movingSeconds) * 3.6 : 0;

  return {
    distanceKm: totalDistance / 1000,
    durationSeconds: totalSeconds,
    movingSeconds,
    maxSpeed,
    avgSpeed,
    points: points.length,
    firstTime: first.recorded_at,
    lastTime: last.recorded_at,
  };
}

const LIVE_POLL_INTERVAL_MS = 5000;

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const MOVING_SPEED_THRESHOLD_KMH = 5;
const MOVING_DISTANCE_THRESHOLD_M = 25;
const ROUTE_MIN_STEP_M = 8;

function buildCleanRoutePath(points: { latitude: number; longitude: number; speed: number | null }[]): { lat: number; lng: number }[] {
  if (points.length === 0) return [];
  const cleaned: { lat: number; lng: number }[] = [];
  let last: { latitude: number; longitude: number } | null = null;
  for (const p of points) {
    if (!last) {
      cleaned.push({ lat: p.latitude, lng: p.longitude });
      last = { latitude: p.latitude, longitude: p.longitude };
      continue;
    }
    const distance = calculateDistance(last.latitude, last.longitude, p.latitude, p.longitude);
    if (distance >= ROUTE_MIN_STEP_M) {
      cleaned.push({ lat: p.latitude, lng: p.longitude });
      last = { latitude: p.latitude, longitude: p.longitude };
    }
  }
  return cleaned.length >= 2 ? cleaned : [];
}

// ── Google Maps wrapper ────────────────────────────────────────────────────────────────────────────────────

type GoogleMapHandle = {
  map: any;
  google: any;
};

function waitForSize(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}

function useGoogleMap(
  containerRef: React.RefObject<HTMLDivElement>,
  center: { lat: number; lng: number } | null,
  zoom: number,
  deps: any[],
) {
  const [handle, setHandle] = useState<GoogleMapHandle | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;

    const initialCenter = center ?? nairobiCBD;
    (async () => {
      try {
        const google = await loadGoogleMaps();
        if (cancelled) return;
        await waitForSize(container);
        if (cancelled) return;

        const map = new google.maps.Map(container, {
          center: { lat: initialCenter.lat, lng: initialCenter.lng },
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
          backgroundColor: '#e5e7eb',
          clickableIcons: false,
          styles: [
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
            { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'simplified' }, { lightness: 20 }] },
            { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#cbd5e1' }] },
            { featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'on' }] },
            { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
            { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d1fae5' }] },
            { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'on' }] },
            { featureType: 'poi.government', stylers: [{ visibility: 'on' }] },
            { featureType: 'poi.medical', stylers: [{ visibility: 'on' }] },
            { featureType: 'poi.school', stylers: [{ visibility: 'on' }] },
            { featureType: 'poi.sports_complex', stylers: [{ visibility: 'on' }] },
            { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'on' }] },
            { featureType: 'poi.business', stylers: [{ visibility: 'simplified' }] },
            { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
            { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'on' }] },
            { featureType: 'landscape', elementType: 'labels', stylers: [{ visibility: 'on' }] },
            { featureType: 'landscape.man_made', stylers: [{ visibility: 'on' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfdbfe' }] },
            { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'on' }] },
          ],
        });

        google.maps.event.addListenerOnce(map, 'idle', () => {
          google.maps.event.trigger(map, 'resize');
          map.setCenter({ lat: initialCenter.lat, lng: initialCenter.lng });
        });

        setHandle({ map, google });
      } catch (err) {
        console.error('[TrackingModal] Google Maps failed to load:', err);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!handle || !containerRef.current) return;
    const obs = new ResizeObserver(() => {
      handle.google.maps.event.trigger(handle.map, 'resize');
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [handle, containerRef]);

  return handle;
}

export default function TrackingModal({ motorcycle, onClose, fullPage = false }: TrackingModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('live');
  const [currentLocation, setCurrentLocation] = useState<TrackingData | null>(null);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [todayTripsCount, setTodayTripsCount] = useState(0);
  const [todayTotalDistance, setTodayTotalDistance] = useState(0);

  const todayIso = new Date().toISOString().slice(0, 10);
  const nowHhmm = new Date().toTimeString().slice(0, 5);

  const [historyDate, setHistoryDate] = useState(todayIso);
  const [historyTime, setHistoryTime] = useState(nowHhmm);
  const [historyWindowMinutes, setHistoryWindowMinutes] = useState(30);
  const [historicalPoint, setHistoricalPoint] = useState<TrackingData | null>(null);
  const [routeData, setRouteData] = useState<TrackingData[]>([]);
  const [showRoute, setShowRoute] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEmptyMessage, setHistoryEmptyMessage] = useState<string | null>(null);
  const [routePlayback, setRoutePlayback] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const [geofenceLocation, setGeofenceLocation] = useState('Nairobi CBD');
  const [geofenceRadius, setGeofenceRadius] = useState(500);
  const [geofenceDate, setGeofenceDate] = useState(todayIso);
  const [geofenceTime, setGeofenceTime] = useState(nowHhmm);
  const [geofenceResults, setGeofenceResults] = useState<GeofenceResult[]>([]);
  const [geofenceViewportBikes, setGeofenceViewportBikes] = useState<GeofenceResult[]>([]);
  const [geofenceTimeWindow, setGeofenceTimeWindow] = useState<{ start: string; end: string } | null>(null);
  const [geofenceCenter, setGeofenceCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [geofenceLocationError, setGeofenceLocationError] = useState<string | null>(null);
  const [geofenceLoading, setGeofenceLoading] = useState(false);
  const [selectedBikeForDetails, setSelectedBikeForDetails] = useState<GeofenceResult | null>(null);

  // Trips tab state
  const [tripsList, setTripsList] = useState<ActiveTrip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<ActiveTrip | null>(null);
  const [tripRoutePoints, setTripRoutePoints] = useState<TrackingData[]>([]);
  const [tripRouteLoading, setTripRouteLoading] = useState(false);

  // Map refs
  const liveMapRef = useRef<HTMLDivElement>(null);
  const historyMapRef = useRef<HTMLDivElement>(null);
  const geofenceMapRef = useRef<HTMLDivElement>(null);
  const tripMapRef = useRef<HTMLDivElement>(null);
  const liveMarkerRef = useRef<any>(null);
  const liveInfoWindowRef = useRef<any>(null);
  const liveAnimRef = useRef<number | null>(null);
  const liveHeadingRef = useRef<number>(0);
  const historyMarkerRef = useRef<any>(null);
  const historyPolylineRef = useRef<any>(null);
  const historyAnimRef = useRef<number | null>(null);
  const playbackRafRef = useRef<number | null>(null);
  const playbackIndexRef = useRef(0);

  useEffect(() => {
    playbackIndexRef.current = playbackIndex;
  }, [playbackIndex]);

  const liveMap = useGoogleMap(
    liveMapRef,
    currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null,
    17,
    [motorcycle.id, activeTab],
  );

  const historyMap = useGoogleMap(
    historyMapRef,
    historicalPoint ? { lat: historicalPoint.latitude, lng: historicalPoint.longitude } : null,
    14,
    [historicalPoint?.id, activeTab],
  );

  const geofenceMap = useGoogleMap(
    geofenceMapRef,
    { lat: yayaCentre.lat, lng: yayaCentre.lng },
    15,
    [activeTab],
  );

  const tripMap = useGoogleMap(
    tripMapRef,
    selectedTrip ? { lat: selectedTrip.start_lat, lng: selectedTrip.start_lng } : null,
    13,
    [selectedTrip?.id, activeTab],
  );

  // Load trips when tab is opened
  useEffect(() => {
    if (activeTab !== 'trips') return;
    const loadTrips = async () => {
      setTripsLoading(true);
      const { data, error } = await supabase
        .from('motorcycle_trips')
        .select('*')
        .eq('motorcycle_id', motorcycle.id)
        .order('started_at', { ascending: false })
        .limit(50);
      if (!error && data) setTripsList(data as ActiveTrip[]);
      setTripsLoading(false);
    };
    loadTrips();
  }, [activeTab, motorcycle.id]);

  // Draw trip route on map when a trip is selected
  const tripPolyRef = useRef<any>(null);
  const tripMarkersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!tripMap || !selectedTrip || tripRoutePoints.length < 2) return;
    const { map, google } = tripMap;

    // Clear previous
    if (tripPolyRef.current) tripPolyRef.current.setMap(null);
    tripMarkersRef.current.forEach(m => m.setMap(null));
    tripMarkersRef.current = [];

    const path = tripRoutePoints.map(p => ({ lat: p.latitude, lng: p.longitude }));
    const poly = new google.maps.Polyline({
      path,
      strokeColor: '#10b981',
      strokeOpacity: 0.9,
      strokeWeight: 4,
      geodesic: true,
    });
    poly.setMap(map);
    tripPolyRef.current = poly;

    // Start marker
    const startMarker = new google.maps.Marker({
      position: path[0],
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
        scale: 8,
      },
      title: 'Trip Start',
    });
    tripMarkersRef.current.push(startMarker);

    // End marker
    const endMarker = new google.maps.Marker({
      position: path[path.length - 1],
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
        scale: 8,
      },
      title: 'Trip End',
    });
    tripMarkersRef.current.push(endMarker);

    // Fit bounds
    const bounds = new google.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    map.fitBounds(bounds, 40);

    return () => {
      if (tripPolyRef.current) { tripPolyRef.current.setMap(null); tripPolyRef.current = null; }
      tripMarkersRef.current.forEach(m => m.setMap(null));
      tripMarkersRef.current = [];
    };
  }, [tripMap, selectedTrip, tripRoutePoints]);

  const loadTripRoute = async (trip: ActiveTrip) => {
    setSelectedTrip(trip);
    setTripRouteLoading(true);
    const { data, error } = await supabase
      .from('tracking_data')
      .select('*')
      .eq('motorcycle_id', trip.motorcycle_id)
      .gte('recorded_at', trip.started_at)
      .lte('recorded_at', trip.ended_at || new Date().toISOString())
      .order('recorded_at', { ascending: true })
      .limit(2000);
    if (!error && data) setTripRoutePoints(data as TrackingData[]);
    setTripRouteLoading(false);
  };

  useEffect(() => {
    if (!liveMap || !currentLocation) return;
    const { map, google } = liveMap;

    const isLive =
      trackerStatus?.kind === 'live_moving' || trackerStatus?.kind === 'live_stationary';
    const markerColor = isLive ? '#10b981' : '#64748b';
    const stationary = !currentLocation.speed || currentLocation.speed < 3;

    const heading = currentLocation.heading ?? liveHeadingRef.current;
    if (currentLocation.heading != null) liveHeadingRef.current = currentLocation.heading;
    const icon = createMotorcycleIcon(google, 30, markerColor, heading);

    const newPos = { lat: currentLocation.latitude, lng: currentLocation.longitude };

    if (!liveMarkerRef.current) {
      liveMarkerRef.current = new google.maps.Marker({
        position: newPos,
        map,
        icon,
        title: motorcycle.registration_number,
        optimized: false,
      });
      liveInfoWindowRef.current = new google.maps.InfoWindow();
      liveMarkerRef.current.addListener('mouseover', () =>
        liveInfoWindowRef.current.open(map, liveMarkerRef.current));
      liveMarkerRef.current.addListener('mouseout', () =>
        liveInfoWindowRef.current.close());
      map.panTo(newPos);
    } else {
      liveMarkerRef.current.setIcon(icon);
      const oldPos = liveMarkerRef.current.getPosition();
      const startLat = oldPos?.lat() ?? newPos.lat;
      const startLng = oldPos?.lng() ?? newPos.lng;
      const dLat = newPos.lat - startLat;
      const dLng = newPos.lng - startLng;
      if (Math.abs(dLat) > 0.000001 || Math.abs(dLng) > 0.000001) {
        if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);
        const duration = 1200;
        const startTime = performance.now();
        const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        const animate = (now: number) => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / duration, 1);
          const et = ease(t);
          const pos = { lat: startLat + dLat * et, lng: startLng + dLng * et };
          liveMarkerRef.current?.setPosition(pos);
          map.panTo(pos);
          if (t < 1) liveAnimRef.current = requestAnimationFrame(animate);
        };
        liveAnimRef.current = requestAnimationFrame(animate);
      }
    }

    const speedLine = stationary
      ? '<span style="color:#64748b">Stationary</span>'
      : `${currentLocation.speed!.toFixed(1)} km/h`;
    const statusLine = trackerStatus ? statusLabel(trackerStatus) : 'Unknown';
    const headingLine = stationary || currentLocation.heading == null
      ? '—'
      : `${Math.round(currentLocation.heading)}°`;
    liveInfoWindowRef.current?.setContent(`
      <div style="min-width:200px;padding:6px 4px;font-family:system-ui,sans-serif">
        <div style="font-weight:700;font-size:14px;color:#0f172a">${motorcycle.registration_number}</div>
        <div style="font-size:12px;color:#475569;margin-top:2px">${statusLine}</div>
        <div style="height:1px;background:#e2e8f0;margin:6px 0"></div>
        <div style="font-size:12px;color:#334155">Speed: ${speedLine}</div>
        <div style="font-size:12px;color:#334155">Heading: ${headingLine}</div>
        <div style="font-size:12px;color:#334155;margin-top:4px">Last seen:</div>
        <div style="font-size:12px;color:#0f172a;font-weight:600">${new Date(currentLocation.recorded_at).toLocaleString()}</div>
      </div>
    `);

    return () => {
      if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);
    };
  }, [liveMap, currentLocation, trackerStatus, motorcycle.registration_number]);

  useEffect(() => {
    return () => {
      if (liveMarkerRef.current) { liveMarkerRef.current.setMap(null); liveMarkerRef.current = null; }
      if (liveInfoWindowRef.current) { liveInfoWindowRef.current.close(); liveInfoWindowRef.current = null; }
      if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);
      liveHeadingRef.current = 0;
    };
  }, []);

  useEffect(() => {
    if (!historyMap || !historicalPoint) return;
    const { map, google } = historyMap;

    if (historyPolylineRef.current) {
      historyPolylineRef.current.setMap(null);
      historyPolylineRef.current = null;
    }

    const cleanPath = buildCleanRoutePath(routeData);
    const hasRoute = showRoute && cleanPath.length >= 2;

    if (hasRoute) {
      historyPolylineRef.current = new google.maps.Polyline({
        path: cleanPath, map, strokeColor: '#3b82f6', strokeWeight: 4, strokeOpacity: 0.75,
      });
    }

    return () => {
      if (historyPolylineRef.current) {
        historyPolylineRef.current.setMap(null);
        historyPolylineRef.current = null;
      }
    };
  }, [historyMap, historicalPoint, routeData, showRoute]);

  useEffect(() => {
    if (!historyMap || !historicalPoint) return;
    const { map, google } = historyMap;

    const currentPoint = routeData.length > 0
      ? (routeData[playbackIndex] || historicalPoint)
      : historicalPoint;
    const targetPos = { lat: currentPoint.latitude, lng: currentPoint.longitude };

    const histHeading = (() => {
      if (routeData.length > 1 && playbackIndex > 0) {
        const prev = routeData[playbackIndex - 1];
        const curr = routeData[playbackIndex];
        return bearingDegrees(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      }
      return currentPoint.heading ?? 0;
    })();

    if (!historyMarkerRef.current || historyMarkerRef.current.getMap() !== map) {
      if (historyMarkerRef.current) {
        historyMarkerRef.current.setMap(null);
        historyMarkerRef.current = null;
      }
      const icon = createMotorcycleIcon(google, 30, '#dc2626', histHeading);
      const marker = new google.maps.Marker({
        position: targetPos,
        map,
        icon,
        title: motorcycle.registration_number,
        zIndex: 9999,
        optimized: false,
      });
      historyMarkerRef.current = marker;
      map.setCenter(targetPos);
      if (map.getZoom() == null || (map.getZoom() ?? 0) < 17) {
        map.setZoom(18);
      }
      return;
    }

    historyMarkerRef.current.setIcon(createMotorcycleIcon(google, 30, '#dc2626', histHeading));

    if (routePlayback) return;

    const marker = historyMarkerRef.current;
    const startPosLatLng = marker.getPosition();
    const startLat = startPosLatLng ? startPosLatLng.lat() : targetPos.lat;
    const startLng = startPosLatLng ? startPosLatLng.lng() : targetPos.lng;

    if (historyAnimRef.current != null) {
      cancelAnimationFrame(historyAnimRef.current);
      historyAnimRef.current = null;
    }

    const durationMs = 300;
    const startedAt = performance.now();
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const step = (now: number) => {
      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / durationMs);
      const k = easeInOut(t);
      const lat = startLat + (targetPos.lat - startLat) * k;
      const lng = startLng + (targetPos.lng - startLng) * k;
      marker.setPosition({ lat, lng });
      map.panTo({ lat, lng });
      if (t < 1) {
        historyAnimRef.current = requestAnimationFrame(step);
      } else {
        historyAnimRef.current = null;
      }
    };
    historyAnimRef.current = requestAnimationFrame(step);
  }, [historyMap, historicalPoint, routeData, playbackIndex, routePlayback, motorcycle.registration_number]);

  useEffect(() => {
    if (!routePlayback) return;
    if (!historyMap || routeData.length < 2) return;
    if (!historyMarkerRef.current) return;

    const { map, google } = historyMap;
    const marker = historyMarkerRef.current;

    if (historyAnimRef.current != null) {
      cancelAnimationFrame(historyAnimRef.current);
      historyAnimRef.current = null;
    }

    const segmentMs = Math.max(120, 900 / playbackSpeed);
    const baseIndex = Math.max(0, Math.min(routeData.length - 1, playbackIndexRef.current));
    if (baseIndex >= routeData.length - 1) {
      setRoutePlayback(false);
      return;
    }

    const startedAt = performance.now();
    let reportedIdx = baseIndex;
    let raf = 0;

    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const step = (now: number) => {
      const elapsed = now - startedAt;
      const totalSegs = elapsed / segmentMs;
      const segAdvance = Math.floor(totalSegs);
      const frac = totalSegs - segAdvance;
      const idx = baseIndex + segAdvance;

      if (idx >= routeData.length - 1) {
        const last = routeData[routeData.length - 1];
        const prev = routeData[routeData.length - 2];
        marker.setPosition({ lat: last.latitude, lng: last.longitude });
        map.panTo({ lat: last.latitude, lng: last.longitude });
        marker.setIcon(createMotorcycleIcon(google, 30, '#dc2626', bearingDegrees(prev.latitude, prev.longitude, last.latitude, last.longitude)));
        playbackIndexRef.current = routeData.length - 1;
        setPlaybackIndex(routeData.length - 1);
        setRoutePlayback(false);
        playbackRafRef.current = null;
        return;
      }

      const p0 = routeData[idx];
      const p1 = routeData[idx + 1];
      const k = easeInOut(frac);
      const lat = p0.latitude + (p1.latitude - p0.latitude) * k;
      const lng = p0.longitude + (p1.longitude - p0.longitude) * k;
      marker.setPosition({ lat, lng });
      map.panTo({ lat, lng });

      const segBearing = bearingDegrees(p0.latitude, p0.longitude, p1.latitude, p1.longitude);
      marker.setIcon(createMotorcycleIcon(google, 30, '#dc2626', segBearing));

      if (idx !== reportedIdx) {
        reportedIdx = idx;
        playbackIndexRef.current = idx;
        setPlaybackIndex(idx);
      }

      raf = requestAnimationFrame(step);
      playbackRafRef.current = raf;
    };

    raf = requestAnimationFrame(step);
    playbackRafRef.current = raf;

    return () => {
      if (playbackRafRef.current != null) {
        cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
    };
  }, [routePlayback, playbackSpeed, historyMap, routeData]);

  useEffect(() => {
    return () => {
      if (historyAnimRef.current != null) {
        cancelAnimationFrame(historyAnimRef.current);
        historyAnimRef.current = null;
      }
      if (historyMarkerRef.current) {
        historyMarkerRef.current.setMap(null);
        historyMarkerRef.current = null;
      }
      if (historyPolylineRef.current) {
        historyPolylineRef.current.setMap(null);
        historyPolylineRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!geofenceMap) return;
    const { map, google } = geofenceMap;

    const center = geofenceCenter ?? yayaCentre;
    const centerLat = center.lat;
    const centerLng = center.lng;

    const circle = new google.maps.Circle({
      map, center: { lat: centerLat, lng: centerLng }, radius: geofenceRadius,
      strokeColor: '#dc2626', strokeWeight: 2, fillColor: '#dc2626', fillOpacity: 0.15,
    });

    map.setCenter({ lat: centerLat, lng: centerLng });
    const circleBounds = circle.getBounds();
    if (circleBounds) map.fitBounds(circleBounds, 40);

    return () => { circle.setMap(null); };
  }, [geofenceMap, geofenceRadius, geofenceCenter]);

  useEffect(() => {
    if (!geofenceMap) return;
    const { map, google } = geofenceMap;
    const objects: any[] = [];

    const insideIcon = createMotorcycleIcon(google, 32, '#dc2626');
    const outsideIcon = createMotorcycleIcon(google, 32, '#0ea5e9');
    const insideIds = new Set(geofenceResults.map(r => r.motorcycle_id));

    geofenceResults.forEach(result => {
      const marker = new google.maps.Marker({
        position: { lat: result.latitude, lng: result.longitude },
        map, icon: insideIcon, title: result.registration_number,
        zIndex: 9999, optimized: false,
      });
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="text-align:center;padding:4px"><strong>${result.registration_number}</strong><br/>Owner: ${result.owner_name}<br/>Distance: ${result.distance}m<br/>${new Date(result.recorded_at).toLocaleString()}</div>`,
      });
      marker.addListener('mouseover', () => infoWindow.open(map, marker));
      marker.addListener('mouseout', () => infoWindow.close());
      objects.push(marker);
      objects.push(infoWindow);
    });

    geofenceViewportBikes.forEach(bike => {
      if (insideIds.has(bike.motorcycle_id)) return;
      const marker = new google.maps.Marker({
        position: { lat: bike.latitude, lng: bike.longitude },
        map, icon: outsideIcon, title: bike.registration_number,
        zIndex: 8000, optimized: false,
      });
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="text-align:center;padding:4px"><strong>${bike.registration_number}</strong><br/>Owner: ${bike.owner_name}<br/>Outside search radius<br/>${new Date(bike.recorded_at).toLocaleString()}</div>`,
      });
      marker.addListener('mouseover', () => infoWindow.open(map, marker));
      marker.addListener('mouseout', () => infoWindow.close());
      objects.push(marker);
      objects.push(infoWindow);
    });

    return () => { objects.forEach(o => o.setMap?.(null)); };
  }, [geofenceMap, geofenceResults, geofenceViewportBikes]);

  useEffect(() => {
    if (!geofenceMap || !geofenceTimeWindow) return;
    const { map, google } = geofenceMap;
    let debounceHandle: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const runViewportSearch = async () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      try {
        const bikes = await searchBikesInBounds(
          sw.lat(), ne.lat(), sw.lng(), ne.lng(),
          geofenceTimeWindow.start, geofenceTimeWindow.end,
        );
        if (!cancelled) setGeofenceViewportBikes(bikes);
      } catch (err) {
        console.error('Viewport search failed:', err);
      }
    };

    const listener = map.addListener('idle', () => {
      if (debounceHandle) clearTimeout(debounceHandle);
      debounceHandle = setTimeout(runViewportSearch, 350);
    });

    runViewportSearch();

    return () => {
      cancelled = true;
      if (debounceHandle) clearTimeout(debounceHandle);
      google.maps.event.removeListener(listener);
    };
  }, [geofenceMap, geofenceTimeWindow]);

  useEffect(() => {
    if (activeTab !== 'live') return;
    let cancelled = false;

    const refresh = async () => {
      const { status, latestFix } = await fetchTrackerStatus(
        motorcycle.id,
        motorcycle.tracking_device_id ?? null,
      );
      if (cancelled) return;
      setTrackerStatus(status);
      setCurrentLocation(latestFix as TrackingData | null);
      setLoading(false);

      // Fetch active trip
      const { data: tripData } = await supabase
        .from('motorcycle_trips')
        .select('*')
        .eq('motorcycle_id', motorcycle.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setActiveTrip(tripData);

      // Fetch today's trip stats
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: todayTrips } = await supabase
        .from('motorcycle_trips')
        .select('id, distance_meters')
        .eq('motorcycle_id', motorcycle.id)
        .gte('started_at', todayStart.toISOString());
      if (!cancelled && todayTrips) {
        setTodayTripsCount(todayTrips.length);
        setTodayTotalDistance(todayTrips.reduce((sum, t) => sum + (t.distance_meters || 0), 0));
      }
    };

    setLoading(true);
    refresh();
    const interval = setInterval(refresh, LIVE_POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [motorcycle.id, activeTab]);

  const searchHistoricalLocation = async () => {
    setHistoryLoading(true);
    setHistoryEmptyMessage(null);
    try {
      const searchDateTime = new Date(`${historyDate}T${historyTime}:00`);
      const halfWindowMs = (historyWindowMinutes * 60 * 1000) / 2;
      const dayStart = new Date(`${historyDate}T00:00:00`);
      const dayEnd = new Date(`${historyDate}T23:59:59.999`);
      const windowStart = new Date(Math.max(searchDateTime.getTime() - halfWindowMs, dayStart.getTime()));
      const windowEnd = new Date(Math.min(searchDateTime.getTime() + halfWindowMs, dayEnd.getTime()));

      // Real tracker readings only (demo_seed = false), inside the chosen window.
      const { data: windowPoints, error: windowError } = await supabase
        .from('tracking_data')
        .select('*')
        .eq('motorcycle_id', motorcycle.id)
        .eq('demo_seed', false)
        .gte('recorded_at', windowStart.toISOString())
        .lte('recorded_at', windowEnd.toISOString())
        .order('recorded_at', { ascending: true });

      if (windowError) throw windowError;

      if (!windowPoints || windowPoints.length === 0) {
        setHistoricalPoint(null);
        setRouteData([]);
        setPlaybackIndex(0);

        // Look up the nearest real reading outside the window so we can tell
        // the user when they DO have data.
        const { data: latestRow } = await supabase
          .from('tracking_data')
          .select('recorded_at')
          .eq('motorcycle_id', motorcycle.id)
          .eq('demo_seed', false)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const windowLabel = describeWindow(historyWindowMinutes);
        setHistoryEmptyMessage(
          latestRow
            ? `No tracker readings within the ${windowLabel} window on ${historyDate}. Latest actual reading: ${new Date(latestRow.recorded_at).toLocaleString()}.`
            : `This tracker has not produced any readings yet.`,
        );
        return;
      }

      const targetMs = searchDateTime.getTime();
      let closest = windowPoints[0];
      let bestDelta = Math.abs(new Date(closest.recorded_at).getTime() - targetMs);
      for (const p of windowPoints) {
        const delta = Math.abs(new Date(p.recorded_at).getTime() - targetMs);
        if (delta < bestDelta) {
          bestDelta = delta;
          closest = p;
        }
      }
      setHistoricalPoint(closest);
      setRouteData(windowPoints);
      const idx = windowPoints.findIndex(p => p.id === closest.id);
      setPlaybackIndex(idx >= 0 ? idx : 0);
    } catch (error) {
      console.error('Error searching historical location:', error);
      setHistoryEmptyMessage('Failed to load history: ' + (error as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const searchGeofence = async () => {
    setGeofenceLoading(true);
    setGeofenceLocationError(null);
    try {
      const google = await loadGoogleMaps();
      const geocoder = new google.maps.Geocoder();
      const query = geofenceLocation.trim();
      if (!query) {
        setGeofenceLocationError('Enter a place, address, or landmark to search.');
        setGeofenceLoading(false);
        return;
      }

      const geocoded = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        geocoder.geocode(
          { address: query, region: 'ke' },
          (results: any, status: string) => {
            if (status === 'OK' && results && results[0]) {
              const loc = results[0].geometry.location;
              resolve({ lat: loc.lat(), lng: loc.lng() });
            } else {
              resolve(null);
            }
          }
        );
      });

      if (!geocoded) {
        setGeofenceLocationError(`We couldn't find "${query}". Try a more specific name or address.`);
        setGeofenceLoading(false);
        return;
      }

      const centerLat = geocoded.lat;
      const centerLng = geocoded.lng;
      setGeofenceCenter({ lat: centerLat, lng: centerLng });

      const radiusInDegrees = geofenceRadius / 111320;
      const minLat = centerLat - radiusInDegrees;
      const maxLat = centerLat + radiusInDegrees;
      const minLng = centerLng - radiusInDegrees;
      const maxLng = centerLng + radiusInDegrees;

      const searchDateTime = new Date(`${geofenceDate}T${geofenceTime}:00Z`);
      const startTime = new Date(searchDateTime.getTime() - 5 * 60 * 1000);
      const endTime = new Date(searchDateTime.getTime() + 5 * 60 * 1000);
      setGeofenceTimeWindow({ start: startTime.toISOString(), end: endTime.toISOString() });

      const { data: trackingData, error: trackingError } = await supabase
        .from('tracking_data')
        .select(`
          id,
          motorcycle_id,
          latitude,
          longitude,
          recorded_at,
          motorcycles!inner(
            id,
            registration_number,
            owners!inner(
              full_name
            ),
            riders(
              name
            )
          )
        `)
        .gte('latitude', minLat)
        .lte('latitude', maxLat)
        .gte('longitude', minLng)
        .lte('longitude', maxLng)
        .gte('recorded_at', startTime.toISOString())
        .lte('recorded_at', endTime.toISOString());

      if (trackingError) throw trackingError;

      const results: GeofenceResult[] = [];
      const seenMotorcycles = new Set<string>();

      if (trackingData) {
        for (const record of trackingData) {
          if (seenMotorcycles.has(record.motorcycle_id)) continue;

          const distance = calculateDistance(
            centerLat,
            centerLng,
            record.latitude,
            record.longitude
          );

          if (distance <= geofenceRadius) {
            const motorcycleData = (record as any).motorcycles;
            const ownerData = motorcycleData?.owners;
            const riderData = motorcycleData?.riders?.[0];

            results.push({
              tracking_id: record.id,
              motorcycle_id: record.motorcycle_id,
              registration_number: motorcycleData?.registration_number || 'Unknown',
              owner_name: ownerData?.full_name || 'Unknown',
              rider_name: riderData?.name || null,
              latitude: record.latitude,
              longitude: record.longitude,
              recorded_at: record.recorded_at,
              distance: Math.round(distance),
            });

            seenMotorcycles.add(record.motorcycle_id);
          }
        }
      }

      setGeofenceResults(results);
    } catch (error) {
      console.error('Error searching geofence:', error);
    } finally {
      setGeofenceLoading(false);
    }
  };

  const searchBikesInBounds = async (
    minLat: number, maxLat: number, minLng: number, maxLng: number,
    startIso: string, endIso: string
  ): Promise<GeofenceResult[]> => {
    const { data, error } = await supabase
      .from('tracking_data')
      .select(`
        id,
        motorcycle_id,
        latitude,
        longitude,
        recorded_at,
        motorcycles!inner(
          id,
          registration_number,
          owners!inner(full_name),
          riders(name)
        )
      `)
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng)
      .gte('recorded_at', startIso)
      .lte('recorded_at', endIso)
      .order('recorded_at', { ascending: false })
      .limit(500);

    if (error) throw error;
    const seen = new Set<string>();
    const out: GeofenceResult[] = [];
    for (const record of data ?? []) {
      if (seen.has(record.motorcycle_id)) continue;
      seen.add(record.motorcycle_id);
      const motorcycleData = (record as any).motorcycles;
      const ownerData = motorcycleData?.owners;
      const riderData = motorcycleData?.riders?.[0];
      out.push({
        tracking_id: record.id,
        motorcycle_id: record.motorcycle_id,
        registration_number: motorcycleData?.registration_number || 'Unknown',
        owner_name: ownerData?.full_name || 'Unknown',
        rider_name: riderData?.name || null,
        latitude: record.latitude,
        longitude: record.longitude,
        recorded_at: record.recorded_at,
        distance: 0,
      });
    }
    return out;
  };

  const renderTabNavigation = () => {
    const tabs: { id: TabType; label: string; icon: any; activeClass: string }[] = [
      { id: 'live', label: 'Live Track', icon: Radio, activeClass: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30' },
      { id: 'trips', label: 'Trips', icon: RouteIcon, activeClass: 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30' },
      { id: 'history', label: 'History Search', icon: History, activeClass: 'bg-blue-600 text-white shadow-sm shadow-blue-600/30' },
      { id: 'geofence', label: 'GeoSearch', icon: MapPinned, activeClass: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30' },
    ];
    return (
      <div className="border-b border-slate-200 bg-white">
        <div className="flex flex-wrap gap-1 p-3">
          {tabs.map(({ id, label, icon: Icon, activeClass }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTab === id ? activeClass : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderStatusCard = (status: TrackerStatus) => {
    const tone = statusTone(status);
    const toneClasses: Record<string, string> = {
      success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      warning: 'bg-amber-50 border-amber-200 text-amber-800',
      neutral: 'bg-sky-50 border-sky-200 text-sky-800',
      muted: 'bg-slate-50 border-slate-200 text-slate-700',
    };
    const dotColor: Record<string, string> = {
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
      neutral: 'bg-sky-500',
      muted: 'bg-slate-400',
    };
    const Icon =
      status.kind === 'live_moving' || status.kind === 'live_stationary'
        ? Satellite
        : status.kind === 'offline'
        ? WifiOff
        : status.kind === 'no_tracker'
        ? AlertCircle
        : Radio;

    return (
      <div className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
        <div className="flex items-start space-x-3">
          <div className={`mt-1 h-2 w-2 rounded-full ${dotColor[tone]} ${tone === 'success' ? 'animate-pulse' : ''}`} />
          <div className="flex-1">
            <div className="flex items-center space-x-2 font-semibold">
              <Icon className="h-4 w-4" />
              <span>{statusLabel(status)}</span>
            </div>
            {status.kind !== 'no_tracker' && status.kind !== 'not_detected' && (
              <p className="text-xs mt-1 opacity-80">
                Last seen: {new Date(status.lastSeen).toLocaleString()}
              </p>
            )}
            {(status.kind === 'live_moving' || status.kind === 'live_stationary') && (
              <p className="text-xs mt-0.5 opacity-80">
                Last GPS fix: {new Date(status.lastFix).toLocaleString()}
              </p>
            )}
            {status.kind === 'no_tracker' && (
              <p className="text-xs mt-1 opacity-80">
                Assign a tracker to this motorcycle to begin live tracking.
              </p>
            )}
            {status.kind === 'not_detected' && (
              <p className="text-xs mt-1 opacity-80">
                The tracker has not connected to the server yet. Power on the device and confirm cellular coverage.
              </p>
            )}
            {status.kind === 'awaiting_fix' && (
              <p className="text-xs mt-1 opacity-80">
                The tracker is online but has not sent a recent GPS position. It may be indoors or searching for satellites.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderEmptyMapMessage = (status: TrackerStatus | null) => {
    if (!status) {
      return (
        <>
          <MapPin className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No location data available</p>
        </>
      );
    }
    const Icon =
      status.kind === 'offline' ? WifiOff
      : status.kind === 'no_tracker' ? AlertCircle
      : status.kind === 'awaiting_fix' ? Satellite
      : MapPin;
    return (
      <>
        <Icon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-800 font-semibold">{statusLabel(status)}</p>
        <p className="text-slate-500 text-sm mt-2">
          The map will show the motorcycle as soon as the tracker sends a live position.
        </p>
      </>
    );
  };

  const renderLiveTrackTab = () => (
    <div className="flex-1 flex flex-col lg:flex-row gap-4">
      <div className="lg:w-[380px] xl:w-[420px] flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4">
            <div className="flex items-center space-x-2 text-white">
              <Bike className="h-5 w-5" />
              <h3 className="text-base font-semibold">Motorcycle</h3>
            </div>
            <p className="text-emerald-100 text-xs mt-1">Live tracker feed</p>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Registration</div>
              <div className="text-lg font-bold text-slate-900">{motorcycle.registration_number}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Serial Number</div>
              <div className="text-base font-semibold text-slate-900 font-mono">
                {motorcycle.tracking_device_id || <span className="text-slate-400">N/A</span>}
              </div>
            </div>
          </div>
        </div>

        {trackerStatus && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center space-x-2 mb-3">
              <Radio className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-slate-900">Tracker Status</h4>
            </div>
            {renderStatusCard(trackerStatus)}
          </div>
        )}

        {currentLocation && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center space-x-2 mb-3">
              <Navigation className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-slate-900">Current Status</h4>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">Speed</div>
                <div className="text-xl font-bold text-emerald-700 mt-0.5">
                  {currentLocation.speed != null ? currentLocation.speed.toFixed(0) : '0'}
                </div>
                <div className="text-[10px] text-slate-500">km/h</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Heading</div>
                <div className="text-xl font-bold text-slate-900 mt-0.5 flex items-center justify-center">
                  {currentLocation.heading == null
                    ? <span className="text-slate-400">—</span>
                    : (
                      <>
                        <Compass className="h-3.5 w-3.5 mr-0.5 text-slate-500" />
                        {Math.round(currentLocation.heading)}°
                      </>
                    )}
                </div>
                <div className="text-[10px] text-slate-500">bearing</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Accuracy</div>
                <div className="text-xl font-bold text-slate-900 mt-0.5">
                  {currentLocation.accuracy != null
                    ? `±${currentLocation.accuracy.toFixed(0)}`
                    : <span className="text-slate-400">—</span>}
                </div>
                <div className="text-[10px] text-slate-500">meters</div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center space-x-1.5 text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                <Clock className="h-3 w-3" /><span>Last seen</span>
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {formatRelativeTime(currentLocation.recorded_at)}
              </div>
              <div className="text-xs text-slate-500">
                {new Date(currentLocation.recorded_at).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-mono">
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </div>
            </div>
          </div>
        )}

        {/* Current Trip */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-900">Current Trip</h4>
            </div>
            {activeTrip && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 animate-pulse">
                In Progress
              </span>
            )}
          </div>

          {activeTrip ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">Duration</div>
                  <div className="text-lg font-bold text-amber-700 mt-0.5">
                    {(() => {
                      const elapsed = Math.floor((Date.now() - new Date(activeTrip.started_at).getTime()) / 1000);
                      const hrs = Math.floor(elapsed / 3600);
                      const mins = Math.floor((elapsed % 3600) / 60);
                      const secs = elapsed % 60;
                      return hrs > 0 ? `${hrs}h ${mins}m` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                    })()}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-blue-700 font-semibold">Distance</div>
                  <div className="text-lg font-bold text-blue-700 mt-0.5">
                    {activeTrip.distance_meters >= 1000
                      ? `${(activeTrip.distance_meters / 1000).toFixed(1)} km`
                      : `${Math.round(activeTrip.distance_meters)} m`}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Avg Speed</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    {activeTrip.avg_speed_kmh.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">km/h</span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Max Speed</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    {activeTrip.max_speed_kmh.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">km/h</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Started</span>
                  <span className="font-medium text-slate-700">{new Date(activeTrip.started_at).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-slate-500">GPS fixes</span>
                  <span className="font-medium text-slate-700">{activeTrip.point_count}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <TrendingDown className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs text-slate-400">No active trip — bike is stationary</p>
            </div>
          )}

          {(todayTripsCount > 0 || activeTrip) && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Today's trips</span>
                <span className="font-semibold text-slate-700">{todayTripsCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-slate-500">Total distance today</span>
                <span className="font-semibold text-slate-700">
                  {todayTotalDistance >= 1000
                    ? `${(todayTotalDistance / 1000).toFixed(1)} km`
                    : `${Math.round(todayTotalDistance)} m`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="h-[60vh] lg:h-auto lg:flex-1 min-h-[400px]">
        <div className="relative h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          <div ref={liveMapRef} style={{ height: '100%', width: '100%' }} />
          {currentLocation && (
            <div className="absolute top-3 left-3 z-[500] bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 px-3 py-2 max-w-[260px]">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Last seen</div>
              <div className="text-sm font-semibold text-slate-900 leading-tight">
                {formatRelativeTime(currentLocation.recorded_at)}
              </div>
              <div className="text-xs text-slate-600 leading-tight">
                {new Date(currentLocation.recorded_at).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-mono">
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </div>
            </div>
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 backdrop-blur-sm">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
                <p className="text-slate-600 mt-4">Loading tracking data...</p>
              </div>
            </div>
          )}
          {!loading && !currentLocation && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90">
              <div className="text-center max-w-sm px-6">
                {renderEmptyMapMessage(trackerStatus)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const formatTripDuration = (start: string, end: string | null) => {
    if (!end) return 'Active';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rm = mins % 60;
    return `${hrs}h ${rm}m`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const renderTripsTab = () => (
    <div className="space-y-4">
      {!selectedTrip ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Previous Trips</h3>
            <span className="text-xs text-slate-500">{tripsList.length} trip{tripsList.length !== 1 ? 's' : ''}</span>
          </div>
          {tripsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tripsList.length === 0 ? (
            <div className="text-center py-12">
              <RouteIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No trips recorded yet.</p>
              <p className="text-xs text-slate-400 mt-1">Trips are automatically detected when the motorcycle moves.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {tripsList.map((trip) => {
                const isActive = trip.status === 'active';
                return (
                  <button
                    key={trip.id}
                    onClick={() => { if (!isActive) loadTripRoute(trip); }}
                    disabled={isActive}
                    className={`w-full text-left rounded-xl border p-4 transition-all ${
                      isActive
                        ? 'border-emerald-200 bg-emerald-50/50 cursor-default'
                        : 'border-slate-200 bg-white hover:border-cyan-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isActive ? 'bg-emerald-100' : 'bg-cyan-50'
                      }`}>
                        <RouteIcon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-cyan-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {new Date(trip.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              ACTIVE
                            </span>
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(trip.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {trip.ended_at && ` — ${new Date(trip.ended_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <RouteIcon className="h-3 w-3 text-slate-400" />
                            {formatDistance(trip.distance_meters)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <Timer className="h-3 w-3 text-slate-400" />
                            {formatTripDuration(trip.started_at, trip.ended_at)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <Gauge className="h-3 w-3 text-slate-400" />
                            {Math.round(trip.max_speed_kmh)} km/h max
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => { setSelectedTrip(null); setTripRoutePoints([]); }}
            className="inline-flex items-center gap-1.5 text-sm text-cyan-600 hover:text-cyan-800 font-medium transition"
          >
            <Navigation className="h-4 w-4 rotate-[270deg]" />
            Back to all trips
          </button>

          {/* Trip detail header */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-cyan-50 flex items-center justify-center">
                <RouteIcon className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {new Date(selectedTrip.started_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(selectedTrip.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  {selectedTrip.ended_at && ` — ${new Date(selectedTrip.ended_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <p className="text-xs text-slate-500">Distance</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{formatDistance(selectedTrip.distance_meters)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <p className="text-xs text-slate-500">Duration</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{formatTripDuration(selectedTrip.started_at, selectedTrip.ended_at)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <p className="text-xs text-slate-500">Avg Speed</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{Math.round(selectedTrip.avg_speed_kmh)} km/h</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <p className="text-xs text-slate-500">Max Speed</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{Math.round(selectedTrip.max_speed_kmh)} km/h</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
              <MapPin className="h-3 w-3" />
              <span>{selectedTrip.point_count} GPS fixes recorded</span>
            </div>
          </div>

          {/* Trip route map */}
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100" style={{ height: 350 }}>
            {tripRouteLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="h-6 w-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading route...</p>
                </div>
              </div>
            ) : tripRoutePoints.length < 2 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <RouteIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Not enough GPS data to draw route.</p>
                </div>
              </div>
            ) : (
              <div ref={tripMapRef} style={{ height: '100%', width: '100%' }} />
            )}
          </div>

          {/* Speed timeline */}
          {tripRoutePoints.length > 2 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">Speed Profile</h4>
              <div className="h-20 flex items-end gap-px">
                {(() => {
                  const maxSpeed = Math.max(...tripRoutePoints.map(p => p.speed || 0), 1);
                  const bucketSize = Math.max(1, Math.floor(tripRoutePoints.length / 60));
                  const buckets: number[] = [];
                  for (let i = 0; i < tripRoutePoints.length; i += bucketSize) {
                    const slice = tripRoutePoints.slice(i, i + bucketSize);
                    const avg = slice.reduce((s, p) => s + (p.speed || 0), 0) / slice.length;
                    buckets.push(avg);
                  }
                  return buckets.map((speed, idx) => {
                    const pct = Math.max(2, (speed / maxSpeed) * 100);
                    const color = speed > 60 ? 'bg-red-400' : speed > 30 ? 'bg-amber-400' : 'bg-cyan-400';
                    return (
                      <div
                        key={idx}
                        className={`flex-1 rounded-t ${color} transition-all`}
                        style={{ height: `${pct}%`, minWidth: 2 }}
                        title={`${Math.round(speed)} km/h`}
                      />
                    );
                  });
                })()}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-slate-400">Start</span>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />&lt;30</span>
                  <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />30-60</span>
                  <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />&gt;60 km/h</span>
                </div>
                <span className="text-[10px] text-slate-400">End</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderHistorySearchTab = () => {
    const stats = computeRouteStats(routeData);
    const cleanedPath = buildCleanRoutePath(routeData);
    const isStationary = routeData.length > 0 && cleanedPath.length < 2;
    const windowOptions: { minutes: number; label: string }[] = [
      { minutes: 30, label: '30m' },
      { minutes: 60, label: '1h' },
      { minutes: 120, label: '2h' },
      { minutes: 240, label: '4h' },
      { minutes: 480, label: '8h' },
      { minutes: 720, label: '12h' },
      { minutes: 1440, label: 'Day' },
    ];
    const speedOptions = [1, 2, 4, 8];
    const currentPoint = routeData[playbackIndex] || historicalPoint;

    const derivedSpeedKmh = (() => {
      if (!currentPoint) return null;
      const reported = (currentPoint as any).speed as number | null | undefined;
      if (playbackIndex <= 0 || routeData.length < 2) return reported ?? null;
      const prev = routeData[playbackIndex - 1];
      const curr = routeData[playbackIndex];
      if (!prev || !curr) return reported ?? null;
      const meters = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      const dtSec = (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
      if (dtSec > 0 && dtSec < 600) {
        const derived = (meters / dtSec) * 3.6;
        if (reported != null && reported > 0) return Math.max(derived, reported);
        return derived;
      }
      return reported ?? null;
    })();

    const derivedHeading = (() => {
      if (!currentPoint) return null;
      const reported = (currentPoint as any).heading as number | null | undefined;
      if (reported != null && !Number.isNaN(reported)) return reported;
      if (playbackIndex <= 0) return null;
      const prev = routeData[playbackIndex - 1];
      const curr = routeData[playbackIndex];
      if (!prev || !curr) return null;
      const dLat = curr.latitude - prev.latitude;
      const dLng = curr.longitude - prev.longitude;
      if (Math.abs(dLat) < 1e-7 && Math.abs(dLng) < 1e-7) return null;
      let deg = (Math.atan2(dLng, dLat) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      return deg;
    })();

    const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const isToday = historyDate === todayIso;
    const isYesterday = historyDate === yesterdayIso;

    return (
      <div className="h-full flex flex-col gap-2 min-h-0">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setHistoryDate(todayIso)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
                isToday ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setHistoryDate(yesterdayIso)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
                isYesterday ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Yesterday
            </button>
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="time"
              value={historyTime}
              onChange={(e) => setHistoryTime(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Window</span>
            {windowOptions.map((opt) => (
              <button
                key={opt.minutes}
                onClick={() => setHistoryWindowMinutes(opt.minutes)}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition ${
                  historyWindowMinutes === opt.minutes
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 border-l border-slate-200 pl-2">
            <input
              type="checkbox"
              checked={showRoute}
              onChange={(e) => setShowRoute(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Route
          </label>

          <button
            onClick={searchHistoricalLocation}
            disabled={historyLoading}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-xs font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {historyLoading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Searching
              </>
            ) : (
              <>
                <History className="h-3.5 w-3.5" />
                Search
              </>
            )}
          </button>
        </div>

        {routeData.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPlaybackIndex(Math.max(0, playbackIndex - 1))}
                disabled={playbackIndex === 0}
                className="p-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition disabled:opacity-40"
                title="Previous"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              </button>
              <button
                onClick={() => {
                  setRoutePlayback(!routePlayback);
                  if (!routePlayback && playbackIndex >= routeData.length - 1) setPlaybackIndex(0);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-xs font-semibold shadow-sm"
              >
                {routePlayback ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {routePlayback ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={() => setPlaybackIndex(Math.min(routeData.length - 1, playbackIndex + 1))}
                disabled={playbackIndex >= routeData.length - 1}
                className="p-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition disabled:opacity-40"
                title="Next"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <input
              type="range"
              min={0}
              max={routeData.length - 1}
              value={playbackIndex}
              onChange={(e) => {
                setPlaybackIndex(Number(e.target.value));
                setRoutePlayback(false);
              }}
              className="flex-1 min-w-[140px] accent-blue-600"
            />

            <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
              {speedOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-1.5 py-1 rounded-md text-[11px] font-semibold transition ${
                    playbackSpeed === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 border-l border-slate-200 pl-3 text-[11px] text-slate-600">
              <span className="whitespace-nowrap">
                <span className="text-slate-400">Frame</span> <span className="font-semibold text-slate-900">{playbackIndex + 1}/{routeData.length}</span>
              </span>
              {currentPoint && (
                <>
                  <span className="whitespace-nowrap">
                    <span className="text-slate-400">Speed</span> <span className="font-semibold text-slate-900">{derivedSpeedKmh != null ? `${derivedSpeedKmh.toFixed(0)} km/h` : '—'}</span>
                  </span>
                  <span className="hidden md:inline whitespace-nowrap">
                    <span className="text-slate-400">Heading</span>{' '}
                    <span className="font-semibold text-slate-900 inline-flex items-center">
                      <Compass className="h-3 w-3 mr-0.5 text-blue-600" />
                      {derivedHeading != null ? `${Math.round(derivedHeading)}°` : '—'}
                    </span>
                  </span>
                  <span className="hidden lg:inline whitespace-nowrap">
                    <span className="text-slate-400">Time</span> <span className="font-semibold text-slate-900">{new Date(currentPoint.recorded_at).toLocaleTimeString()}</span>
                  </span>
                </>
              )}
              {stats && (
                <>
                  <span className="hidden lg:inline whitespace-nowrap">
                    <span className="text-slate-400">Distance</span> <span className="font-semibold text-slate-900">{stats.distanceKm.toFixed(2)} km</span>
                  </span>
                  <span className="hidden xl:inline whitespace-nowrap">
                    <span className="text-slate-400">Top</span> <span className="font-semibold text-slate-900">{stats.maxSpeed.toFixed(0)} km/h</span>
                  </span>
                  <span className="hidden xl:inline whitespace-nowrap">
                    <span className="text-slate-400">Avg</span> <span className="font-semibold text-slate-900">{stats.avgSpeed.toFixed(0)} km/h</span>
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {historyEmptyMessage && !historicalPoint && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">{historyEmptyMessage}</div>
          </div>
        )}

        {isStationary && historicalPoint && (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center gap-2 shadow-sm">
            <MapPin className="h-4 w-4 text-slate-500 flex-shrink-0" />
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Motorcycle parked.</span> All readings in this window are within a few meters.
            </div>
          </div>
        )}

        <div className="flex-1 min-h-[400px] relative">
          <div className="absolute inset-0 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
            <div ref={historyMapRef} style={{ height: '100%', width: '100%' }} />
          </div>
          {historyLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 backdrop-blur-sm rounded-2xl z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-slate-600 mt-4 font-medium">Searching tracker readings...</p>
              </div>
            </div>
          )}
          {!historyLoading && !historicalPoint && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-50/95 to-slate-100/95 rounded-2xl border border-slate-200 z-10">
              <div className="text-center max-w-sm px-6">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <History className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Search the tracker's history</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Pick a date, time and window in the toolbar above, then hit Search. Only real tracker readings are shown.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderGeofenceTab = () => {
    const radiusOptions = [
      { value: 50, label: '50 m' },
      { value: 100, label: '100 m' },
      { value: 200, label: '200 m' },
      { value: 500, label: '500 m' },
      { value: 1000, label: '1 km' },
      { value: 2000, label: '2 km' },
    ];
    const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const isToday = geofenceDate === todayIso;
    const isYesterday = geofenceDate === yesterdayIso;

    return (
      <div className="flex-1 flex flex-col lg:flex-row gap-4">
        <div className="lg:w-[380px] xl:w-[420px] flex flex-col gap-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-4">
              <div className="flex items-center space-x-2 text-white">
                <MapPinned className="h-5 w-5" />
                <h3 className="text-base font-semibold">GeoSearch</h3>
              </div>
              <p className="text-orange-50 text-xs mt-1">Find bikes near a location at a moment in time</p>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center mb-2">
                  <MapPin className="h-3.5 w-3.5 mr-1.5" />
                  Location
                </label>
                <input
                  type="text"
                  value={geofenceLocation}
                  onChange={(e) => { setGeofenceLocation(e.target.value); if (geofenceLocationError) setGeofenceLocationError(null); }}
                  placeholder="Any address, place, landmark, or city"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                {geofenceLocationError && (
                  <p className="mt-1.5 text-xs text-red-600">{geofenceLocationError}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Radius</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {radiusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setGeofenceRadius(opt.value)}
                      className={`px-2 py-2 rounded-lg text-sm font-semibold transition ${
                        geofenceRadius === opt.value
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center mb-2">
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  Date
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setGeofenceDate(todayIso)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                      isToday ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setGeofenceDate(yesterdayIso)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                      isYesterday ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Yesterday
                  </button>
                </div>
                <input
                  type="date"
                  value={geofenceDate}
                  onChange={(e) => setGeofenceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center mb-2">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  Time <span className="ml-1 font-normal normal-case text-slate-400">(±5 min)</span>
                </label>
                <input
                  type="time"
                  value={geofenceTime}
                  onChange={(e) => setGeofenceTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={searchGeofence}
                disabled={geofenceLoading}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {geofenceLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <MapPinned className="h-4 w-4" />
                    <span>Search Area</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {geofenceResults.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-900">Results</h4>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  {geofenceResults.length} bike{geofenceResults.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {geofenceResults.map((result) => (
                  <button
                    key={result.tracking_id}
                    onClick={() => setSelectedBikeForDetails(result)}
                    className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-xl p-3 border border-slate-200 hover:border-amber-300 transition group"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{result.registration_number}</div>
                        <div className="text-xs text-slate-600 truncate">{result.owner_name}</div>
                        {result.rider_name && (
                          <div className="text-[11px] text-slate-500 truncate">Rider: {result.rider_name}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end ml-2">
                        <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                          {result.distance}m
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-amber-500 transition mt-1" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {geofenceResults.length === 0 && !geofenceLoading && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <MapPinned className="h-7 w-7 text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {geofenceTimeWindow ? 'No bikes inside this radius' : 'No results yet'}
              </p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {geofenceTimeWindow
                  ? 'Try widening the radius, or pan the map to look for bikes nearby during this time window.'
                  : 'Set a location, radius and time above, then hit Search Area.'}
              </p>
            </div>
          )}

          {geofenceTimeWindow && geofenceViewportBikes.filter(b => !geofenceResults.some(r => r.motorcycle_id === b.motorcycle_id)).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center space-x-2 text-xs">
                <span className="inline-block w-3 h-3 rounded-full bg-orange-500 border border-white shadow-sm"></span>
                <span className="text-slate-600">Inside radius</span>
                <span className="inline-block w-3 h-3 rounded-full bg-sky-500 border border-white shadow-sm ml-3"></span>
                <span className="text-slate-600">On map</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                {geofenceViewportBikes.filter(b => !geofenceResults.some(r => r.motorcycle_id === b.motorcycle_id)).length}
                {' '}more bike(s) visible on the map during this time window. Pan or zoom to explore.
              </p>
            </div>
          )}
        </div>

        <div className="h-[60vh] lg:h-auto lg:flex-1 min-h-[400px]">
          {geofenceLoading ? (
            <div className="h-full flex items-center justify-center bg-slate-100 rounded-2xl">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
                <p className="text-slate-600 mt-4 font-medium">Searching area...</p>
              </div>
            </div>
          ) : (
            <div className="h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              <div ref={geofenceMapRef} style={{ height: '100%', width: '100%' }} />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHiramFooter = () => (
    <div className="bg-white border-t border-slate-200 py-3 px-6 flex items-center justify-center space-x-2">
      <span className="text-sm text-slate-600">Powered by</span>
      <span className="text-sm font-semibold text-emerald-600">Hiram Technologies</span>
    </div>
  );

  if (fullPage) {
    return (
      <div className="h-full flex flex-col">
        {renderTabNavigation()}
        <div className="flex-1 p-6 overflow-auto">
          {activeTab === 'live' && renderLiveTrackTab()}
          {activeTab === 'trips' && renderTripsTab()}
          {activeTab === 'history' && renderHistorySearchTab()}
          {activeTab === 'geofence' && renderGeofenceTab()}
        </div>
        {renderHiramFooter()}
        {selectedBikeForDetails && (
          <BikeDetailsModal
            motorcycleId={selectedBikeForDetails.motorcycle_id}
            onClose={() => setSelectedBikeForDetails(null)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                <Satellite className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-white">Motorcycle Tracking</h2>
                  {trackerStatus && (
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                      statusTone(trackerStatus.state) === 'green'
                        ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30'
                        : statusTone(trackerStatus.state) === 'amber'
                        ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30'
                        : statusTone(trackerStatus.state) === 'red'
                        ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/30'
                        : 'bg-slate-500/20 text-slate-300 ring-1 ring-slate-400/30'
                    }`}>
                      {statusLabel(trackerStatus.state)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-300 mt-0.5 font-mono">{motorcycle.registration_number}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition p-2 hover:bg-white/10 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {renderTabNavigation()}

          <div className="flex-1 p-5 overflow-auto bg-slate-50">
            {activeTab === 'live' && renderLiveTrackTab()}
            {activeTab === 'trips' && renderTripsTab()}
            {activeTab === 'history' && renderHistorySearchTab()}
            {activeTab === 'geofence' && renderGeofenceTab()}
          </div>

          {renderHiramFooter()}
        </div>
      </div>

      {selectedBikeForDetails && (
        <BikeDetailsModal
          motorcycleId={selectedBikeForDetails.motorcycle_id}
          onClose={() => setSelectedBikeForDetails(null)}
        />
      )}
    </>
  );
}

import { useState, useEffect, useRef } from 'react';
import { MapPin, Activity, AlertTriangle, Database, Navigation, Clock } from 'lucide-react';
import { loadGoogleMaps, createMotorcycleIcon } from '../lib/googleMaps';

interface Device {
  id: string;
  device_id: string;
  phone_number: string;
  status: string;
  last_heartbeat: string;
  vehicle?: {
    registration_number: string;
    make: string;
    model: string;
  };
}

interface Location {
  id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
  acc_status: boolean;
  positioning_status: boolean;
}

interface Alarm {
  id: string;
  alarm_type: string;
  severity: string;
  status: string;
  description: string;
  created_at: string;
}

export default function TrackingDashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [locationHistory, setLocationHistory] = useState<Location[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [stats, setStats] = useState({
    total_devices: 0,
    online_devices: 0,
    active_alarms: 0
  });
  const [loading, setLoading] = useState(true);
  const [apiKey] = useState('demo-api-key');

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  const API_URL = 'http://localhost:3000/api';

  useEffect(() => {
    loadDevices();
    loadStats();
    const interval = setInterval(() => {
      loadDevices();
      loadStats();
      if (selectedDevice) {
        loadDeviceLocation(selectedDevice.device_id);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedDevice]);

  // Initialize Google Map
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps().then((google) => {
      if (cancelled || !mapRef.current) return;
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: { lat: -1.286389, lng: 36.817223 },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
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
    }).catch(console.error);

    return () => { cancelled = true; };
  }, []);

  // Update map when location changes
  useEffect(() => {
    if (!mapInstance.current || !currentLocation) return;
    const google = (window as any).google;
    if (!google) return;

    const pos = { lat: currentLocation.latitude, lng: currentLocation.longitude };

    if (!markerRef.current) {
      const icon = createMotorcycleIcon(google, 32, '#dc2626');
      markerRef.current = new google.maps.Marker({
        position: pos,
        map: mapInstance.current,
        icon,
        title: selectedDevice?.vehicle?.registration_number || selectedDevice?.device_id,
      });
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding:4px"><strong>${selectedDevice?.vehicle?.registration_number || selectedDevice?.device_id}</strong><br/>Speed: ${currentLocation.speed.toFixed(1)} km/h<br/>Heading: ${currentLocation.heading}°<br/>Engine: ${currentLocation.acc_status ? 'On' : 'Off'}<br/>${new Date(currentLocation.timestamp).toLocaleString()}</div>`,
      });
      markerRef.current.addListener('mouseover', () => infoWindow.open(mapInstance.current, markerRef.current));
      markerRef.current.addListener('mouseout', () => infoWindow.close());
    } else {
      markerRef.current.setPosition(pos);
    }

    mapInstance.current.panTo(pos);
  }, [currentLocation, selectedDevice]);

  // Update polyline for history
  useEffect(() => {
    if (!mapInstance.current) return;
    const google = (window as any).google;
    if (!google) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (locationHistory.length > 0) {
      const path = locationHistory.map(loc => ({ lat: loc.latitude, lng: loc.longitude }));
      polylineRef.current = new google.maps.Polyline({
        path,
        map: mapInstance.current,
        strokeColor: '#2563eb',
        strokeWeight: 3,
        strokeOpacity: 0.6,
      });
    }
  }, [locationHistory]);

  const loadDevices = async () => {
    try {
      const response = await fetch(`${API_URL}/devices`, {
        headers: { 'X-API-Key': apiKey }
      });
      const data = await response.json();
      setDevices(data.devices || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load devices:', error);
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/stats/overview`, {
        headers: { 'X-API-Key': apiKey }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadDeviceLocation = async (deviceId: string) => {
    try {
      const response = await fetch(`${API_URL}/devices/${deviceId}/location`, {
        headers: { 'X-API-Key': apiKey }
      });
      const data = await response.json();
      setCurrentLocation(data.location);
    } catch (error) {
      console.error('Failed to load location:', error);
    }
  };

  const loadDeviceHistory = async (deviceId: string) => {
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

      const response = await fetch(
        `${API_URL}/devices/${deviceId}/location/history?start=${start.toISOString()}&end=${end.toISOString()}&limit=500`,
        { headers: { 'X-API-Key': apiKey } }
      );
      const data = await response.json();
      setLocationHistory(data.locations || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const loadDeviceAlarms = async (deviceId: string) => {
    try {
      const response = await fetch(`${API_URL}/devices/${deviceId}/alarms?status=active`, {
        headers: { 'X-API-Key': apiKey }
      });
      const data = await response.json();
      setAlarms(data.alarms || []);
    } catch (error) {
      console.error('Failed to load alarms:', error);
    }
  };

  const handleDeviceSelect = (device: Device) => {
    setSelectedDevice(device);
    loadDeviceLocation(device.device_id);
    loadDeviceHistory(device.device_id);
    loadDeviceAlarms(device.device_id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-4" />
          <p className="text-slate-600">Loading Raidar Tracking Platform...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Navigation className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Raidar Tracking</h1>
                <p className="text-sm text-slate-500">Real-time Vehicle Tracking Platform</p>
              </div>
            </div>
            <div className="flex space-x-4">
              <div className="bg-slate-50 rounded-lg px-4 py-2">
                <div className="text-xs text-slate-500">Total Devices</div>
                <div className="text-2xl font-bold text-slate-800">{stats.total_devices}</div>
              </div>
              <div className="bg-green-50 rounded-lg px-4 py-2">
                <div className="text-xs text-green-600">Online</div>
                <div className="text-2xl font-bold text-green-700">{stats.online_devices}</div>
              </div>
              <div className="bg-red-50 rounded-lg px-4 py-2">
                <div className="text-xs text-red-600">Active Alarms</div>
                <div className="text-2xl font-bold text-red-700">{stats.active_alarms}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-88px)]">
        <aside className="w-80 bg-white border-r overflow-y-auto">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-blue-600" />
              Devices ({devices.length})
            </h2>
          </div>
          <div className="divide-y">
            {devices.map(device => (
              <button
                key={device.id}
                onClick={() => handleDeviceSelect(device)}
                className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                  selectedDevice?.id === device.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">
                      {device.vehicle?.registration_number || device.device_id}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {device.vehicle?.make} {device.vehicle?.model}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      ID: {device.device_id}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        device.status === 'online'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {device.status}
                    </span>
                    {device.last_heartbeat && (
                      <span className="text-xs text-slate-400 mt-1">
                        {new Date(device.last_heartbeat).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />

          {!currentLocation && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none">
              <div className="text-center">
                <MapPin className="w-16 h-16 mx-auto mb-4" />
                <p>Select a device to view its location</p>
              </div>
            </div>
          )}

          {selectedDevice && currentLocation && (
            <div className="absolute top-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 z-[1000]">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {selectedDevice.vehicle?.registration_number || selectedDevice.device_id}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {selectedDevice.vehicle?.make} {selectedDevice.vehicle?.model}
                  </p>
                </div>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                    selectedDevice.status === 'online'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {selectedDevice.status}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-4">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-xs text-slate-500">Speed</div>
                    <div className="font-semibold">{currentLocation.speed.toFixed(1)} km/h</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Navigation className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-xs text-slate-500">Heading</div>
                    <div className="font-semibold">{currentLocation.heading}°</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-xs text-slate-500">Position</div>
                    <div className="font-semibold text-xs">
                      {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-xs text-slate-500">Last Update</div>
                    <div className="font-semibold text-xs">
                      {new Date(currentLocation.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-xs text-slate-500">Engine</div>
                    <div className="font-semibold">
                      {currentLocation.acc_status ? 'On' : 'Off'}
                    </div>
                  </div>
                </div>
              </div>

              {alarms.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-1 text-red-500" />
                    Active Alarms ({alarms.length})
                  </h4>
                  <div className="space-y-2 max-h-24 overflow-y-auto">
                    {alarms.map(alarm => (
                      <div
                        key={alarm.id}
                        className={`text-sm px-3 py-2 rounded ${
                          alarm.severity === 'critical'
                            ? 'bg-red-50 text-red-700'
                            : alarm.severity === 'high'
                            ? 'bg-orange-50 text-orange-700'
                            : 'bg-yellow-50 text-yellow-700'
                        }`}
                      >
                        <div className="font-medium">{alarm.alarm_type.replace(/_/g, ' ')}</div>
                        <div className="text-xs opacity-75">{alarm.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

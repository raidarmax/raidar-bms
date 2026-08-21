import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows } from '../../../theme';
import { ChevronLeftIcon, ActivityIcon, MapPinIcon } from '../../../components/icons/Icons';
import { getSupabase } from '../../../services/supabase';

type Point = {
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  recorded_at: string;
};

const GOOGLE_MAPS_API_KEY = 'AIzaSyDtmHA8JqcZ8VHT_wT2eSibdkFwSy7J-SU';

function buildHtml(apiKey: string): string {
  const mapStyles = [
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
    {
      featureType: 'road',
      elementType: 'labels',
      stylers: [{ visibility: 'simplified' }, { lightness: 20 }],
    },
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
  ];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #eef2f7; }
    #status { position: absolute; top: 8px; left: 8px; right: 8px; padding: 8px 12px;
      background: rgba(220,38,38,0.95); color: white; border-radius: 8px;
      font-family: -apple-system, system-ui, sans-serif; font-size: 12px; display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="status"></div>
  <script>
    var mapStyles = ${JSON.stringify(mapStyles)};
    var map = null;
    var marker = null;
    var polyline = null;
    var pending = [];
    var lastHeading = 0;

    function post(type, payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {})));
      }
    }

    function showStatus(msg) {
      var el = document.getElementById('status');
      el.textContent = msg;
      el.style.display = 'block';
    }

    function motorcycleIcon(size, color, heading) {
      var s = size;
      var pad = Math.round(s * 0.24);
      var total = s + pad * 2;
      var c = total / 2;
      var r = s / 2;
      var tipLen = pad * 0.9;
      var tipHalf = r * 0.34;
      var tipX1 = c - tipHalf;
      var tipX2 = c + tipHalf;
      var tipBaseY = c - r + 1.5;
      var tipTopY = tipBaseY - tipLen;
      var fwY = c - r * 0.62;
      var rwY = c + r * 0.62;
      var wheelHalfW = r * 0.13;
      var wheelHalfL = r * 0.26;
      var tankY = c - r * 0.2;
      var seatY = c + r * 0.18;
      var bodyHalfW = r * 0.17;
      var barHalfW = r * 0.34;
      var h = (heading == null || isNaN(heading)) ? 0 : heading;
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + total + '" height="' + total + '" viewBox="0 0 ' + total + ' ' + total + '">' +
        '<g transform="rotate(' + h + ' ' + c + ' ' + c + ')">' +
        '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="' + color + '" stroke="white" stroke-width="2.5"/>' +
        '<polygon points="' + c + ',' + tipTopY + ' ' + tipX1 + ',' + tipBaseY + ' ' + tipX2 + ',' + tipBaseY + '" fill="' + color + '" stroke="white" stroke-width="2" stroke-linejoin="round"/>' +
        '<line x1="' + c + '" y1="' + tipBaseY + '" x2="' + c + '" y2="' + (tipTopY + tipLen * 0.35) + '" stroke="white" stroke-width="1.4"/>' +
        '<g fill="white" stroke="none">' +
        '<rect x="' + (c - wheelHalfW) + '" y="' + (fwY - wheelHalfL) + '" width="' + (wheelHalfW * 2) + '" height="' + (wheelHalfL * 2) + '" rx="' + wheelHalfW + '"/>' +
        '<rect x="' + (c - wheelHalfW) + '" y="' + (rwY - wheelHalfL) + '" width="' + (wheelHalfW * 2) + '" height="' + (wheelHalfL * 2) + '" rx="' + wheelHalfW + '"/>' +
        '<rect x="' + (c - barHalfW) + '" y="' + (fwY - wheelHalfL * 0.2) + '" width="' + (barHalfW * 2) + '" height="' + (wheelHalfW * 1.1) + '" rx="' + (wheelHalfW * 0.5) + '" opacity="0.92"/>' +
        '<path d="M' + (c - bodyHalfW) + ',' + tankY + ' L' + (c + bodyHalfW) + ',' + tankY + ' L' + (c + bodyHalfW * 1.25) + ',' + seatY + ' L' + (c - bodyHalfW * 1.25) + ',' + seatY + ' Z" opacity="0.95"/>' +
        '<ellipse cx="' + c + '" cy="' + (tankY - r * 0.04) + '" rx="' + (bodyHalfW * 0.85) + '" ry="' + (r * 0.07) + '" opacity="0.55"/>' +
        '<rect x="' + (c - bodyHalfW * 0.7) + '" y="' + (seatY + r * 0.02) + '" width="' + (bodyHalfW * 1.4) + '" height="' + (r * 0.16) + '" rx="' + (r * 0.05) + '" opacity="0.7"/>' +
        '</g></g></svg>';
      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(total, total),
        anchor: new google.maps.Point(c, c)
      };
    }

    function ensurePolyline() {
      if (polyline) return polyline;
      polyline = new google.maps.Polyline({
        map: map,
        path: [],
        geodesic: true,
        strokeColor: '#dc2626',
        strokeOpacity: 0.9,
        strokeWeight: 4
      });
      return polyline;
    }

    function setPoints(points) {
      if (!map || !points || points.length === 0) return;
      var path = points.map(function(p) { return { lat: p.latitude, lng: p.longitude }; });
      ensurePolyline().setPath(path);
      var latest = points[points.length - 1];
      var pos = { lat: latest.latitude, lng: latest.longitude };
      if (latest.heading != null && !isNaN(latest.heading)) lastHeading = latest.heading;
      if (!marker) {
        marker = new google.maps.Marker({
          map: map,
          position: pos,
          icon: motorcycleIcon(38, '#dc2626', lastHeading),
          zIndex: 999
        });
      } else {
        marker.setPosition(pos);
        marker.setIcon(motorcycleIcon(38, '#dc2626', lastHeading));
      }
      map.setCenter(pos);
      map.setZoom(16);
    }

    function appendPoint(p) {
      if (!map) { pending.push(p); return; }
      var line = ensurePolyline();
      var path = line.getPath();
      path.push(new google.maps.LatLng(p.latitude, p.longitude));
      while (path.getLength() > 800) path.removeAt(0);
      if (p.heading != null && !isNaN(p.heading)) lastHeading = p.heading;
      var pos = { lat: p.latitude, lng: p.longitude };
      if (!marker) {
        marker = new google.maps.Marker({
          map: map,
          position: pos,
          icon: motorcycleIcon(38, '#dc2626', lastHeading),
          zIndex: 999
        });
        map.setCenter(pos);
        map.setZoom(16);
      } else {
        marker.setPosition(pos);
        marker.setIcon(motorcycleIcon(38, '#dc2626', lastHeading));
        map.panTo(pos);
      }
    }

    function recenter() {
      if (marker) { map.setCenter(marker.getPosition()); map.setZoom(17); }
    }

    window.__setPoints = setPoints;
    window.__appendPoint = appendPoint;
    window.__recenter = recenter;

    window.__initMap = function() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: -1.286389, lng: 36.817223 },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: mapStyles
      });
      post('ready');
      if (pending.length) {
        var buf = pending.slice(); pending = [];
        buf.forEach(appendPoint);
      }
    };

    window.gm_authFailure = function() {
      showStatus('Google Maps authorization failed. Check API key restrictions.');
      post('auth_failure');
    };

    var s = document.createElement('script');
    s.async = true;
    s.defer = true;
    s.src = 'https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&loading=async&callback=__initMap';
    s.onerror = function() {
      showStatus('Failed to load Google Maps.');
      post('load_error');
    };
    document.head.appendChild(s);
  </script>
</body>
</html>`;
}

export default function LiveTrackingScreen({ route, navigation }: any) {
  const { motorcycleId, title } = route.params as { motorcycleId: string; title?: string };
  const insets = useSafeAreaInsets();
  const html = useMemo(() => buildHtml(GOOGLE_MAPS_API_KEY), []);
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [latest, setLatest] = useState<Point | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const supabase = getSupabase();

    const load = async () => {
      const { data, error: err } = await supabase
        .from('tracking_data')
        .select('latitude, longitude, speed, heading, recorded_at')
        .eq('motorcycle_id', motorcycleId)
        .order('recorded_at', { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        return;
      }
      const pts = ((data || []) as Point[]).slice().reverse();
      setHistoryLoaded(true);
      if (pts.length === 0) return;
      setLatest(pts[pts.length - 1]);
      webRef.current?.injectJavaScript(
        `window.__setPoints && window.__setPoints(${JSON.stringify(pts)}); true;`,
      );
    };
    load();

    const channel = supabase
      .channel(`tracking-${motorcycleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tracking_data',
          filter: `motorcycle_id=eq.${motorcycleId}`,
        },
        (payload: any) => {
          const p = payload.new as Point;
          if (p?.latitude == null || p?.longitude == null) return;
          setLatest(p);
          webRef.current?.injectJavaScript(
            `window.__appendPoint && window.__appendPoint(${JSON.stringify(p)}); true;`,
          );
        },
      )
      .subscribe((status: any) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [ready, motorcycleId]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <ChevronLeftIcon size={22} color={colors.gray[700]} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title} numberOfLines={1}>
            {title || 'Live Tracking'}
          </Text>
          <View style={styles.connRow}>
            <View
              style={[
                styles.connDot,
                { backgroundColor: connected ? colors.green[500] : colors.gray[400] },
              ]}
            />
            <Text style={styles.connText}>
              {connected ? 'Live · connected' : 'Connecting…'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => webRef.current?.injectJavaScript('window.__recenter && window.__recenter(); true;')}
          style={styles.recenterBtn}
        >
          <MapPinIcon size={18} color={colors.brand[700]} />
        </TouchableOpacity>
      </View>

      <View style={styles.mapWrap}>
        <WebView
          ref={webRef}
          originWhitelist={["*"]}
          source={{ html, baseUrl: 'https://localhost' }}
          onMessage={(ev: any) => {
            try {
              const msg = JSON.parse(ev.nativeEvent.data);
              if (msg?.type === 'ready') setReady(true);
              else if (msg?.type === 'auth_failure')
                setError('Google Maps rejected the API key. Please check that HTTP referrers are unrestricted or include the mobile bundle identifier.');
              else if (msg?.type === 'load_error')
                setError('Google Maps failed to load. Check your internet connection.');
            } catch {}
          }}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          setSupportMultipleWindows={false}
          style={styles.web}
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.brand[500]} size="large" />
            </View>
          )}
          startInLoadingState
        />
      </View>

      <View style={styles.hud}>
        {error ? (
          <Text style={styles.errText}>{error}</Text>
        ) : latest ? (
          <>
            <HudTile label="LATITUDE" value={latest.latitude.toFixed(6)} />
            <HudTile label="LONGITUDE" value={latest.longitude.toFixed(6)} />
            <HudTile
              label="SPEED"
              value={latest.speed != null ? `${Math.round(latest.speed)} km/h` : '—'}
            />
            <HudTile
              label="LAST FIX"
              value={new Date(latest.recorded_at).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            />
          </>
        ) : historyLoaded ? (
          <View style={styles.noData}>
            <ActivityIcon size={16} color={colors.gray[400]} />
            <Text style={styles.noDataText}>
              No GPS data yet for this motorcycle. When the tracker sends a fix it will appear
              here immediately.
            </Text>
          </View>
        ) : (
          <View style={styles.noData}>
            <ActivityIndicator size="small" color={colors.brand[500]} />
            <Text style={styles.noDataText}>Loading recent locations…</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function HudTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.hudTile}>
      <Text style={styles.hudLabel}>{label}</Text>
      <Text style={styles.hudValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[900] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: spacing.sm,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
  backText: { fontSize: 14, fontWeight: '600', color: colors.gray[700] },
  title: { fontSize: 15, fontWeight: '700', color: colors.gray[900] },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  connText: { fontSize: 11, color: colors.gray[500], fontWeight: '600' },
  recenterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapWrap: { flex: 1, backgroundColor: '#eef2f7' },
  web: { flex: 1, backgroundColor: '#eef2f7' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  hud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    ...shadows.lg,
  },
  hudTile: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  hudLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.gray[500],
  },
  hudValue: { fontSize: 13, fontWeight: '800', color: colors.gray[900], marginTop: 2 },
  errText: { color: colors.rose[700], padding: spacing.md, fontSize: 13 },
  noData: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    flex: 1,
  },
  noDataText: { fontSize: 12, color: colors.gray[500], flex: 1, lineHeight: 18 },
});

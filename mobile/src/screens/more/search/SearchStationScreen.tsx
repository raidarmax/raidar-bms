import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../../theme';
import {
  ChevronLeftIcon,
  ShieldIcon,
  PhoneIcon,
  MapPinIcon,
} from '../../../components/icons/Icons';
import { getSupabase } from '../../../services/supabase';
import { loadStationBundle, type FetchStamp } from '../../../services/data';
import { DataFooter } from '../../../components/ui/DataFooter';
import { detailStyles as s } from './shared';

export default function SearchStationScreen(props: any) {
  const routeKey = props?.route?.key || 'no-key';
  const stationId = props?.route?.params?.stationId || 'no-id';
  return <SearchStationInner key={`${routeKey}::${stationId}`} {...props} />;
}

function SearchStationInner({ route, navigation }: any) {
  const { stationId } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [station, setStation] = useState<any>(null);
  const [officerCount, setOfficerCount] = useState(0);
  const [incidentCount, setIncidentCount] = useState(0);
  const [stamp, setStamp] = useState<FetchStamp | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setStation(null);
    setOfficerCount(0);
    setIncidentCount(0);
    try {
      const bundle = await loadStationBundle(stationId);
      if (reqId !== reqIdRef.current) return;
      if (!bundle) {
        setStamp({
          fetchedAt: Date.now(),
          rowCount: 0,
          filter: `station:${String(stationId).slice(0, 8)}`,
          errorMessage: 'Station not found',
        });
        setLoading(false);
        return;
      }
      setStation(bundle.station);
      setOfficerCount(bundle.officersCount);
      setIncidentCount(bundle.incidentsCount);
      setStamp(bundle.stamp);
    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      setStamp({
        fetchedAt: Date.now(),
        rowCount: 0,
        filter: `station:${String(stationId).slice(0, 8)}`,
        errorMessage: e?.message || 'Fetch failed',
      });
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={s.container}>
        <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
            <ChevronLeftIcon size={22} color={colors.gray[700]} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={s.loading}>
          <ActivityIndicator color={colors.brand[500]} size="large" />
        </View>
      </View>
    );
  }
  if (!station) {
    return (
      <View style={s.container}>
        <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
            <ChevronLeftIcon size={22} color={colors.gray[700]} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.emptyText}>Station not found.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
          <ChevronLeftIcon size={22} color={colors.gray[700]} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <View style={s.heroRow}>
            <View style={[s.heroIcon, { backgroundColor: colors.gray[100] }]}>
              <ShieldIcon size={28} color={colors.gray[700]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{station.station_name}</Text>
              <Text style={s.heroSubtitle}>
                {station.station_type || 'Police Station'}
                {station.station_code ? ` · ${station.station_code}` : ''}
              </Text>
            </View>
          </View>

          {station.phone_number ? (
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => Linking.openURL(`tel:${station.phone_number}`)}
            >
              <PhoneIcon size={16} color={colors.white} />
              <Text style={s.actionBtnText}>Call {station.phone_number}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={s.statGrid}>
            <View style={s.statTile}>
              <Text style={s.statLabel}>OFFICERS</Text>
              <Text style={s.statValue}>{officerCount}</Text>
            </View>
            <View style={s.statTile}>
              <Text style={s.statLabel}>INCIDENTS</Text>
              <Text style={s.statValue}>{incidentCount}</Text>
            </View>
          </View>
        </View>

        <Text style={s.sectionLabel}>Location</Text>
        <View style={s.card}>
          <Row label="Address" value={station.physical_address || '—'} />
          <Row
            label="Coordinates"
            value={
              station.gps_lat != null && station.gps_lng != null
                ? `${Number(station.gps_lat).toFixed(5)}, ${Number(station.gps_lng).toFixed(5)}`
                : '—'
            }
            last
          />
        </View>

        <Text style={s.sectionLabel}>Contact</Text>
        <View style={s.card}>
          <Row label="Phone" value={station.phone_number || '—'} />
          <Row label="Email" value={station.email || '—'} last />
        </View>

        {station.gps_lat != null && station.gps_lng != null ? (
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${station.gps_lat},${station.gps_lng}`,
              )
            }
          >
            <MapPinIcon size={16} color={colors.white} />
            <Text style={s.actionBtnText}>Open in Maps</Text>
          </TouchableOpacity>
        ) : null}

        <DataFooter stamp={stamp} onRefresh={load} hint={`Station ${station?.id?.slice(0, 8) || ''}`} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, last && s.rowLast]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

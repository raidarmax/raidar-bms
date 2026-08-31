import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { UsersIcon } from '../../components/icons/Icons';
import { useAuth } from '../../context/AuthContext';
import { getSupabase } from '../../services/supabase';

type OfficerRow = {
  id: string;
  full_name: string;
  rank: string;
  service_number: string;
  is_active: boolean;
};

export default function OfficersScreen({ navigation }: any) {
  const { officer } = useAuth();
  const [officers, setOfficers] = useState<OfficerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officer?.station_id) return;

    const fetchOfficers = async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('police_officers')
        .select('id, full_name, rank, service_number, is_active')
        .eq('station_id', officer.station_id)
        .order('full_name');

      if (data) setOfficers(data);
      setLoading(false);
    };

    fetchOfficers();
  }, [officer?.station_id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand[500]} />
      </View>
    );
  }

  const renderItem = ({ item }: { item: OfficerRow }) => (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.name}>{item.full_name}</Text>
        <Text style={styles.detail}>
          {item.rank} • {item.service_number}
        </Text>
      </View>
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: item.is_active ? colors.green[50] : colors.gray[100] },
        ]}
      >
        <Text
          style={[
            styles.statusText,
            { color: item.is_active ? colors.green[700] : colors.gray[500] },
          ]}
        >
          {item.is_active ? 'Active' : 'Inactive'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={officers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No officers found at this station</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  rowInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  name: {
    ...typography.h3,
  },
  detail: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  statusBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xxxxl,
    color: colors.gray[400],
  },
});

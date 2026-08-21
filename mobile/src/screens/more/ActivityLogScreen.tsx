import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { ActivityIcon } from '../../components/icons/Icons';
import { useAuth } from '../../context/AuthContext';
import { getSupabase } from '../../services/supabase';

type FineRow = {
  id: string;
  fine_reference: string;
  rider_name: string;
  fine_amount: number;
  issued_at: string;
};

export default function ActivityLogScreen({ navigation }: any) {
  const { officer } = useAuth();
  const [fines, setFines] = useState<FineRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officer?.station_id) return;

    const fetchFines = async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('fines')
        .select('id, fine_reference, rider_name, fine_amount, issued_at')
        .eq('station_id', officer.station_id)
        .order('issued_at', { ascending: false })
        .limit(20);

      if (data) setFines(data);
      setLoading(false);
    };

    fetchFines();
  }, [officer?.station_id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.brand[500]} />
      </View>
    );
  }

  const renderItem = ({ item }: { item: FineRow }) => (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.reference}>{item.fine_reference}</Text>
        <Text style={styles.rider}>{item.rider_name}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.amount}>KES {item.fine_amount.toLocaleString()}</Text>
        <Text style={styles.date}>
          {new Date(item.issued_at).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={fines}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No recent activity</Text>
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
  rowLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  reference: {
    ...typography.h3,
  },
  rider: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  amount: {
    ...typography.h3,
    color: colors.brand[600],
  },
  date: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xxxxl,
    color: colors.gray[400],
  },
});

import { useEffect, useRef, useCallback } from 'react';
import { getSupabase } from '../services/supabase';

type RealtimeCallback = (payload: any) => void;

export function useRealtimeSubscription(
  table: string,
  filter: { column: string; value: string } | null,
  onInsert?: RealtimeCallback,
  onUpdate?: RealtimeCallback,
  onDelete?: RealtimeCallback
) {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!filter?.value) return;
    const supabase = getSupabase();

    const channelName = `${table}_${filter.column}_${filter.value}`;
    let channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${filter.column}=eq.${filter.value}`,
        },
        (payload: any) => {
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload.new);
              break;
            case 'UPDATE':
              onUpdate?.(payload.new);
              break;
            case 'DELETE':
              onDelete?.(payload.old);
              break;
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, filter?.column, filter?.value]);
}

export function useIncidentRealtime(
  stationId: string | undefined,
  onNewIncident: (incident: any) => void,
  onUpdatedIncident?: (incident: any) => void
) {
  useRealtimeSubscription(
    'incidents',
    stationId ? { column: 'station_id', value: stationId } : null,
    onNewIncident,
    onUpdatedIncident
  );
}

export function useFineRealtime(
  stationId: string | undefined,
  onNewFine: (fine: any) => void,
  onUpdatedFine?: (fine: any) => void
) {
  useRealtimeSubscription(
    'fines',
    stationId ? { column: 'station_id', value: stationId } : null,
    onNewFine,
    onUpdatedFine
  );
}

import { useQuery } from '@tanstack/react-query';
import { client, supabase } from '@/api/client';

export function useReconciliationSnapshot(customerId) {
  const signOffKey = ['reconciliation_sign_off_latest', customerId];
  const historyKey = ['reconciliation_sign_off_history', customerId];
  const snapshotsKey = ['reconciliation_snapshots', customerId];

  const { data: allSignOffs = [], isLoading: historyLoading } = useQuery({
    queryKey: historyKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reconciliation_sign_offs')
        .select('*, signed_by_user:users!reconciliation_sign_offs_signed_by_fkey(full_name, email)')
        .eq('customer_id', customerId)
        .order('signed_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 2,
  });

  const latestSignOff = allSignOffs[0] || null;
  const signOffId = latestSignOff?.id;

  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery({
    queryKey: [...snapshotsKey, signOffId],
    queryFn: () =>
      client.entities.ReconciliationSnapshot.filter({ sign_off_id: signOffId }),
    enabled: !!signOffId,
    staleTime: 1000 * 60 * 2,
  });

  const snapshotsByRuleId = snapshots.reduce((acc, snap) => {
    acc[snap.rule_id] = snap;
    return acc;
  }, {});

  return {
    latestSignOff,
    allSignOffs,
    snapshots,
    snapshotsByRuleId,
    isLoading: historyLoading || snapshotsLoading,
    signOffKey,
    historyKey,
    snapshotsKey,
  };
}

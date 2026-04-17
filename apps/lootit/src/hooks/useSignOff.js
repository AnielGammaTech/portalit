import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';

export function useSignOff(customerId) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const signOffMutation = useMutation({
    mutationFn: async ({ allRecons, pax8Recons, reviews, overrides, notes }) => {
      const allTiles = [
        ...(allRecons || []).map((r) => ({
          ruleId: r.rule.id,
          label: r.rule.label,
          integrationKey: r.rule.integration_key || r.integrationLabel,
          psaQty: r.psaQty,
          vendorQty: r.vendorQty,
          status: r.status,
          review: (reviews || []).find((rv) => rv.rule_id === r.rule.id),
        })),
        ...(pax8Recons || []).map((r) => ({
          ruleId: r.ruleId,
          label: r.productName,
          integrationKey: 'pax8',
          psaQty: r.psaQty,
          vendorQty: r.vendorQty,
          status: r.status,
          review: (reviews || []).find((rv) => rv.rule_id === r.ruleId),
        })),
      ];

      const matched = allTiles.filter((t) => t.status === 'match').length;
      const issues = allTiles.filter((t) => ['over', 'under'].includes(t.status)).length;
      const forcedMatched = allTiles.filter((t) => t.review?.status === 'force_matched').length;
      const dismissed = allTiles.filter((t) => t.review?.status === 'dismissed').length;
      const excluded = allTiles.filter((t) => (t.review?.exclusion_count || 0) > 0).length;

      const { data: signOff, error: signOffError } = await supabase
        .from('reconciliation_sign_offs')
        .insert({
          customer_id: customerId,
          signed_by: user?.id,
          signed_at: new Date().toISOString(),
          status: 'signed_off',
          manual_notes: notes || null,
          total_rules: allTiles.length,
          matched_count: matched,
          issues_count: issues,
          force_matched_count: forcedMatched,
          dismissed_count: dismissed,
          excluded_count: excluded,
        })
        .select()
        .single();

      if (signOffError) throw signOffError;

      const snapshotRows = allTiles.map((tile) => {
        const tileOverrides = (overrides || []).filter((o) => o.rule_id === tile.ruleId);
        return {
          customer_id: customerId,
          sign_off_id: signOff.id,
          rule_id: tile.ruleId,
          label: tile.label,
          integration_key: tile.integrationKey,
          status: tile.status,
          psa_qty: tile.psaQty,
          vendor_qty: tile.vendorQty,
          difference: (tile.psaQty || 0) - (tile.vendorQty || 0),
          exclusion_count: tile.review?.exclusion_count || 0,
          exclusion_reason: tile.review?.exclusion_reason || null,
          review_status: tile.review?.status || 'pending',
          review_notes: tile.review?.notes || null,
          reviewed_by: tile.review?.reviewed_by || null,
          reviewed_by_name: user?.full_name || user?.email || null,
          reviewed_at: tile.review?.reviewed_at || null,
          override_data: tileOverrides.length > 0 ? tileOverrides : null,
        };
      });

      if (snapshotRows.length > 0) {
        const { error: snapError } = await supabase
          .from('reconciliation_snapshots')
          .insert(snapshotRows);
        if (snapError) throw snapError;
      }

      const historyRows = allTiles.map((tile) => ({
        customer_id: customerId,
        rule_id: tile.ruleId,
        action: 'signed_off',
        status: tile.review?.status || 'pending',
        notes: `Sign-off ${signOff.id}`,
        psa_qty: tile.psaQty,
        vendor_qty: tile.vendorQty,
        created_by: user?.id || null,
      }));

      if (historyRows.length > 0) {
        supabase.from('reconciliation_review_history').insert(historyRows);
      }

      return signOff;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation_sign_off_latest', customerId] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation_snapshots', customerId] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation_review_history', customerId] });
      queryClient.invalidateQueries({ queryKey: ['sign_off_status', customerId] });
    },
  });

  return {
    signOff: signOffMutation.mutateAsync,
    isSigningOff: signOffMutation.isPending,
  };
}

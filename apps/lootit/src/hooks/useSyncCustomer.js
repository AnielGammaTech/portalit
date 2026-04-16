import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { client } from '@/api/client';

export function useSyncCustomer(customer) {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  const handleSync = useCallback(async () => {
    if (!customer.external_id) {
      toast.error('Cannot sync: customer has no HaloPSA ID');
      return;
    }
    setIsSyncing(true);
    try {
      try {
        await client.halo.syncCustomer(customer.external_id);
      } catch (err) {
        toast.error(`Customer sync failed: ${err.message}`);
      }

      try {
        await client.functions.invoke('syncHaloPSARecurringBills', {
          action: 'sync_customer',
          customer_id: customer.external_id,
        });
      } catch (err) {
        toast.error(`Recurring bill sync failed: ${err.message}`);
      }

      const vendorSyncs = [
        { fn: 'syncDattoRMMDevices', action: 'sync_devices', label: 'Datto RMM' },
        { fn: 'syncDattoEDR', action: 'sync_alerts', label: 'Datto EDR' },
        { fn: 'syncJumpCloudLicenses', action: 'sync_licenses', label: 'JumpCloud' },
        { fn: 'syncSpanningBackup', action: 'sync_licenses', label: 'Spanning' },
        { fn: 'syncCoveData', action: 'sync_devices', label: 'Cove' },
        { fn: 'syncRocketCyber', action: 'sync_agents', label: 'RocketCyber' },
        { fn: 'syncUniFiDevices', action: 'sync_devices', label: 'UniFi' },
        { fn: 'syncPax8Subscriptions', action: 'sync_subscriptions', label: 'Pax8' },
      ];
      let failed = 0;
      for (let i = 0; i < vendorSyncs.length; i++) {
        const v = vendorSyncs[i];
        setSyncStatus(`Syncing ${v.label}... (${i + 1}/${vendorSyncs.length})`);
        try {
          await client.functions.invoke(v.fn, { action: v.action, customer_id: customer.id });
        } catch {
          failed++;
        }
      }
      if (failed > 0) toast.error(`${failed} vendor sync(s) had issues`);

      await queryClient.invalidateQueries({ queryKey: ['reconciliation_rules'] });
      await queryClient.invalidateQueries({ queryKey: ['recurring_bills'] });
      await queryClient.invalidateQueries({ queryKey: ['recurring_bill_line_items'] });
      await queryClient.invalidateQueries({ queryKey: ['recurring_bill_line_items_customer', customer.id] });
      await queryClient.invalidateQueries({ queryKey: ['reconciliation_reviews', customer.id] });
      await queryClient.invalidateQueries({ queryKey: ['lootit_contracts', customer.id] });
      await queryClient.invalidateQueries({ queryKey: ['customer_contacts', customer.id] });
      await queryClient.invalidateQueries({ queryKey: ['customer_devices', customer.id] });
      await queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith('lootit_entity_'),
      });

      setSyncStatus('');
      toast.success(`All data synced for ${customer.name}`);
    } finally {
      setIsSyncing(false);
      setSyncStatus('');
    }
  }, [customer, queryClient]);

  return { isSyncing, syncStatus, handleSync };
}

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { toast } from 'sonner';

/**
 * Hook for syncing all integrations for a customer.
 * Returns { syncAll, isSyncing } for use in UI.
 */
export function useCustomerSync(customer, customerId) {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const syncAll = useCallback(async () => {
    if (!customer) return;
    setIsSyncing(true);
    const results = [];
    const errors = [];

    try {
      // Sync HaloPSA if customer is from HaloPSA
      if (customer?.source === 'halopsa' && customer?.external_id) {
        try {
          const res = await client.functions.invoke('syncHaloPSACustomers', {
            action: 'sync_customer',
            customer_id: customer.external_id,
          });
          if (res.success) results.push('HaloPSA');
          else errors.push('HaloPSA');
        } catch { errors.push('HaloPSA'); }
      }

      // Sync JumpCloud if mapped
      const jcMappings = await client.entities.JumpCloudMapping.filter({ customer_id: customerId });
      if (jcMappings.length > 0) {
        try {
          const res = await client.functions.invoke('syncJumpCloudLicenses', {
            action: 'sync_licenses',
            customer_id: customerId,
          });
          if (res.success) results.push('JumpCloud');
          else errors.push('JumpCloud');
        } catch { errors.push('JumpCloud'); }
      }

      // Sync Spanning if mapped
      const spanMappings = await client.entities.SpanningMapping.filter({ customer_id: customerId });
      if (spanMappings.length > 0) {
        try {
          const res = await client.functions.invoke('syncSpanningBackup', {
            action: 'sync_licenses',
            customer_id: customerId,
          });
          if (res.success) results.push('Spanning');
          else errors.push('Spanning');
        } catch { errors.push('Spanning'); }
      }

      // Sync Datto if mapped
      const dattoMappings = await client.entities.DattoSiteMapping.filter({ customer_id: customerId });
      if (dattoMappings.length > 0) {
        try {
          const res = await client.functions.invoke('syncDattoRMMDevices', {
            action: 'sync_site',
            site_id: dattoMappings[0].datto_site_id,
          });
          if (res.success) results.push('Datto');
          else errors.push('Datto');
        } catch { errors.push('Datto'); }
      }

      if (results.length > 0) {
        toast.success(`Synced: ${results.join(', ')}`);
        queryClient.invalidateQueries();
      }
      if (errors.length > 0) {
        toast.error(`Failed: ${errors.join(', ')}`);
      }
      if (results.length === 0 && errors.length === 0) {
        toast.info('No integrations configured to sync');
      }
    } catch (error) {
      toast.error(error.message || 'An error occurred during sync');
    } finally {
      setIsSyncing(false);
    }
  }, [customer, customerId, queryClient]);

  return { syncAll, isSyncing };
}

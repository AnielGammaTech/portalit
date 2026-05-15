import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Eye, ShieldCheck } from 'lucide-react';

import { client } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { createPageUrl } from '../utils';
import CustomerDetail from './CustomerDetail';

export default function CustomerPortalPreview() {
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('id');

  const { data: customer = null } = useQuery({
    queryKey: ['customer-preview', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const results = await client.entities.Customer.filter({ id: customerId });
      return (results ?? [])[0] || null;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });

  if (!customerId) {
    return (
      <EmptyState
        icon={Eye}
        title="Choose a customer"
        description="Open preview from a customer record so the portal can mirror the correct account."
        action={{
          label: 'Back to customers',
          onClick: () => { window.location.href = createPageUrl('Customers'); },
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-white">
              <ShieldCheck className="h-5 w-5 text-amber-700" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-amber-950">Customer portal mirror</h2>
                <Badge variant="outline" className="border-amber-300 bg-white text-amber-800">
                  Read-only preview
                </Badge>
              </div>
              <p className="mt-1 text-sm text-amber-800">
                You are viewing the same customer experience served by customer.portalit.
                {customer?.name ? ` Account: ${customer.name}.` : ''}
              </p>
            </div>
          </div>
          <Button variant="outline" className="gap-2 border-amber-300 bg-white text-amber-800 hover:bg-amber-100" asChild>
            <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)}>
              <ArrowLeft className="h-4 w-4" />
              Back to admin view
            </Link>
          </Button>
        </div>
      </section>

      <CustomerDetail mirrorMode previewCustomerId={customerId} />
    </div>
  );
}

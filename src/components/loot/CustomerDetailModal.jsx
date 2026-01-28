import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUp, ArrowDown, Minus, Building2 } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function CustomerDetailModal({ customer, isOpen, onClose }) {
  const { data: recurringBills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['customer_bills', customer?.id],
    queryFn: () => base44.entities.RecurringBill.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const { data: billLineItems = [], isLoading: loadingLineItems } = useQuery({
    queryKey: ['customer_line_items', customer?.id],
    queryFn: async () => {
      if (!recurringBills.length) return [];
      const allItems = await base44.entities.RecurringBillLineItem.list('-created_date', 1000);
      return allItems.filter(item => 
        recurringBills.some(bill => bill.id === item.recurring_bill_id)
      );
    },
    enabled: recurringBills.length > 0,
  });

  const { data: devices = [], isLoading: loadingDevices } = useQuery({
    queryKey: ['customer_devices', customer?.id],
    queryFn: () => base44.entities.Device.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id,
  });

  const isLoading = loadingBills || loadingLineItems || loadingDevices;

  if (!customer) return null;

  // Group line items by service type
  const categorizedItems = billLineItems.reduce((acc, item) => {
    const desc = item.description?.toLowerCase() || '';
    let category = 'Other';
    
    if (desc.includes('datto') || desc.includes('rmm') || desc.includes('device')) {
      category = 'Datto RMM';
    } else if (desc.includes('backup') || desc.includes('cove')) {
      category = 'Cove Backup';
    } else if (desc.includes('jumpcloud') || desc.includes('user')) {
      category = 'JumpCloud';
    } else if (desc.includes('spanning')) {
      category = 'Spanning';
    }
    
    if (!acc[category]) {
      acc[category] = { items: [], totalQty: 0, totalAmount: 0 };
    }
    acc[category].items.push(item);
    acc[category].totalQty += item.quantity || 0;
    acc[category].totalAmount += item.net_amount || (item.quantity * item.price) || 0;
    
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <span className="text-xl">{customer.name}</span>
              <p className="text-sm font-normal text-slate-500">{customer.contract_name || 'Managed Services'}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{devices.length}</p>
                <p className="text-xs text-slate-500">Vendor Devices</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{billLineItems.length}</p>
                <p className="text-xs text-slate-500">PSA Line Items</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">
                  ${billLineItems.reduce((sum, item) => sum + (item.net_amount || 0), 0).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">Total Billed</p>
              </div>
            </div>

            {/* Service Breakdown */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Service Breakdown</h3>
              <div className="space-y-3">
                {Object.entries(categorizedItems).map(([category, data]) => (
                  <div key={category} className="bg-white border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          category === 'Datto RMM' && "bg-blue-500",
                          category === 'Cove Backup' && "bg-emerald-500",
                          category === 'JumpCloud' && "bg-purple-500",
                          category === 'Spanning' && "bg-orange-500",
                          category === 'Other' && "bg-slate-400"
                        )} />
                        <span className="font-medium text-slate-900">{category}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-500">PSA Qty: <strong>{data.totalQty}</strong></span>
                        <span className="text-slate-900 font-semibold">${data.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {/* Line items detail */}
                    <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                      {data.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm text-slate-600">
                          <span className="truncate flex-1">{item.description || 'Unnamed item'}</span>
                          <div className="flex items-center gap-4 ml-4">
                            <span>{item.quantity || 0} × ${(item.price || 0).toFixed(2)}</span>
                            <span className="font-medium w-20 text-right">${(item.net_amount || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {Object.keys(categorizedItems).length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No billing line items found for this customer
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
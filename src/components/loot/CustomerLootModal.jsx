import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, Building2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function CustomerLootModal({ customer, lootSettings, isOpen, onClose }) {
  if (!customer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <span className="text-xl">{customer.name}</span>
              <p className="text-sm font-normal text-slate-500">Billing Reconciliation Details</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">${customer.totalPsaRevenue?.toLocaleString() || 0}</p>
              <p className="text-xs text-slate-500">PSA Revenue</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">${customer.totalVendorCost?.toLocaleString() || 0}</p>
              <p className="text-xs text-slate-500">Vendor Cost</p>
            </div>
            <div className={cn(
              "rounded-lg p-4 text-center",
              customer.totalProfit >= 0 ? "bg-emerald-50" : "bg-red-50"
            )}>
              <p className={cn(
                "text-2xl font-bold",
                customer.totalProfit >= 0 ? "text-emerald-700" : "text-red-700"
              )}>
                ${customer.totalProfit?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-slate-500">Profit</p>
            </div>
          </div>

          {/* Services Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Services Comparison</h3>
            <div className="space-y-3">
              {customer.services?.map((svc, idx) => (
                <div key={idx} className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {svc.difference === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                      <span className="font-medium text-slate-900">{svc.setting.service_name}</span>
                      <Badge variant="outline" className="text-xs">{svc.setting.service_type}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={cn(
                        "font-medium",
                        svc.profit >= 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        ${svc.profit?.toFixed(2)} profit
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* PSA Side */}
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 font-medium mb-2">HaloPSA (What We Bill)</p>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-blue-900">{svc.psaQty}</span>
                        <span className="text-sm text-blue-700">${svc.psaRevenue?.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Vendor Side */}
                    <div className={cn(
                      "rounded-lg p-3",
                      svc.difference === 0 ? "bg-emerald-50" :
                      svc.difference > 0 ? "bg-red-50" : "bg-amber-50"
                    )}>
                      <p className={cn(
                        "text-xs font-medium mb-2",
                        svc.difference === 0 ? "text-emerald-600" :
                        svc.difference > 0 ? "text-red-600" : "text-amber-600"
                      )}>
                        Vendor API (What We Pay)
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-2xl font-bold",
                            svc.difference === 0 ? "text-emerald-900" :
                            svc.difference > 0 ? "text-red-900" : "text-amber-900"
                          )}>{svc.vendorQty}</span>
                          {svc.difference !== 0 && (
                            <span className={cn(
                              "text-sm",
                              svc.difference > 0 ? "text-red-600" : "text-amber-600"
                            )}>
                              ({svc.difference > 0 ? '+' : ''}{svc.difference})
                            </span>
                          )}
                        </div>
                        <span className={cn(
                          "text-sm",
                          svc.difference === 0 ? "text-emerald-700" :
                          svc.difference > 0 ? "text-red-700" : "text-amber-700"
                        )}>${svc.vendorCost?.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {svc.difference !== 0 && (
                    <div className={cn(
                      "mt-3 p-2 rounded text-sm",
                      svc.difference > 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {svc.difference > 0 ? (
                        <>⚠️ Under-billing: You're paying for {Math.abs(svc.difference)} more than you're billing</>
                      ) : (
                        <>📈 Over-billing: You're billing {Math.abs(svc.difference)} more than you're paying for</>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {(!customer.services || customer.services.length === 0) && (
                <div className="text-center py-8 text-slate-500 border rounded-lg">
                  No configured services found for this customer.
                  <br />
                  <span className="text-sm">Configure services in Loot Settings to start tracking.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
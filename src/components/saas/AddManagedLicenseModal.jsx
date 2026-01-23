import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from 'lucide-react';

export default function AddManagedLicenseModal({ open, onClose, onSave, softwareName }) {
  const [form, setForm] = useState({
    license_type: '',
    quantity: 0,
    cost_per_license: 0,
    billing_cycle: 'monthly',
    renewal_date: '',
    card_last_four: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      total_cost: form.quantity * form.cost_per_license
    });
    setForm({
      license_type: '',
      quantity: 1,
      cost_per_license: 0,
      billing_cycle: 'monthly',
      renewal_date: '',
      card_last_four: ''
    });
  };

  const totalCost = form.quantity * form.cost_per_license;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Add Managed License
          </DialogTitle>
          <p className="text-sm text-slate-500">for {softwareName}</p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* License Type */}
          <div>
            <Label>License Type</Label>
            <Input
              value={form.license_type}
              onChange={(e) => setForm({ ...form, license_type: e.target.value })}
              placeholder="e.g., Business Basic, Pro, E3"
              className="mt-1"
            />
          </div>

          {/* Seats & Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Seats *</Label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>Cost per Seat ({form.billing_cycle === 'monthly' ? '$/mo' : form.billing_cycle === 'annually' ? '$/yr' : '$'})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.cost_per_license}
                onChange={(e) => setForm({ ...form, cost_per_license: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
          </div>

          {totalCost > 0 && (
            <div className="bg-blue-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {form.billing_cycle === 'monthly' ? 'Total Monthly Cost' : form.billing_cycle === 'annually' ? 'Total Annual Cost' : 'Total Cost (Lifetime)'}
              </span>
              <span className="text-lg font-bold text-blue-900">${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Billing Info */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-sm font-medium text-slate-700">Billing Information</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Billing Cycle</Label>
                <Select 
                  value={form.billing_cycle} 
                  onValueChange={(v) => setForm({ ...form, billing_cycle: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Renewal Date</Label>
                <Input
                  type="date"
                  value={form.renewal_date}
                  onChange={(e) => setForm({ ...form, renewal_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Card on File (last 4 digits)</Label>
              <Input
                value={form.card_last_four}
                onChange={(e) => setForm({ ...form, card_last_four: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                placeholder="1234"
                maxLength={4}
                className="mt-1 w-24"
              />
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Building2 className="w-4 h-4" />
              Add Managed License
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
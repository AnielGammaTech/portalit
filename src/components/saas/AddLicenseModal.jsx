import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AddLicenseModal({ open, onClose, onSave, customerId }) {
  const [form, setForm] = useState({
    application_name: '',
    vendor: '',
    license_type: '',
    quantity: 1,
    cost_per_license: 0,
    billing_cycle: 'monthly',
    status: 'active'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      customer_id: customerId,
      total_cost: form.quantity * form.cost_per_license,
      assigned_users: 0,
      source: 'manual'
    });
    setForm({
      application_name: '',
      vendor: '',
      license_type: '',
      quantity: 1,
      cost_per_license: 0,
      billing_cycle: 'monthly',
      status: 'active'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add SaaS License</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Application Name *</Label>
            <Input
              value={form.application_name}
              onChange={(e) => setForm({ ...form, application_name: e.target.value })}
              placeholder="e.g., Microsoft 365"
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vendor</Label>
              <Input
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="e.g., Microsoft"
              />
            </div>
            <div>
              <Label>License Type</Label>
              <Input
                value={form.license_type}
                onChange={(e) => setForm({ ...form, license_type: e.target.value })}
                placeholder="e.g., Business Basic"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Seats *</Label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                required
              />
            </div>
            <div>
              <Label>Cost per Seat</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.cost_per_license}
                onChange={(e) => setForm({ ...form, cost_per_license: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
          </div>
          
          <div>
            <Label>Billing Cycle</Label>
            <Select 
              value={form.billing_cycle} 
              onValueChange={(v) => setForm({ ...form, billing_cycle: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
              Add License
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
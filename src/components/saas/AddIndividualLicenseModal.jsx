import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from 'lucide-react';

export default function AddIndividualLicenseModal({ open, onClose, onSave, softwareName, contacts = [] }) {
  const [form, setForm] = useState({
    contact_id: '',
    license_type: '',
    cost_per_license: 0,
    renewal_date: '',
    card_last_four: '',
    notes: ''
  });

  const selectedContact = contacts.find(c => c.id === form.contact_id);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      contact_name: selectedContact?.full_name || ''
    });
    setForm({
      contact_id: '',
      license_type: '',
      cost_per_license: 0,
      renewal_date: '',
      card_last_four: '',
      notes: ''
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600" />
            Add Individual License
          </DialogTitle>
          <p className="text-sm text-slate-500">for {softwareName}</p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Selection */}
          <div>
            <Label>Assign to User *</Label>
            <Select 
              value={form.contact_id} 
              onValueChange={(v) => setForm({ ...form, contact_id: v })}
              required
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map(contact => (
                  <SelectItem key={contact.id} value={contact.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-medium">
                        {contact.full_name?.charAt(0) || '?'}
                      </div>
                      <span>{contact.full_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* License Type */}
          <div>
            <Label>License Type</Label>
            <Input
              value={form.license_type}
              onChange={(e) => setForm({ ...form, license_type: e.target.value })}
              placeholder="e.g., Pro, Basic, Premium"
              className="mt-1"
            />
          </div>

          {/* Cost */}
          <div>
            <Label>Monthly Cost ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.cost_per_license}
              onChange={(e) => setForm({ ...form, cost_per_license: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              className="mt-1 w-32"
            />
          </div>

          {/* Billing Info */}
          <div className="space-y-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="text-sm font-medium text-emerald-700">Billing Information</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Renewal Date</Label>
                <Input
                  type="date"
                  value={form.renewal_date}
                  onChange={(e) => setForm({ ...form, renewal_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Card (last 4 digits)</Label>
                <Input
                  value={form.card_last_four}
                  onChange={(e) => setForm({ ...form, card_last_four: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="1234"
                  maxLength={4}
                  className="mt-1 w-24"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any notes..."
              className="mt-1"
            />
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              disabled={!form.contact_id}
            >
              <User className="w-4 h-4" />
              Add License
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
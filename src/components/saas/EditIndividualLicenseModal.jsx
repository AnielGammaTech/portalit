import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EditIndividualLicenseModal({ open, onClose, assignment, contact, onSave }) {
  const [formData, setFormData] = useState({
    cost_per_license: '',
    renewal_date: '',
    card_last_four: '',
    license_type: '',
    notes: ''
  });

  useEffect(() => {
    if (assignment) {
      setFormData({
        cost_per_license: assignment.cost_per_license || '',
        renewal_date: assignment.renewal_date || '',
        card_last_four: assignment.card_last_four || '',
        license_type: assignment.license_type || '',
        notes: assignment.notes || ''
      });
    }
  }, [assignment]);

  const handleSave = () => {
    onSave(assignment.id, {
      cost_per_license: formData.cost_per_license ? parseFloat(formData.cost_per_license) : null,
      renewal_date: formData.renewal_date || null,
      card_last_four: formData.card_last_four || null,
      license_type: formData.license_type || null,
      notes: formData.notes || null
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit License for {contact?.full_name || 'User'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label>License Type</Label>
            <Input
              placeholder="e.g., Pro, Business, Enterprise"
              value={formData.license_type}
              onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Monthly Cost ($)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.cost_per_license}
              onChange={(e) => setFormData({ ...formData, cost_per_license: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Renewal Date</Label>
            <Input
              type="date"
              value={formData.renewal_date}
              onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
            />
          </div>
          
          <div>
            <Label>Card Last 4 Digits</Label>
            <Input
              maxLength={4}
              placeholder="1234"
              value={formData.card_last_four}
              onChange={(e) => setFormData({ ...formData, card_last_four: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          
          <div>
            <Label>Notes</Label>
            <Input
              placeholder="Optional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
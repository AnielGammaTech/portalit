import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, DollarSign, Calendar, CreditCard, FileText, Tag } from 'lucide-react';

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
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header with user info */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-semibold">
              {contact?.full_name?.charAt(0) || 'U'}
            </div>
            <div>
              <h2 className="font-semibold text-lg">{contact?.full_name || 'User'}</h2>
              <p className="text-emerald-100 text-sm">{contact?.email || 'Edit license details'}</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-5">
          {/* License Type & Cost - Two columns */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                License Type
              </Label>
              <Input
                placeholder="Pro, Business..."
                value={formData.license_type}
                onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                className="h-10"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Monthly Cost
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.cost_per_license}
                  onChange={(e) => setFormData({ ...formData, cost_per_license: e.target.value })}
                  className="h-10 pl-7"
                />
              </div>
            </div>
          </div>

          {/* Renewal & Payment - Two columns */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Renewal Date
              </Label>
              <Input
                type="date"
                value={formData.renewal_date}
                onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                className="h-10"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                Card (Last 4)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">••••</span>
                <Input
                  maxLength={4}
                  placeholder="1234"
                  value={formData.card_last_four}
                  onChange={(e) => setFormData({ ...formData, card_last_four: e.target.value.replace(/\D/g, '') })}
                  className="h-10 pl-12"
                />
              </div>
            </div>
          </div>
          
          {/* Notes - Full width */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Notes
            </Label>
            <Textarea
              placeholder="Add any notes about this license..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="resize-none h-20"
            />
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
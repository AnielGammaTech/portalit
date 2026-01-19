import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from 'lucide-react';

export default function AddContactModal({ open, onClose, onSave, customerId }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    title: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      customer_id: customerId,
      source: 'manual',
      is_primary: false
    });
    setForm({ full_name: '', email: '', phone: '', title: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-purple-600" />
            Add Team Member
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Full Name *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="John Doe"
              required
              className="mt-1"
            />
          </div>
          
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="john@company.com"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 (555) 123-4567"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label>Job Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Manager, Developer"
              className="mt-1"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 gap-2">
              <UserPlus className="w-4 h-4" />
              Add Member
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState, useMemo } from "react";
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AddUserLicenseModal({ open, onClose, license, contacts = [], onComplete }) {
  const [contactId, setContactId] = useState("");
  const [licenseType, setLicenseType] = useState(license?.license_type || "");
  const [costPerLicense, setCostPerLicense] = useState(license?.cost_per_license || "");
  const [renewalDate, setRenewalDate] = useState("");
  const [cardLastFour, setCardLastFour] = useState("");
  const [increaseSeat, setIncreaseSeat] = useState(true);
  const [saving, setSaving] = useState(false);

  const isPerUser = license?.management_type === 'per_user';

  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [contacts]);

  const handleSubmit = async () => {
    if (!contactId || !license?.id) return;
    setSaving(true);
    try {
      // Update license type if changed (optional)
      const updates = {};
      if (licenseType && licenseType !== license.license_type) {
        updates.license_type = licenseType;
      }

      if (!isPerUser) {
        // Managed: optionally increase seat, then assign
        if (increaseSeat) {
          const newQuantity = (license.quantity || 0) + 1;
          updates.quantity = newQuantity;
          if (license.cost_per_license > 0) {
            updates.total_cost = newQuantity * (license.cost_per_license || 0);
          }
        }
        if (Object.keys(updates).length > 0) {
          await base44.entities.SaaSLicense.update(license.id, updates);
        }

        await base44.entities.LicenseAssignment.create({
          license_id: license.id,
          contact_id: contactId,
          customer_id: license.customer_id,
          assigned_date: new Date().toISOString().split('T')[0],
          status: 'active'
        });

        await base44.entities.SaaSLicense.update(license.id, {
          assigned_users: (license.assigned_users || 0) + 1
        });
      } else {
        // Per-user: create assignment with billing details
        if (Object.keys(updates).length > 0) {
          await base44.entities.SaaSLicense.update(license.id, updates);
        }

        await base44.entities.LicenseAssignment.create({
          license_id: license.id,
          contact_id: contactId,
          customer_id: license.customer_id,
          assigned_date: new Date().toISOString().split('T')[0],
          status: 'active',
          renewal_date: renewalDate || undefined,
          card_last_four: cardLastFour || undefined,
          cost_per_license: costPerLicense ? Number(costPerLicense) : undefined
        });

        await base44.entities.SaaSLicense.update(license.id, {
          assigned_users: (license.assigned_users || 0) + 1
        });
      }

      onComplete?.();
      onClose?.();
    } catch (e) {
      console.error(e);
      // Let the error bubble for platform to capture; optionally could add toast here.
      throw e;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && (v ? null : onClose?.())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add User License</DialogTitle>
          <DialogDescription>
            Select a user, confirm license type, and we will assign the license{!isPerUser ? ' (and add a seat if needed)' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Contact */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Assign to</label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a user" />
              </SelectTrigger>
              <SelectContent>
                {sortedContacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name} {c.email ? `· ${c.email}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* License type */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">License type</label>
            <Input value={licenseType} onChange={(e) => setLicenseType(e.target.value)} placeholder="e.g., E3, Business Basic" />
          </div>

          {/* Per-user billing fields */}
          {isPerUser && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Cost / month</label>
                <Input type="number" step="0.01" value={costPerLicense} onChange={(e) => setCostPerLicense(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Renewal date</label>
                <Input type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Card last 4</label>
                <Input maxLength={4} value={cardLastFour} onChange={(e) => setCardLastFour(e.target.value.replace(/[^0-9]/g, '').slice(0,4))} placeholder="1234" />
              </div>
            </div>
          )}

          {/* Managed: increase seat */}
          {!isPerUser && (
            <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
              <input type="checkbox" checked={increaseSeat} onChange={(e) => setIncreaseSeat(e.target.checked)} />
              Increase seats by 1 before assignment
            </label>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!contactId || saving} className="bg-purple-600 hover:bg-purple-700">
              {saving ? 'Adding…' : 'Add License'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
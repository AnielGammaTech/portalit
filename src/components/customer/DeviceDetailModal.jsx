import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Monitor,
  Laptop,
  Server,
  Wifi,
  Printer,
  HardDrive,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, safeFormatDate } from "@/lib/utils";


const deviceIcons = {
  desktop: Monitor,
  laptop: Laptop,
  server: Server,
  network: Wifi,
  printer: Printer,
  other: HardDrive
};

const statusConfig = {
  online: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'Online' },
  offline: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Offline' },
  unknown: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Unknown' }
};

export default function DeviceDetailModal({ device, open, onClose, customerId }) {
  const [notes, setNotes] = useState('');
  const [assignedContactId, setAssignedContactId] = useState('');
  const [saving, setSaving] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', customerId],
    queryFn: () => client.entities.Contact.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  useEffect(() => {
    if (device) {
      setNotes(device.notes || '');
      setAssignedContactId(device.assigned_contact_id || '');
    }
  }, [device]);

  if (!device) return null;

  const DeviceIcon = deviceIcons[device.device_type] || Monitor;
  const status = statusConfig[device.status] || statusConfig.unknown;
  const StatusIcon = status.icon;

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.entities.Device.update(device.id, {
        notes,
        assigned_contact_id: assignedContactId || null
      });
      toast.success('Device updated');
      queryClient.invalidateQueries({ queryKey: ['devices', customerId] });
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const assignedContact = contacts.find(c => c.id === assignedContactId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", status.bg)}>
              <DeviceIcon className={cn("w-5 h-5", status.color)} />
            </div>
            <div>
              <span>{device.hostname}</span>
              <Badge className={cn(
                "ml-2 text-xs",
                device.status === 'online' && "bg-emerald-100 text-emerald-700",
                device.status === 'offline' && "bg-red-100 text-red-700",
                device.status === 'unknown' && "bg-slate-100 text-slate-600"
              )}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Device Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Type</p>
              <p className="font-medium text-slate-900 capitalize">{device.device_type}</p>
            </div>
            <div>
              <p className="text-slate-500">Operating System</p>
              <p className="font-medium text-slate-900">{device.operating_system || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">IP Address</p>
              <p className="font-medium text-slate-900">{device.ip_address || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">MAC Address</p>
              <p className="font-medium text-slate-900">{device.mac_address || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Manufacturer</p>
              <p className="font-medium text-slate-900">{device.manufacturer || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Model</p>
              <p className="font-medium text-slate-900">{device.model || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Serial Number</p>
              <p className="font-medium text-slate-900 font-mono text-xs">{device.serial_number || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Last Seen</p>
              <p className="font-medium text-slate-900">
                {device.last_seen ? safeFormatDate(device.last_seen, 'MMM d, yyyy h:mm a') : '—'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500">Last User</p>
              <p className="font-medium text-slate-900 flex items-center gap-2">
                {device.last_user ? (
                  <>
                    <User className="w-4 h-4 text-slate-400" />
                    {device.last_user}
                  </>
                ) : '—'}
              </p>
            </div>
          </div>

          {/* Assign Contact */}
          <div className="space-y-2">
            <Label>Assign to Contact</Label>
            <Select value={assignedContactId} onValueChange={setAssignedContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a contact..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Unassigned</SelectItem>
                {contacts.map(contact => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.full_name} {contact.email ? `(${contact.email})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Add internal notes about this device..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
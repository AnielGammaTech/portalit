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
  Save,
  Info,
  Network,
  Fingerprint,
  CalendarDays,
  Building2,
  Activity,
  FileText
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

const KNOWN_DEVICE_FIELDS = new Set([
  'id', 'customer_id', 'name', 'hostname', 'device_type', 'operating_system', 'os_version',
  'serial_number', 'manufacturer', 'model', 'status', 'online_status', 'last_seen',
  'external_id', 'source', 'datto_site_id', 'datto_site_uid', 'ip_address', 'mac_address',
  'notes', 'assigned_contact_id', 'assigned_user_id', 'last_user', 'created_date', 'updated_date',
]);

function isPresent(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function formatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatValue(value) {
  if (!isPresent(value)) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function DetailItem({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1 text-sm font-medium text-slate-900 break-words", mono && "font-mono text-xs")}>
        {formatValue(value)}
      </p>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      </div>
      {children}
    </section>
  );
}

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
      setAssignedContactId(device.assigned_contact_id || '__unassigned__');
    }
  }, [device]);

  if (!device) return null;

  const DeviceIcon = deviceIcons[device.device_type] || Monitor;
  const status = statusConfig[device.status] || statusConfig.unknown;
  const StatusIcon = status.icon;

  const handleSave = async () => {
    setSaving(true);
    try {
      const contactToSave = assignedContactId === '__unassigned__' ? null : assignedContactId;
      await client.entities.Device.update(device.id, {
        notes,
        assigned_contact_id: contactToSave,
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
  const extraFields = Object.entries(device)
    .filter(([key, value]) => !KNOWN_DEVICE_FIELDS.has(key) && isPresent(value))
    .slice(0, 16);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 pr-8">
            <div className={cn("w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0", status.bg)}>
              <DeviceIcon className={cn("w-5 h-5", status.color)} />
            </div>
            <div className="min-w-0">
              <span className="block truncate">{device.hostname || device.name || 'Device'}</span>
              <Badge className={cn(
                "mt-1 text-xs",
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section icon={Info} title="Device">
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="Hostname" value={device.hostname || device.name} />
                <DetailItem label="Type" value={device.device_type} />
                <DetailItem label="Status" value={status.label} />
                <DetailItem label="Online Status" value={device.online_status} />
              </div>
            </Section>

            <Section icon={HardDrive} title="Hardware">
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="Manufacturer" value={device.manufacturer} />
                <DetailItem label="Model" value={device.model} />
                <DetailItem label="Serial Number" value={device.serial_number} mono />
                <DetailItem label="Source" value={device.source} />
              </div>
            </Section>

            <Section icon={Network} title="Network">
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="IP Address" value={device.ip_address} mono />
                <DetailItem label="MAC Address" value={device.mac_address} mono />
                <DetailItem label="Datto Site ID" value={device.datto_site_id} mono />
                <DetailItem label="Datto Site UID" value={device.datto_site_uid} mono />
              </div>
            </Section>

            <Section icon={Building2} title="Operating System">
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="OS" value={device.operating_system} />
                <DetailItem label="OS Version" value={device.os_version} />
                <DetailItem label="Last User" value={device.last_user} />
                <DetailItem label="Assigned Contact" value={assignedContact?.full_name || assignedContact?.email} />
              </div>
            </Section>

            <Section icon={Fingerprint} title="Identifiers">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem label="PortalIT ID" value={device.id} mono />
                <DetailItem label="Vendor ID" value={device.external_id} mono />
              </div>
            </Section>

            <Section icon={CalendarDays} title="Timeline">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem label="Last Seen" value={device.last_seen ? safeFormatDate(device.last_seen, 'MMM d, yyyy h:mm a') : ''} />
                <DetailItem label="Last Updated" value={device.updated_date ? safeFormatDate(device.updated_date, 'MMM d, yyyy h:mm a') : ''} />
                <DetailItem label="Created" value={device.created_date ? safeFormatDate(device.created_date, 'MMM d, yyyy h:mm a') : ''} />
              </div>
            </Section>
          </div>

          {extraFields.length > 0 && (
            <Section icon={Activity} title="Additional Synced Data">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {extraFields.map(([key, value]) => (
                  <DetailItem
                    key={key}
                    label={formatLabel(key)}
                    value={value}
                    mono={typeof value === 'object'}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Assign Contact */}
          <Section icon={User} title="Owner">
            <div className="space-y-2">
            <Label>Assign to Contact</Label>
            <Select value={assignedContactId} onValueChange={setAssignedContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a contact..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {contacts.map(contact => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.full_name} {contact.email ? `(${contact.email})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
          </Section>

          {/* Notes */}
          <Section icon={FileText} title="Notes">
            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea
                placeholder="Add internal notes about this device..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </Section>

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

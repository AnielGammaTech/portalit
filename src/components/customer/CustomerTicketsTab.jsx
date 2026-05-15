import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  KeyRound,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Monitor,
  Paperclip,
  Search,
  Send,
  ShoppingCart,
  Sparkles,
  UserCircle,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { client } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn, safeFormatDate } from '@/lib/utils';

const REQUEST_TYPES = [
  {
    key: 'support',
    label: 'Report a problem',
    shortLabel: 'Problem',
    description: 'Technical issue, error, or something not working.',
    icon: LifeBuoy,
    tone: 'blue',
    eta: 'Same day',
    subjectPlaceholder: 'Printer will not print, VPN not connecting, application error...',
  },
  {
    key: 'onboarding',
    label: 'Onboard team member',
    shortLabel: 'Onboarding',
    description: 'New employee account, licenses, equipment, and access.',
    icon: UserPlus,
    tone: 'emerald',
    eta: '2-3 days',
    subjectPlaceholder: 'New user for Finance starting Monday',
  },
  {
    key: 'offboarding',
    label: 'Deactivate user',
    shortLabel: 'Offboarding',
    description: 'Disable access, forward mail, and protect company data.',
    icon: UserMinus,
    tone: 'rose',
    eta: 'Scheduled',
    subjectPlaceholder: 'Offboard user after final day',
  },
  {
    key: 'access_change',
    label: 'Access change',
    shortLabel: 'Access',
    description: 'Folder, mailbox, app, group, or permission updates.',
    icon: KeyRound,
    tone: 'violet',
    eta: '1-2 days',
    subjectPlaceholder: 'Give user access to shared finance folder',
  },
  {
    key: 'quote',
    label: 'Quote or purchase',
    shortLabel: 'Quote',
    description: 'Hardware, software, licensing, or project estimate.',
    icon: ShoppingCart,
    tone: 'amber',
    eta: 'Review',
    subjectPlaceholder: 'Quote for two laptops and docking stations',
  },
];

const REQUEST_BY_KEY = Object.fromEntries(REQUEST_TYPES.map(type => [type.key, type]));

const TONE_CLASSES = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

const EQUIPMENT_OPTIONS = ['Laptop', 'Desktop', 'Docking station', 'Monitor', 'Phone', 'Headset'];
const ACCESS_OPTIONS = ['Microsoft 365', 'Shared mailbox', 'Teams group', 'VPN', 'File share', 'Line-of-business app'];

function normalized(value) {
  return String(value || '').toLowerCase();
}

function customerStatus(status) {
  const lower = normalized(status);
  if (['closed', 'resolved', 'completed'].includes(lower)) return { label: 'Completed', tone: 'emerald' };
  if (['waiting', 'awaiting_customer', 'customer_waiting'].includes(lower)) return { label: 'Your input needed', tone: 'amber' };
  if (['open', 'new', 'in_progress', 'active', 'pending'].includes(lower)) return { label: 'In progress', tone: 'blue' };
  return { label: status || 'Request', tone: 'slate' };
}

function StatusBadge({ status }) {
  const view = customerStatus(status);
  return (
    <Badge variant="outline" className={cn('gap-1.5', TONE_CLASSES[view.tone] || TONE_CLASSES.slate)}>
      {view.tone === 'emerald' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {view.label}
    </Badge>
  );
}

function ticketDateInfo(ticket) {
  const status = customerStatus(ticket.status);
  if (status.tone === 'emerald') {
    const completedDate = ticket.closed_at || ticket.resolved_at || ticket.created_date;
    return { label: 'Completed', value: completedDate, sortDate: completedDate || ticket.created_date || ticket.updated_date };
  }
  if (status.tone === 'amber') {
    const waitingDate = ticket.updated_date || ticket.created_date;
    return { label: 'Waiting since', value: waitingDate, sortDate: waitingDate };
  }
  const openedDate = ticket.date_opened || ticket.created_date || ticket.updated_date;
  return { label: 'Opened', value: openedDate, sortDate: openedDate };
}

function requestTypeFromTicket(ticket) {
  const type = normalized(ticket.ticket_type);
  if (type.includes('onboard')) return REQUEST_BY_KEY.onboarding;
  if (type.includes('offboard')) return REQUEST_BY_KEY.offboarding;
  if (type.includes('access')) return REQUEST_BY_KEY.access_change;
  if (type.includes('quote') || type.includes('purchase')) return REQUEST_BY_KEY.quote;
  return REQUEST_BY_KEY.support;
}

function Field({ label, children, required = false }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}{required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

function FormSection({ title, description, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function makeInitialForm(typeKey) {
  return {
    summary: '',
    priority: typeKey === 'offboarding' ? 'high' : 'medium',
    notes: '',
    fields: {
      affected_user: '',
      affected_user_ref: '',
      affected_contact_id: '',
      affected_user_email: '',
      affected_user_halo_id: '',
      issue: '',
      impact: 'single_user',
      device_or_app: '',
      device_ref: '',
      device_name: '',
      device_ip: '',
      device_serial: '',
      device_source: '',
      employee_name: '',
      employee_user_ref: '',
      employee_contact_id: '',
      employee_email: '',
      employee_halo_id: '',
      job_title: '',
      department: '',
      start_date: '',
      manager_name: '',
      manager_user_ref: '',
      manager_contact_id: '',
      manager_email: '',
      equipment_needed: [],
      access_needed: [],
      last_day: '',
      disable_timing: 'end_of_day',
      forward_email_to: '',
      retain_mailbox: 'yes',
      access_items: '',
      business_reason: '',
      approval_contact: '',
      approval_contact_id: '',
      approval_contact_email: '',
      approval_contact_ref: '',
      due_date: '',
      item_needed: '',
      quantity: '',
      budget: '',
      needed_by: '',
    },
  };
}

function CheckboxGroup({ options, value = [], onChange }) {
  const current = Array.isArray(value) ? value : [];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map(option => (
        <label key={option} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <Checkbox
            checked={current.includes(option)}
            onCheckedChange={(checked) => {
              onChange(checked === true
                ? [...current, option]
                : current.filter(item => item !== option));
            }}
          />
          {option}
        </label>
      ))}
    </div>
  );
}

function contactDisplayName(contact) {
  return contact?.full_name ||
    contact?.name ||
    [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') ||
    contact?.email ||
    'Unnamed user';
}

function cippDisplayName(user) {
  return user?.display_name || user?.user_principal_name || user?.mail || 'Microsoft 365 user';
}

function buildUserOptions(contacts = [], cippUsers = []) {
  const options = [];
  const seenEmails = new Map();

  (contacts || []).forEach(contact => {
    const email = String(contact.email || '').trim().toLowerCase();
    const option = {
      value: `contact:${contact.id}`,
      label: contactDisplayName(contact),
      sub: [contact.email, contact.title].filter(Boolean).join(' - '),
      source: 'HaloPSA',
      contactId: contact.id,
      haloId: contact.halopsa_id || contact.external_id || '',
      email: contact.email || '',
      title: contact.title || '',
      department: contact.department || '',
    };
    options.push(option);
    if (email) seenEmails.set(email, option);
  });

  (cippUsers || []).forEach(cippUser => {
    const email = String(cippUser.mail || cippUser.user_principal_name || '').trim().toLowerCase();
    const existing = email ? seenEmails.get(email) : null;
    if (existing) {
      existing.title ||= cippUser.job_title || '';
      existing.department ||= cippUser.department || '';
      if (cippUser.job_title && !existing.sub.includes(cippUser.job_title)) {
        existing.sub = [existing.email, cippUser.job_title].filter(Boolean).join(' - ');
      }
      return;
    }

    options.push({
      value: `cipp:${cippUser.id}`,
      label: cippDisplayName(cippUser),
      sub: [cippUser.mail || cippUser.user_principal_name, cippUser.job_title || cippUser.department].filter(Boolean).join(' - '),
      source: 'M365',
      contactId: '',
      haloId: '',
      email: cippUser.mail || cippUser.user_principal_name || '',
      title: cippUser.job_title || '',
      department: cippUser.department || '',
    });
  });

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function buildDeviceOptions(devices = []) {
  return (devices || [])
    .map(device => {
      const name = device.name || device.hostname || device.serial_number || device.external_id || 'Unnamed device';
      return {
        value: `device:${device.id}`,
        label: name,
        sub: [device.device_type, device.operating_system, device.ip_address].filter(Boolean).join(' - '),
        source: device.source || '',
        name,
        ip: device.ip_address || '',
        serial: device.serial_number || '',
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function LookupSelect({ value, options, placeholder, emptyLabel, onChange }) {
  const hasOptions = options.length > 0;
  return (
    <Select value={value || '__none'} onValueChange={nextValue => onChange(nextValue === '__none' ? '' : nextValue)}>
      <SelectTrigger className="bg-white">
        <SelectValue placeholder={hasOptions ? placeholder : emptyLabel} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="__none">{hasOptions ? placeholder : emptyLabel}</SelectItem>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{option.label}</span>
              {option.sub && <span className="truncate text-xs text-slate-500">{option.sub}</span>}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function formatBytes(size) {
  const number = Number(size);
  if (!Number.isFinite(number) || number <= 0) return '';
  if (number < 1024) return `${number} B`;
  if (number < 1024 * 1024) return `${Math.round(number / 102.4) / 10} KB`;
  return `${Math.round(number / 1024 / 102.4) / 10} MB`;
}

export default function CustomerTicketsTab({
  tickets = [],
  ticketFilter,
  setTicketFilter,
  ticketPage,
  setTicketPage,
  customer,
  contacts = [],
  devices = [],
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [selectedType, setSelectedType] = useState(null);
  const [form, setForm] = useState(makeInitialForm('support'));
  const [submitting, setSubmitting] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [search, setSearch] = useState('');

  const { data: cippUsers = [] } = useQuery({
    queryKey: ['cipp-users', customer?.id],
    queryFn: () => client.entities.CIPPUser.filter({ customer_id: customer.id }),
    enabled: !!customer?.id,
    staleTime: 1000 * 60 * 5,
  });

  const userOptions = useMemo(() => buildUserOptions(contacts, cippUsers), [contacts, cippUsers]);
  const deviceOptions = useMemo(() => buildDeviceOptions(devices), [devices]);
  const usersByValue = useMemo(() => new Map(userOptions.map(option => [option.value, option])), [userOptions]);
  const devicesByValue = useMemo(() => new Map(deviceOptions.map(option => [option.value, option])), [deviceOptions]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tickets
      .filter(ticket => ticketFilter === 'all' || normalized(ticket.status) === ticketFilter)
      .filter(ticket => {
        if (!query) return true;
        return [
          ticket.external_id,
          ticket.ticket_number,
          ticket.subject,
          ticket.summary,
          ticket.ticket_type,
          ticket.contact_name,
        ].some(value => String(value || '').toLowerCase().includes(query));
      })
      .sort((a, b) => new Date(ticketDateInfo(b).sortDate || 0) - new Date(ticketDateInfo(a).sortDate || 0));
  }, [search, ticketFilter, tickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / 10));
  const visibleTickets = filteredTickets.slice((ticketPage - 1) * 10, ticketPage * 10);
  const inProgress = tickets.filter(ticket => ['open', 'new', 'in_progress', 'active', 'pending'].includes(normalized(ticket.status))).length;
  const inputNeeded = tickets.filter(ticket => ['waiting', 'awaiting_customer', 'customer_waiting'].includes(normalized(ticket.status))).length;
  const completed = tickets.filter(ticket => ['closed', 'resolved', 'completed'].includes(normalized(ticket.status))).length;

  const openRequestForm = (type) => {
    setSelectedType(type);
    setForm(makeInitialForm(type.key));
    setAttachments([]);
  };

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
  };

  const applyUserSelection = (fieldGroup, value) => {
    const selected = usersByValue.get(value);
    const emailKey = fieldGroup === 'affected' ? 'affected_user_email' : `${fieldGroup}_email`;
    const haloKey = fieldGroup === 'affected' ? 'affected_user_halo_id' : `${fieldGroup}_halo_id`;
    const updates = {
      [`${fieldGroup}_user_ref`]: value,
      [`${fieldGroup}_contact_id`]: selected?.contactId || '',
      [emailKey]: selected?.email || '',
      [haloKey]: selected?.haloId || '',
    };

    if (fieldGroup === 'affected') {
      updates.affected_user = selected?.label || '';
    } else if (fieldGroup === 'employee') {
      updates.employee_name = selected?.label || '';
      updates.job_title = selected?.title || form.fields.job_title;
      updates.department = selected?.department || form.fields.department;
    } else if (fieldGroup === 'manager') {
      updates.manager_name = selected?.label || '';
    } else if (fieldGroup === 'approval_contact') {
      updates.approval_contact = selected?.label || '';
      updates.approval_contact_id = selected?.contactId || '';
      updates.approval_contact_email = selected?.email || '';
      updates.approval_contact_ref = value;
    }

    setForm(prev => ({ ...prev, fields: { ...prev.fields, ...updates } }));
  };

  const applyDeviceSelection = (value) => {
    const selected = devicesByValue.get(value);
    setForm(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        device_ref: value,
        device_or_app: selected?.label || '',
        device_name: selected?.name || '',
        device_ip: selected?.ip || '',
        device_serial: selected?.serial || '',
        device_source: selected?.source || '',
      },
    }));
  };

  const uploadFiles = async (files) => {
    const validFiles = Array.from(files || []).filter(Boolean).slice(0, 8 - attachments.length);
    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of validFiles) {
        const { file_url: fileUrl } = await client.integrations.Core.UploadFile({ file });
        setAttachments(prev => [
          ...prev,
          { url: fileUrl, name: file.name || 'Pasted image', type: file.type, size: file.size },
        ]);
      }
      toast.success(validFiles.length === 1 ? 'Attachment added.' : `${validFiles.length} attachments added.`);
    } catch (error) {
      toast.error(error.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageFiles = items
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(Boolean)
      .map(file => (file.name ? file : new File([file], `pasted-${Date.now()}.png`, { type: file.type || 'image/png' })));

    if (imageFiles.length > 0) {
      event.preventDefault();
      uploadFiles(imageFiles);
    }
  };

  const removeAttachment = (url) => {
    setAttachments(prev => prev.filter(attachment => attachment.url !== url));
  };

  const enhanceRequest = async () => {
    if (!selectedType || !customer?.id) return;
    setEnhancing(true);
    try {
      const response = await client.customerRequests.enhance({
        customer_id: customer.id,
        request_type: selectedType.key,
        summary: form.summary,
        fields: form.fields,
        notes: form.notes,
      });
      setForm(prev => ({
        ...prev,
        summary: response.summary || prev.summary,
        notes: response.notes || prev.notes,
      }));
      toast.success('Request wording improved.');
    } catch (error) {
      toast.error(error.message || 'AI enhance is unavailable.');
    } finally {
      setEnhancing(false);
    }
  };

  const submitRequest = async () => {
    if (!selectedType || !customer?.id) return;
    if (!form.summary.trim()) {
      toast.error('Add a short subject for the request.');
      return;
    }

    if (selectedType.key === 'onboarding' && (!form.fields.employee_name || !form.fields.start_date)) {
      toast.error('New user requests need the employee name and start date.');
      return;
    }
    if (selectedType.key === 'offboarding' && (!form.fields.employee_name || !form.fields.last_day)) {
      toast.error('Offboarding requests need the employee name and last day.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await client.customerRequests.create({
        customer_id: customer.id,
        request_type: selectedType.key,
        summary: form.summary,
        priority: form.priority,
        fields: form.fields,
        notes: form.notes,
        attachments,
        requester_name: user?.full_name || user?.email,
        requester_email: user?.email,
      });

      if (response.success) {
        toast.success(response.message || 'Request submitted.');
        if (response.ticket) {
          queryClient.setQueryData(['tickets', customer.id], (old = []) => [response.ticket, ...old]);
        }
        queryClient.invalidateQueries({ queryKey: ['tickets', customer.id] });
        setSelectedType(null);
      } else {
        toast.error(response.error || 'Request could not be submitted.');
      }
    } catch (error) {
      toast.error(error.message || 'Request could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderDynamicFields = () => {
    if (!selectedType) return null;
    switch (selectedType.key) {
      case 'onboarding':
        return (
          <FormSection title="New team member" description="Capture the start date, manager, and access needed for setup.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employee name" required><Input value={form.fields.employee_name} onChange={e => updateField('employee_name', e.target.value)} /></Field>
              <Field label="Start date" required><Input type="date" value={form.fields.start_date} onChange={e => updateField('start_date', e.target.value)} /></Field>
              <Field label="Job title"><Input value={form.fields.job_title} onChange={e => updateField('job_title', e.target.value)} /></Field>
              <Field label="Department"><Input value={form.fields.department} onChange={e => updateField('department', e.target.value)} /></Field>
              <Field label="Manager">
                <LookupSelect
                  value={form.fields.manager_user_ref}
                  options={userOptions}
                  placeholder="Select manager"
                  emptyLabel="No synced users"
                  onChange={value => applyUserSelection('manager', value)}
                />
              </Field>
            </div>
            <Field label="Access needed"><CheckboxGroup options={ACCESS_OPTIONS} value={form.fields.access_needed} onChange={value => updateField('access_needed', value)} /></Field>
            <Field label="Equipment needed"><CheckboxGroup options={EQUIPMENT_OPTIONS} value={form.fields.equipment_needed} onChange={value => updateField('equipment_needed', value)} /></Field>
          </FormSection>
        );
      case 'offboarding':
        return (
          <FormSection title="Account shutdown" description="Select the user from synced customer users so the ticket ties back to the right person.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employee" required>
                <LookupSelect
                  value={form.fields.employee_user_ref}
                  options={userOptions}
                  placeholder="Select employee"
                  emptyLabel="No synced users"
                  onChange={value => applyUserSelection('employee', value)}
                />
              </Field>
              <Field label="Last day" required><Input type="date" value={form.fields.last_day} onChange={e => updateField('last_day', e.target.value)} /></Field>
              <Field label="Disable timing">
                <Select value={form.fields.disable_timing} onValueChange={value => updateField('disable_timing', value)}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediately">Immediately</SelectItem>
                    <SelectItem value="end_of_day">End of final day</SelectItem>
                    <SelectItem value="scheduled">Specific scheduled time in notes</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Mailbox handling">
                <Select value={form.fields.retain_mailbox} onValueChange={value => updateField('retain_mailbox', value)}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Keep mailbox active for now</SelectItem>
                    <SelectItem value="convert_shared">Convert to shared mailbox</SelectItem>
                    <SelectItem value="no">Disable mailbox access</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Forward email to"><Input value={form.fields.forward_email_to} onChange={e => updateField('forward_email_to', e.target.value)} placeholder="Name or email" /></Field>
              <Field label="Manager or approver">
                <LookupSelect
                  value={form.fields.manager_user_ref}
                  options={userOptions}
                  placeholder="Select approver"
                  emptyLabel="No synced users"
                  onChange={value => applyUserSelection('manager', value)}
                />
              </Field>
            </div>
          </FormSection>
        );
      case 'access_change':
        return (
          <FormSection title="Access request" description="Pick the user and describe the permission, app, folder, group, or mailbox change.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="User needing access" required>
                <LookupSelect
                  value={form.fields.employee_user_ref}
                  options={userOptions}
                  placeholder="Select user"
                  emptyLabel="No synced users"
                  onChange={value => applyUserSelection('employee', value)}
                />
              </Field>
              <Field label="Needed by"><Input type="date" value={form.fields.due_date} onChange={e => updateField('due_date', e.target.value)} /></Field>
              <Field label="Approver">
                <LookupSelect
                  value={form.fields.approval_contact_ref}
                  options={userOptions}
                  placeholder="Select approver"
                  emptyLabel="No synced users"
                  onChange={value => applyUserSelection('approval_contact', value)}
                />
              </Field>
            </div>
            <Field label="Access requested" required><Textarea rows={3} value={form.fields.access_items} onChange={e => updateField('access_items', e.target.value)} placeholder="Mailbox, app, folder, security group, VPN, or role..." /></Field>
            <Field label="Business reason"><Textarea rows={3} value={form.fields.business_reason} onChange={e => updateField('business_reason', e.target.value)} /></Field>
          </FormSection>
        );
      case 'quote':
        return (
          <FormSection title="Quote details" description="Tell us what needs to be quoted and when the decision is needed.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Item or service" required><Input value={form.fields.item_needed} onChange={e => updateField('item_needed', e.target.value)} /></Field>
              <Field label="Quantity"><Input value={form.fields.quantity} onChange={e => updateField('quantity', e.target.value)} /></Field>
              <Field label="Needed by"><Input type="date" value={form.fields.needed_by} onChange={e => updateField('needed_by', e.target.value)} /></Field>
              <Field label="Budget or approval note"><Input value={form.fields.budget} onChange={e => updateField('budget', e.target.value)} /></Field>
            </div>
          </FormSection>
        );
      default:
        return (
          <FormSection title="Problem details" description="Select the affected user and device when it applies.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Affected user">
                <LookupSelect
                  value={form.fields.affected_user_ref}
                  options={userOptions}
                  placeholder="Select user"
                  emptyLabel="No synced users"
                  onChange={value => applyUserSelection('affected', value)}
                />
              </Field>
              <Field label="Device">
                <LookupSelect
                  value={form.fields.device_ref}
                  options={deviceOptions}
                  placeholder="Select device"
                  emptyLabel="No synced devices"
                  onChange={applyDeviceSelection}
                />
              </Field>
              <Field label="App or service"><Input value={form.fields.device_or_app} onChange={e => updateField('device_or_app', e.target.value)} placeholder="VPN, printer, Outlook, line-of-business app..." /></Field>
              <Field label="Impact">
                <Select value={form.fields.impact} onValueChange={value => updateField('impact', value)}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_user">One user affected</SelectItem>
                    <SelectItem value="multiple_users">Multiple users affected</SelectItem>
                    <SelectItem value="business_down">Business process stopped</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="What is happening?" required><Textarea rows={4} value={form.fields.issue} onChange={e => updateField('issue', e.target.value)} /></Field>
          </FormSection>
        );
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-950">Helpdesk</h3>
            <p className="text-sm text-slate-500">Choose a category so the support team gets the right details the first time.</p>
          </div>
          <Badge variant="outline" className="bg-slate-50 text-slate-600">Creates HaloPSA ticket</Badge>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
          {REQUEST_TYPES.map(type => {
            const Icon = type.icon;
            return (
              <button
                key={type.key}
                type="button"
                onClick={() => openRequestForm(type)}
                className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', TONE_CLASSES[type.tone])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">{type.eta}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">{type.label}</p>
                <p className="mt-1 min-h-[34px] text-xs leading-5 text-slate-500">{type.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'In progress', value: inProgress, detail: 'being worked', tone: 'blue' },
          { label: 'Your input needed', value: inputNeeded, detail: 'waiting on you', tone: inputNeeded > 0 ? 'amber' : 'slate' },
          { label: 'Completed', value: completed, detail: 'resolved history', tone: 'emerald' },
          { label: 'Visible requests', value: tickets.length, detail: 'portal history', tone: 'slate' },
        ].map(metric => (
          <div key={metric.label} className={cn('rounded-xl border p-4 shadow-sm', TONE_CLASSES[metric.tone])}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{metric.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{metric.value}</p>
            <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-950">Helpdesk history</h3>
            <p className="text-sm text-slate-500">Progress and history sorted by most recent activity.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setTicketPage(1); }}
                placeholder="Search requests"
                className="h-9 w-48 pl-9"
              />
            </div>
            <select
              value={ticketFilter}
              onChange={(event) => {
                setTicketFilter(event.target.value);
                setTicketPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="all">All requests</option>
              <option value="open">In progress</option>
              <option value="in_progress">Currently active</option>
              <option value="waiting">Your input needed</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {visibleTickets.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <MessageSquare className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            <p className="font-medium text-slate-900">No requests to show</p>
            <p className="mt-1 text-sm text-slate-500">Select a request category above when you need help or a change.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleTickets.map(ticket => {
              const dateInfo = ticketDateInfo(ticket);
              const type = requestTypeFromTicket(ticket);
              const TypeIcon = type.icon || HelpCircle;

              return (
                <div key={ticket.id} className="grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_135px_145px_120px] md:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 shrink-0 text-slate-400" />
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {ticket.external_id ? `#${ticket.external_id} - ` : ''}{ticket.subject || ticket.summary || 'Service request'}
                      </p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {ticket.contact_name && (
                        <span className="inline-flex items-center gap-1">
                          <UserCircle className="h-3.5 w-3.5" />
                          {ticket.contact_name}
                        </span>
                      )}
                      <span>{dateInfo.label} {dateInfo.value ? safeFormatDate(dateInfo.value, 'MMM d, yyyy') : '-'}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('w-fit gap-1.5', TONE_CLASSES[type.tone] || TONE_CLASSES.slate)}>
                    <TypeIcon className="h-3 w-3" />
                    {type.shortLabel}
                  </Badge>
                  <div><StatusBadge status={ticket.status} /></div>
                  <div className="text-sm text-slate-600 md:text-right">
                    {ticket.priority ? `${ticket.priority} priority` : 'Standard'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredTickets.length > 10 && (
          <div className="flex items-center justify-center gap-2 border-t border-slate-100 px-5 py-3">
            <Button variant="outline" size="sm" onClick={() => setTicketPage(page => Math.max(1, page - 1))} disabled={ticketPage === 1}>Previous</Button>
            <span className="px-3 text-sm text-slate-600">Page {ticketPage} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setTicketPage(page => Math.min(totalPages, page + 1))} disabled={ticketPage >= totalPages}>Next</Button>
          </div>
        )}
      </section>

      <Dialog open={!!selectedType} onOpenChange={(open) => !open && setSelectedType(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl" onPaste={handlePaste}>
          {selectedType && (
            <>
              <DialogHeader className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 text-left">
                <DialogTitle className="flex items-center gap-3 pr-8 text-lg">
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm', TONE_CLASSES[selectedType.tone])}>
                    {React.createElement(selectedType.icon, { className: 'h-5 w-5' })}
                  </span>
                  <span>
                    {selectedType.label}
                    <span className="mt-0.5 block text-xs font-medium text-slate-500">{selectedType.description}</span>
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 px-5 py-4">
                <FormSection title="Request summary" description="Keep the subject short. Add the real detail below or let AI clean it up after you type.">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
                    <Field label="Subject" required>
                      <Input
                        value={form.summary}
                        onChange={event => setForm(prev => ({ ...prev, summary: event.target.value }))}
                        placeholder={selectedType.subjectPlaceholder}
                        className="bg-white"
                      />
                    </Field>
                    <Field label="Urgency">
                      <Select value={form.priority} onValueChange={value => setForm(prev => ({ ...prev, priority: value }))}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Standard</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </FormSection>

                {renderDynamicFields()}

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Message</p>
                      <p className="text-xs text-slate-500">Paste screenshots here or attach files below.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={enhanceRequest} disabled={enhancing} className="h-8 gap-2">
                      {enhancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      AI enhance
                    </Button>
                  </div>
                  <Textarea
                    rows={5}
                    value={form.notes}
                    onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                    placeholder="Add approval notes, timing, what changed, error text, or anything the team should know."
                    className="bg-white"
                  />
                </div>

                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Attachments</p>
                      <p className="text-xs text-slate-500">Upload files or paste screenshots directly into the form.</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.docx,.xlsx,.txt,.csv"
                      className="hidden"
                      onChange={event => uploadFiles(event.target.files)}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading || attachments.length >= 8} className="h-8 gap-2 bg-white">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                      Attach
                    </Button>
                  </div>
                  {attachments.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {attachments.map(attachment => (
                        <div key={attachment.url} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">{attachment.name}</p>
                            <p className="text-xs text-slate-500">{formatBytes(attachment.size) || attachment.type || 'Attached file'}</p>
                          </div>
                          <button type="button" onClick={() => removeAttachment(attachment.url)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
                  Critical requests should be used only for outages or blocked business operations.
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <Button variant="outline" onClick={() => setSelectedType(null)}>Cancel</Button>
                  <Button onClick={submitRequest} disabled={submitting} className="gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit request
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

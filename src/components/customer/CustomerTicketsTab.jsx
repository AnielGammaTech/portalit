import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  KeyRound,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Monitor,
  Search,
  Send,
  ShoppingCart,
  UserCircle,
  UserMinus,
  UserPlus,
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

function makeInitialForm(typeKey) {
  return {
    summary: '',
    priority: typeKey === 'offboarding' ? 'high' : 'medium',
    notes: '',
    fields: {
      affected_user: '',
      issue: '',
      impact: 'single_user',
      device_or_app: '',
      employee_name: '',
      job_title: '',
      department: '',
      start_date: '',
      manager_name: '',
      equipment_needed: [],
      access_needed: [],
      last_day: '',
      disable_timing: 'end_of_day',
      forward_email_to: '',
      retain_mailbox: 'yes',
      access_items: '',
      business_reason: '',
      approval_contact: '',
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

export default function CustomerTicketsTab({
  tickets = [],
  ticketFilter,
  setTicketFilter,
  ticketPage,
  setTicketPage,
  customer,
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState(null);
  const [form, setForm] = useState(makeInitialForm('support'));
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

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
  };

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
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
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employee name" required><Input value={form.fields.employee_name} onChange={e => updateField('employee_name', e.target.value)} /></Field>
              <Field label="Start date" required><Input type="date" value={form.fields.start_date} onChange={e => updateField('start_date', e.target.value)} /></Field>
              <Field label="Job title"><Input value={form.fields.job_title} onChange={e => updateField('job_title', e.target.value)} /></Field>
              <Field label="Department"><Input value={form.fields.department} onChange={e => updateField('department', e.target.value)} /></Field>
              <Field label="Manager"><Input value={form.fields.manager_name} onChange={e => updateField('manager_name', e.target.value)} /></Field>
            </div>
            <Field label="Access needed"><CheckboxGroup options={ACCESS_OPTIONS} value={form.fields.access_needed} onChange={value => updateField('access_needed', value)} /></Field>
            <Field label="Equipment needed"><CheckboxGroup options={EQUIPMENT_OPTIONS} value={form.fields.equipment_needed} onChange={value => updateField('equipment_needed', value)} /></Field>
          </>
        );
      case 'offboarding':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Employee name" required><Input value={form.fields.employee_name} onChange={e => updateField('employee_name', e.target.value)} /></Field>
            <Field label="Last day" required><Input type="date" value={form.fields.last_day} onChange={e => updateField('last_day', e.target.value)} /></Field>
            <Field label="Disable timing">
              <Select value={form.fields.disable_timing} onValueChange={value => updateField('disable_timing', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediately">Immediately</SelectItem>
                  <SelectItem value="end_of_day">End of final day</SelectItem>
                  <SelectItem value="scheduled">Specific scheduled time in notes</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Retain mailbox">
              <Select value={form.fields.retain_mailbox} onValueChange={value => updateField('retain_mailbox', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="convert_shared">Convert to shared mailbox</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Forward email to"><Input value={form.fields.forward_email_to} onChange={e => updateField('forward_email_to', e.target.value)} /></Field>
            <Field label="Manager or approver"><Input value={form.fields.manager_name} onChange={e => updateField('manager_name', e.target.value)} /></Field>
          </div>
        );
      case 'access_change':
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="User needing access" required><Input value={form.fields.employee_name} onChange={e => updateField('employee_name', e.target.value)} /></Field>
              <Field label="Needed by"><Input type="date" value={form.fields.due_date} onChange={e => updateField('due_date', e.target.value)} /></Field>
              <Field label="Approver"><Input value={form.fields.approval_contact} onChange={e => updateField('approval_contact', e.target.value)} /></Field>
            </div>
            <Field label="Access requested" required><Textarea rows={3} value={form.fields.access_items} onChange={e => updateField('access_items', e.target.value)} placeholder="Mailbox, app, folder, security group, VPN, or role..." /></Field>
            <Field label="Business reason"><Textarea rows={3} value={form.fields.business_reason} onChange={e => updateField('business_reason', e.target.value)} /></Field>
          </>
        );
      case 'quote':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Item or service" required><Input value={form.fields.item_needed} onChange={e => updateField('item_needed', e.target.value)} /></Field>
            <Field label="Quantity"><Input value={form.fields.quantity} onChange={e => updateField('quantity', e.target.value)} /></Field>
            <Field label="Needed by"><Input type="date" value={form.fields.needed_by} onChange={e => updateField('needed_by', e.target.value)} /></Field>
            <Field label="Budget or approval note"><Input value={form.fields.budget} onChange={e => updateField('budget', e.target.value)} /></Field>
          </div>
        );
      default:
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Affected user"><Input value={form.fields.affected_user} onChange={e => updateField('affected_user', e.target.value)} /></Field>
              <Field label="Device or app"><Input value={form.fields.device_or_app} onChange={e => updateField('device_or_app', e.target.value)} /></Field>
              <Field label="Impact">
                <Select value={form.fields.impact} onValueChange={value => updateField('impact', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_user">One user affected</SelectItem>
                    <SelectItem value="multiple_users">Multiple users affected</SelectItem>
                    <SelectItem value="business_down">Business process stopped</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="What is happening?" required><Textarea rows={4} value={form.fields.issue} onChange={e => updateField('issue', e.target.value)} /></Field>
          </>
        );
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-950">Requests & support</h3>
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
            <h3 className="font-semibold text-slate-950">Request history</h3>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selectedType && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 pr-8">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', TONE_CLASSES[selectedType.tone])}>
                    {React.createElement(selectedType.icon, { className: 'h-4 w-4' })}
                  </span>
                  {selectedType.label}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
                  <Field label="Subject" required>
                    <Input
                      value={form.summary}
                      onChange={event => setForm(prev => ({ ...prev, summary: event.target.value }))}
                      placeholder={selectedType.subjectPlaceholder}
                    />
                  </Field>
                  <Field label="Urgency">
                    <Select value={form.priority} onValueChange={value => setForm(prev => ({ ...prev, priority: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Standard</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {renderDynamicFields()}

                <Field label="Anything else">
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
                    placeholder="Add approval notes, special timing, screenshots link, or anything the team should know."
                  />
                </Field>

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

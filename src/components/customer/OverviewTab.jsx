import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { 
  Users, 
  DollarSign, 
  FileText, 
  Cloud,
  RefreshCw,
  ChevronRight,
  UserPlus,
  TrendingUp,
  Zap,
  HelpCircle,
  Send,
  Bot,
  ArrowRight,
  Monitor,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import UserDetailModal from './UserDetailModal';
import SupportAssistantChat from './SupportAssistantChat';

const StatCard = ({ icon: Icon, label, value, subtext, color = 'purple', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.2 }}
    className={cn(
      "rounded-xl p-4 transition-all duration-200 hover:shadow-md",
      color === 'blue' && "bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100",
      color === 'green' && "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100",
      color === 'orange' && "bg-gradient-to-br from-orange-50 to-amber-100/50 border border-orange-100",
      color === 'purple' && "bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-100"
    )}
  >
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center",
        color === 'blue' && "bg-blue-500/10",
        color === 'green' && "bg-emerald-500/10",
        color === 'orange' && "bg-orange-500/10",
        color === 'purple' && "bg-purple-500/10"
      )}>
        <Icon className={cn(
          "w-4 h-4",
          color === 'blue' && "text-blue-600",
          color === 'green' && "text-emerald-600",
          color === 'orange' && "text-orange-600",
          color === 'purple' && "text-purple-600"
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 truncate">{label}{subtext && ` · ${subtext}`}</p>
      </div>
    </div>
  </motion.div>
);

const ContractCard = ({ contract }) => {
  const renewalDate = contract.renewal_date || contract.end_date;
  const daysUntil = renewalDate ? Math.ceil((new Date(renewalDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const isUrgent = daysUntil && daysUntil <= 30;
  const isWarning = daysUntil && daysUntil <= 90 && daysUntil > 30;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "group flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:border-slate-300",
        contract.status === 'active' ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100"
      )}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={cn(
          "w-2.5 h-2.5 rounded-full flex-shrink-0",
          contract.status === 'active' ? "bg-emerald-500" : "bg-slate-300"
        )} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 truncate group-hover:text-purple-700 transition-colors">
            {contract.name}
          </p>
          <p className="text-sm text-slate-500 mt-0.5">
            {contract.type?.replace('_', ' ') || 'Contract'} • {contract.billing_cycle || 'Monthly'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        {contract.value > 0 && (
          <div className="text-right">
            <p className="font-bold text-slate-900">${contract.value.toLocaleString()}</p>
            <p className="text-xs text-slate-400">/{contract.billing_cycle === 'annually' ? 'yr' : 'mo'}</p>
          </div>
        )}
        {renewalDate && (
          <div className={cn(
            "px-3 py-2 rounded-lg text-center min-w-[70px]",
            isUrgent ? "bg-red-50 border border-red-100" : 
            isWarning ? "bg-amber-50 border border-amber-100" : 
            "bg-emerald-50 border border-emerald-100"
          )}>
            <p className={cn(
              "text-[10px] font-medium uppercase tracking-wide",
              isUrgent ? "text-red-600" : isWarning ? "text-amber-600" : "text-emerald-600"
            )}>Renews</p>
            <p className={cn(
              "text-sm font-bold",
              isUrgent ? "text-red-700" : isWarning ? "text-amber-700" : "text-emerald-700"
            )}>{format(parseISO(renewalDate), 'MMM d')}</p>
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
    </motion.div>
  );
};

const TeamMemberCard = ({ contact, onClick }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    onClick={onClick}
    className="flex items-center gap-3 p-4 bg-slate-50/80 rounded-xl hover:bg-slate-100 hover:shadow-sm transition-all duration-200 cursor-pointer group"
  >
    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-medium shadow-sm text-lg">
      {contact.full_name?.charAt(0) || '?'}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-slate-900 truncate group-hover:text-purple-700 transition-colors">
        {contact.full_name}
      </p>
      <p className="text-sm text-slate-500 truncate">{contact.email || contact.title || 'No email'}</p>
    </div>
    {contact.is_primary && (
      <Badge className="bg-purple-100 text-purple-700 text-[10px] font-semibold">Primary</Badge>
    )}
    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition-colors" />
  </motion.div>
);

export default function OverviewTab({
  customer,
  contacts,
  contracts,
  recurringBills,
  licenses,
  customerId,
  queryClient,
  onAddContact,
  tickets = [],
  devices = [],
  licenseAssignments = [],
  invoices = [],
  quotes = []
}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [teamPage, setTeamPage] = useState(1);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    summary: '',
    details: '',
    priority: 'medium'
  });
  const itemsPerPage = 8;

  const handleOpenSupport = () => {
    setShowAssistant(true);
  };

  const [conversationTranscript, setConversationTranscript] = useState('');

  const handleSkipToTicket = (prefillSummary = '', prefillDetails = '', transcript = '') => {
    setShowAssistant(false);
    setNewTicket(prev => ({ 
      ...prev, 
      summary: prefillSummary,
      details: prefillDetails || prev.details 
    }));
    setConversationTranscript(transcript);
    setShowTicketModal(true);
  };

  const handleSyncContacts = async () => {
    if (!customer?.external_id) return;
    setIsSyncing(true);
    try {
      const response = await base44.functions.invoke('syncHaloPSAContacts', { 
        action: 'sync_customer',
        customer_id: customer.external_id 
      });
      if (response.data.success) {
        toast.success(`Synced ${response.data.recordsSynced} contacts`);
        queryClient.invalidateQueries({ queryKey: ['contacts', customerId] });
      } else {
        toast.error(response.data.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicket.summary) {
      toast.error('Please enter a summary');
      return;
    }
    setIsCreatingTicket(true);
    try {
      const response = await base44.functions.invoke('createHaloPSATicket', {
        customer_id: customerId,
        ...newTicket,
        conversation_transcript: conversationTranscript || null
      });
      if (response.data.success) {
        toast.success('Support ticket created!');
        setShowTicketModal(false);
        setNewTicket({ summary: '', details: '', priority: 'medium' });
        setConversationTranscript('');
        queryClient.invalidateQueries({ queryKey: ['tickets', customerId] });
      } else {
        toast.error(response.data.error || 'Failed to create ticket');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsCreatingTicket(false);
    }
  };

  const totalPages = Math.ceil(contacts.length / itemsPerPage);
  const paginatedContacts = contacts.slice((teamPage - 1) * itemsPerPage, teamPage * itemsPerPage);

  return (
    <div className="space-y-8">
      {/* Quick Action - Create Ticket */}
      {customer?.source === 'halopsa' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-5"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Need Help?</h3>
                <p className="text-sm text-slate-600">Chat with our AI assistant or submit a ticket</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleOpenSupport}
                variant="outline"
                className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                <Bot className="w-4 h-4" />
                Chat with AI
              </Button>
              <Button 
                onClick={() => setShowTicketModal(true)}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <Send className="w-4 h-4" />
                Submit Ticket
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Team Members"
          value={contacts.length}
          color="blue"
          delay={0}
        />
        <StatCard
          icon={DollarSign}
          label="Monthly Spend"
          value={`$${recurringBills.reduce((sum, b) => sum + (b.amount || 0), 0).toLocaleString()}`}
          color="green"
          delay={0.1}
        />
        <StatCard
          icon={FileText}
          label="Active Contracts"
          value={contracts.filter(c => c.status === 'active').length}
          subtext={`${contracts.length} total`}
          color="orange"
          delay={0.2}
        />
        <StatCard
          icon={Cloud}
          label="SaaS Licenses"
          value={licenses.length}
          color="purple"
          delay={0.3}
        />
      </div>

      {/* Main Grid - 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contracts + Invoices Combined */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">Billing</h3>
            <div className="flex gap-1">
              <Badge variant="outline" className="text-xs">{contracts.filter(c => c.status === 'active').length} contracts</Badge>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {/* Contract summary */}
            {contracts.length > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", contracts[0].status === 'active' ? "bg-emerald-500" : "bg-slate-300")} />
                  <p className="text-sm font-medium text-slate-900 truncate">{contracts[0].name}</p>
                </div>
                {contracts[0].renewal_date && (
                  <p className="text-xs text-blue-600 mt-1 ml-4">Renews {format(parseISO(contracts[0].renewal_date), 'MMM d')}</p>
                )}
              </div>
            )}
            {/* Invoice stats */}
            <div className="flex items-center justify-between text-xs px-1">
              <span className="text-emerald-600 font-medium">{invoices.filter(i => i.status === 'paid').length} paid</span>
              {invoices.filter(i => i.status === 'overdue').length > 0 && (
                <span className="text-red-600 font-medium">{invoices.filter(i => i.status === 'overdue').length} overdue</span>
              )}
            </div>
            {invoices.slice(0, 2).map(invoice => (
              <div key={invoice.id} className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  {invoice.status === 'paid' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : invoice.status === 'overdue' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <p className="text-xs text-slate-700">{invoice.invoice_number}</p>
                </div>
                <p className="text-xs font-medium text-slate-600">${(invoice.total || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quotes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">Quotes</h3>
            <Badge variant="outline" className="text-xs">{quotes.length}</Badge>
          </div>
          <div className="p-4 space-y-2">
            {quotes.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No quotes</p>
            ) : (
              quotes.slice(0, 3).map(quote => (
                <div key={quote.id} className="flex items-center justify-between px-1">
                  <p className="text-sm font-medium text-slate-900 truncate flex-1">{quote.quote_number}</p>
                  <Badge className={cn(
                    "text-xs px-2 py-0.5 ml-2",
                    quote.status === 'accepted' && 'bg-emerald-100 text-emerald-700',
                    quote.status === 'sent' && 'bg-blue-100 text-blue-700',
                    quote.status === 'draft' && 'bg-slate-100 text-slate-600'
                  )}>{quote.status}</Badge>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Tickets */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">Tickets</h3>
            <Badge variant="outline" className="text-xs">{tickets.length}</Badge>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-amber-700">{tickets.filter(t => ['open', 'in_progress', 'new'].includes(t.status)).length}</p>
                <p className="text-xs text-amber-600">Open</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-emerald-700">{tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length}</p>
                <p className="text-xs text-emerald-600">Resolved</p>
              </div>
            </div>
            {tickets.slice(0, 2).map(ticket => (
              <p key={ticket.id} className="text-xs text-slate-600 truncate px-1 py-0.5">#{ticket.ticket_number} - {ticket.summary}</p>
            ))}
          </div>
        </motion.div>

        {/* Devices */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:border-purple-200 transition-colors"
          onClick={() => document.querySelector('[value="devices"]')?.click()}
        >
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-xs">Devices</h3>
            <Badge variant="outline" className="text-[9px]">{devices.length}</Badge>
          </div>
          <div className="p-2">
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <div className="bg-emerald-50 rounded p-1.5 text-center">
                <p className="text-sm font-bold text-emerald-700">{devices.filter(d => d.status === 'online').length}</p>
                <p className="text-[8px] text-emerald-600">Online</p>
              </div>
              <div className="bg-slate-100 rounded p-1.5 text-center">
                <p className="text-sm font-bold text-slate-600">{devices.filter(d => d.status !== 'online').length}</p>
                <p className="text-[8px] text-slate-500">Offline</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {devices.slice(0, 4).map(device => (
                <div key={device.id} className="flex items-center gap-1 px-1">
                  <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", device.status === 'online' ? "bg-emerald-500" : "bg-slate-300")} />
                  <p className="text-[9px] text-slate-700 truncate">{device.hostname}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Second Row - 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team Members */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-purple-200 transition-colors"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 text-sm">Team</h3>
              <Badge variant="outline" className="text-xs">{contacts.length}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onAddContact}>
                <UserPlus className="w-3.5 h-3.5" />
              </Button>
              {customer?.source === 'halopsa' && (
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSyncContacts} disabled={isSyncing}>
                  <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                </Button>
              )}
            </div>
          </div>
          <div className="p-3 space-y-2">
            {contacts.slice(0, 3).map(contact => (
              <div 
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-medium">
                  {contact.full_name?.charAt(0)}
                </div>
                <p className="text-sm text-slate-700 truncate flex-1">{contact.full_name}</p>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            ))}
            {contacts.length > 3 && (
              <p 
                className="text-xs text-slate-400 text-center hover:text-purple-500 cursor-pointer py-1"
                onClick={() => setSelectedContact(contacts[3])}
              >
                +{contacts.length - 3} more
              </p>
            )}
          </div>
        </motion.div>

        {/* SaaS Metrics - Compact */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:border-purple-200 transition-colors"
          onClick={() => document.querySelector('[value="licenses"]')?.click()}
        >
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-xs">SaaS</h3>
            <Badge variant="outline" className="text-[9px]">{licenses.length} apps</Badge>
          </div>
          <div className="p-2">
            {(() => {
              const totalSeats = licenses.reduce((sum, l) => sum + (l.quantity || 0), 0);
              const assignedSeats = licenseAssignments.filter(a => a.status === 'active').length;
              const utilizationRate = totalSeats > 0 ? (assignedSeats / totalSeats) * 100 : 0;
              const totalCost = licenses.reduce((sum, l) => sum + (l.total_cost || 0), 0);
              
              return (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-purple-50 rounded p-1.5 text-center">
                      <p className="text-sm font-bold text-purple-700">${totalCost.toLocaleString()}</p>
                      <p className="text-[8px] text-purple-600">Spend</p>
                    </div>
                    <div className={cn("rounded p-1.5 text-center", utilizationRate >= 70 ? "bg-emerald-50" : "bg-amber-50")}>
                      <p className={cn("text-sm font-bold", utilizationRate >= 70 ? "text-emerald-700" : "text-amber-700")}>{utilizationRate.toFixed(0)}%</p>
                      <p className={cn("text-[8px]", utilizationRate >= 70 ? "text-emerald-600" : "text-amber-600")}>Used</p>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-500 text-center">{assignedSeats}/{totalSeats} seats</p>
                </div>
              );
            })()}
          </div>
        </motion.div>


      </div>

      {/* Contact Detail Modal */}
      <UserDetailModal 
        contact={selectedContact}
        open={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        customerId={customerId}
      />

      {/* AI Support Assistant Modal */}
      <Dialog open={showAssistant} onOpenChange={setShowAssistant}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Support Assistant</DialogTitle>
          </DialogHeader>
          <SupportAssistantChat 
            onCreateTicket={(summary, details, transcript) => handleSkipToTicket(summary, details, transcript)}
            onClose={() => setShowAssistant(false)}
            customerId={customerId}
          />
        </DialogContent>
      </Dialog>

      {/* Create Ticket Modal */}
      <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-purple-600" />
              Submit Support Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Subject</label>
              <Input
                value={newTicket.summary}
                onChange={(e) => setNewTicket(prev => ({ ...prev, summary: e.target.value }))}
                placeholder="Brief description of your issue..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Details</label>
              <Textarea
                value={newTicket.details}
                onChange={(e) => setNewTicket(prev => ({ ...prev, details: e.target.value }))}
                placeholder="Please provide more details about your request..."
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Priority</label>
              <Select
                value={newTicket.priority}
                onValueChange={(value) => setNewTicket(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - General question</SelectItem>
                  <SelectItem value="medium">Medium - Issue affecting work</SelectItem>
                  <SelectItem value="high">High - Significant impact</SelectItem>
                  <SelectItem value="critical">Critical - System down</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowTicketModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTicket}
                disabled={isCreatingTicket}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {isCreatingTicket ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
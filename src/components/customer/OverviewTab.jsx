import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/motion';
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
  Clock,
  Loader2
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
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { format, parseISO } from 'date-fns';
import { client } from '@/api/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import UserDetailModal from './UserDetailModal';
import SupportAssistantChat from './SupportAssistantChat';

const STAT_COLORS = {
  blue: { icon: 'text-primary', bg: 'bg-primary/10' },
  green: { icon: 'text-success', bg: 'bg-success/10' },
  orange: { icon: 'text-warning', bg: 'bg-warning/10' },
  purple: { icon: 'text-[#7828C8]', bg: 'bg-[#7828C8]/10' },
};

const StatCard = ({ icon: Icon, label, value, subtext, color = 'purple', delay = 0 }) => {
  const c = STAT_COLORS[color] || STAT_COLORS.purple;
  const isNumeric = typeof value === 'number';

  return (
    <motion.div
      variants={staggerItem}
      className="bg-card rounded-[14px] border shadow-hero-sm p-4 hover:shadow-hero-md transition-all duration-[250ms]"
    >
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-hero-md flex items-center justify-center', c.bg)}>
          <Icon className={cn('w-5 h-5', c.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          {isNumeric ? (
            <AnimatedCounter value={value} className="text-2xl font-bold text-foreground" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{value}</p>
          )}
          <p className="text-xs text-muted-foreground truncate">{label}{subtext && ` · ${subtext}`}</p>
        </div>
      </div>
    </motion.div>
  );
};

const ContractCard = ({ contract }) => {
  const renewalDate = contract.renewal_date || contract.end_date;
  const daysUntil = renewalDate ? Math.ceil((new Date(renewalDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
  const isUrgent = daysUntil && daysUntil <= 30;
  const isWarning = daysUntil && daysUntil <= 90 && daysUntil > 30;

  return (
    <motion.div
      variants={staggerItem}
      className={cn(
        "group flex items-center justify-between p-4 rounded-hero-md border transition-all duration-[250ms] cursor-pointer",
        "hover:shadow-hero-sm",
        contract.status === 'active' ? "bg-card border-border" : "bg-zinc-50 dark:bg-zinc-800/50 border-border/50"
      )}
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className={cn(
          "w-2.5 h-2.5 rounded-full flex-shrink-0",
          contract.status === 'active' ? "bg-success" : "bg-zinc-300 dark:bg-zinc-600"
        )} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors duration-[250ms]">
            {contract.name}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {contract.type?.replace('_', ' ') || 'Contract'} • {contract.billing_cycle || 'Monthly'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        {contract.value > 0 && (
          <div className="text-right">
            <p className="font-bold text-foreground">${contract.value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground/60">/{contract.billing_cycle === 'annually' ? 'yr' : 'mo'}</p>
          </div>
        )}
        {renewalDate && (
          <div className={cn(
            "px-3 py-2 rounded-hero-sm text-center min-w-[70px]",
            isUrgent ? "bg-destructive/10 border border-destructive/20" :
            isWarning ? "bg-warning/10 border border-warning/20" :
            "bg-success/10 border border-success/20"
          )}>
            <p className={cn(
              "text-[10px] font-medium uppercase tracking-wide",
              isUrgent ? "text-destructive" : isWarning ? "text-warning" : "text-success"
            )}>Renews</p>
            <p className={cn(
              "text-sm font-bold",
              isUrgent ? "text-destructive" : isWarning ? "text-warning" : "text-success"
            )}>{format(parseISO(renewalDate), 'MMM d')}</p>
          </div>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors duration-[250ms]" />
      </div>
    </motion.div>
  );
};

const TeamMemberCard = ({ contact, onClick }) => (
  <motion.div
    variants={staggerItem}
    onClick={onClick}
    className="flex items-center gap-3 p-3.5 rounded-hero-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:shadow-hero-sm transition-all duration-[250ms] cursor-pointer group"
  >
    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium shadow-sm text-base">
      {contact.full_name?.charAt(0) || '?'}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors duration-[250ms] text-sm">
        {contact.full_name}
      </p>
      <p className="text-xs text-muted-foreground truncate">{contact.email || contact.title || 'No email'}</p>
    </div>
    {contact.is_primary && (
      <Badge variant="flat" className="text-[10px]">Primary</Badge>
    )}
    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors duration-[250ms]" />
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
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    summary: '',
    details: '',
    priority: 'medium'
  });
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const itemsPerPage = 8;

  // Fetch activities for orphaned users (removed from HaloPSA but have licenses)
  const { data: orphanedUserAlerts = [] } = useQuery({
    queryKey: ['orphaned_user_alerts', customerId],
    queryFn: async () => {
      const activities = await client.entities.Activity.filter({ 
        entity_id: customerId,
        type: 'license_revoked'
      });
      // Filter to only those that mention HaloPSA removal
      const recentAlerts = activities.filter(a => 
        a.description?.includes('removed from HaloPSA') || 
        a.title?.includes('Removed from HaloPSA')
      );
      
      // For each alert, get the contact's license assignments
      const alertsWithLicenses = await Promise.all(recentAlerts.map(async (alert) => {
        const metadata = alert.metadata ? JSON.parse(alert.metadata) : {};
        if (metadata.contact_id) {
          const assignments = await client.entities.LicenseAssignment.filter({
            contact_id: metadata.contact_id,
            status: 'active'
          });
          // Get license details
          const licenseDetails = await Promise.all(assignments.map(async (a) => {
            const licenses = await client.entities.SaaSLicense.filter({ id: a.license_id });
            return licenses[0]?.application_name || 'Unknown License';
          }));
          return { ...alert, metadata, licenseNames: licenseDetails };
        }
        return { ...alert, metadata, licenseNames: [] };
      }));
      
      return alertsWithLicenses;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

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
      const response = await client.functions.invoke('syncHaloPSAContacts', { 
        action: 'sync_customer',
        customer_id: customer.external_id 
      });
      if (response.success) {
        toast.success(`Synced ${response.recordsSynced} contacts`);
        queryClient.invalidateQueries({ queryKey: ['contacts', customerId] });
      } else {
        toast.error(response.error || 'Sync failed');
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
      const response = await client.functions.invoke('createHaloPSATicket', {
        customer_id: customerId,
        ...newTicket,
        conversation_transcript: conversationTranscript || null
      });
      if (response.success) {
        toast.success('Support ticket created!');
        setShowTicketModal(false);
        setNewTicket({ summary: '', details: '', priority: 'medium' });
        setConversationTranscript('');
        queryClient.invalidateQueries({ queryKey: ['tickets', customerId] });
      } else {
        toast.error(response.error || 'Failed to create ticket');
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
    <div className="space-y-6">
      {/* Quick Action - Create Ticket */}
      {customer?.source === 'halopsa' && (
        <motion.div {...fadeInUp} className="bg-card rounded-[14px] border shadow-hero-sm p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-hero-md bg-primary/10 flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Need Help?</h3>
                <p className="text-sm text-muted-foreground">Chat with our AI assistant or submit a ticket</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleOpenSupport}
                variant="outline"
                className="gap-2"
              >
                <Bot className="w-4 h-4" />
                Chat with AI
              </Button>
              <Button
                onClick={() => setShowTicketModal(true)}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                Submit Ticket
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Orphaned User Alerts */}
      {orphanedUserAlerts.filter(a => !dismissedAlerts.includes(a.id)).length > 0 && (
        <div className="space-y-3">
          {orphanedUserAlerts.filter(a => !dismissedAlerts.includes(a.id)).map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-warning/10 border border-warning/20 rounded-[14px] p-4"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 bg-warning/15 rounded-hero-md flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">User Removed from HaloPSA</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>{alert.metadata?.contact_name || 'Unknown User'}</strong>
                    {alert.metadata?.contact_email && (
                      <span className="text-muted-foreground/70"> ({alert.metadata.contact_email})</span>
                    )}
                    {' '}was removed from HaloPSA but still has active licenses assigned.
                  </p>
                  {alert.licenseNames && alert.licenseNames.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-foreground mb-1">Assigned Licenses:</p>
                      <div className="flex flex-wrap gap-1">
                        {alert.licenseNames.map((name, idx) => (
                          <Badge key={idx} variant="flat-warning" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-warning mt-2">
                    Action needed: Review and revoke licenses if this user should no longer have access.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-warning hover:text-foreground flex-shrink-0"
                  onClick={() => setDismissedAlerts(prev => [...prev, alert.id])}
                >
                  Dismiss
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Team Members" value={contacts.length} color="blue" />
        <StatCard icon={DollarSign} label="Monthly Spend" value={`$${recurringBills.reduce((sum, b) => sum + (b.amount || 0), 0).toLocaleString()}`} color="green" />
        <StatCard icon={FileText} label="Active Contracts" value={contracts.filter(c => c.status === 'active').length} subtext={`${contracts.length} total`} color="orange" />
        <StatCard icon={Cloud} label="SaaS Licenses" value={licenses.filter(l => l.source !== 'jumpcloud' && l.vendor?.toLowerCase() !== 'jumpcloud').length} color="purple" />
      </motion.div>

      {/* Main Grid - 2 columns */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Billing Summary */}
        <motion.div
          variants={staggerItem}
          className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden cursor-pointer hover:shadow-hero-md transition-all duration-[250ms]"
          onClick={() => document.querySelector('[value="billing"]')?.click()}
        >
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">Billing</h3>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-success/10 rounded-hero-sm p-3 text-center">
                <p className="text-lg font-bold text-success">{invoices.filter(i => i.status === 'paid').length}</p>
                <p className="text-xs text-success/80">Paid</p>
              </div>
              <div className={cn(
                "rounded-hero-sm p-3 text-center",
                invoices.filter(i => i.status === 'overdue').length > 0 ? "bg-destructive/10" : "bg-zinc-100 dark:bg-zinc-800"
              )}>
                <p className={cn(
                  "text-lg font-bold",
                  invoices.filter(i => i.status === 'overdue').length > 0 ? "text-destructive" : "text-muted-foreground"
                )}>{invoices.filter(i => i.status === 'overdue').length}</p>
                <p className={cn(
                  "text-xs",
                  invoices.filter(i => i.status === 'overdue').length > 0 ? "text-destructive/80" : "text-muted-foreground/60"
                )}>Overdue</p>
              </div>
            </div>
            <p className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground text-center">
              {contracts.filter(c => c.status === 'active').length} active contracts
            </p>
          </div>
        </motion.div>

        {/* Quotes */}
        <motion.div
          variants={staggerItem}
          className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden cursor-pointer hover:shadow-hero-md transition-all duration-[250ms]"
          onClick={() => document.querySelector('[value="billing"]')?.click()}
        >
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">Quotes</h3>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-primary/10 rounded-hero-sm p-2 text-center">
                <p className="text-lg font-bold text-primary">{quotes.filter(q => q.status === 'sent').length}</p>
                <p className="text-xs text-primary/80">Sent</p>
              </div>
              <div className="bg-success/10 rounded-hero-sm p-2 text-center">
                <p className="text-lg font-bold text-success">{quotes.filter(q => q.status === 'accepted').length}</p>
                <p className="text-xs text-success/80">Accepted</p>
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-hero-sm p-2 text-center">
                <p className="text-lg font-bold text-muted-foreground">{quotes.filter(q => q.status === 'draft').length}</p>
                <p className="text-xs text-muted-foreground/60">Draft</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">{quotes.length} total quotes</p>
          </div>
        </motion.div>

        {/* Tickets */}
        <motion.div
          variants={staggerItem}
          className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden cursor-pointer hover:shadow-hero-md transition-all duration-[250ms]"
          onClick={() => document.querySelector('[value="tickets"]')?.click()}
        >
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">Tickets</h3>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-warning/10 rounded-hero-sm p-3 text-center">
                <p className="text-lg font-bold text-warning">{tickets.filter(t => ['open', 'in_progress', 'new'].includes(t.status)).length}</p>
                <p className="text-xs text-warning/80">Open</p>
              </div>
              <div className="bg-success/10 rounded-hero-sm p-3 text-center">
                <p className="text-lg font-bold text-success">{tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length}</p>
                <p className="text-xs text-success/80">Resolved</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">{tickets.length} total tickets</p>
          </div>
        </motion.div>

        {/* Devices */}
        <motion.div
          variants={staggerItem}
          className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden cursor-pointer hover:shadow-hero-md transition-all duration-[250ms]"
          onClick={() => document.querySelector('[value="devices"]')?.click()}
        >
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">Devices</h3>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-success/10 rounded-hero-sm p-3 text-center">
                <p className="text-lg font-bold text-success">{devices.filter(d => d.status === 'online').length}</p>
                <p className="text-xs text-success/80">Online</p>
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-hero-sm p-3 text-center">
                <p className="text-lg font-bold text-muted-foreground">{devices.filter(d => d.status !== 'online').length}</p>
                <p className="text-xs text-muted-foreground/60">Offline</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">{devices.length} total devices</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Second Row - 2 columns */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team Members */}
        <motion.div
          variants={staggerItem}
          className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden hover:shadow-hero-md transition-all duration-[250ms]"
        >
          <div
            className="px-4 py-3 border-b border-border/50 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-[250ms]"
            onClick={() => setShowTeamModal(true)}
          >
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm">Team</h3>
              <Badge variant="secondary" className="text-xs">{contacts.length}</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onAddContact(); }}>
                <UserPlus className="w-3.5 h-3.5" />
              </Button>
              {customer?.source === 'halopsa' && (
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); handleSyncContacts(); }} disabled={isSyncing}>
                  {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
              )}
            </div>
          </div>
          <div className="p-3 space-y-1.5">
            {contacts.slice(0, 3).map(contact => (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className="flex items-center gap-2.5 p-2.5 rounded-hero-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors duration-[250ms]"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
                  {contact.full_name?.charAt(0)}
                </div>
                <p className="text-sm text-foreground truncate flex-1">{contact.full_name}</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
              </div>
            ))}
            {contacts.length > 3 && (
              <p
                className="text-xs text-muted-foreground text-center hover:text-primary cursor-pointer py-1 transition-colors duration-[250ms]"
                onClick={() => setShowTeamModal(true)}
              >
                +{contacts.length - 3} more
              </p>
            )}
          </div>
        </motion.div>

        {/* SaaS Metrics */}
        <motion.div
          variants={staggerItem}
          className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden cursor-pointer hover:shadow-hero-md transition-all duration-[250ms]"
          onClick={() => document.querySelector('[value="licenses"]')?.click()}
        >
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">SaaS</h3>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
          </div>
          <div className="p-4">
            {(() => {
              const nonJcLicenses = licenses.filter(l => l.source !== 'jumpcloud' && l.vendor?.toLowerCase() !== 'jumpcloud');
              const nonJcLicenseIds = nonJcLicenses.map(l => l.id);
              const totalSeats = nonJcLicenses.reduce((sum, l) => sum + (l.quantity || 0), 0);
              const assignedSeats = licenseAssignments.filter(a => a.status === 'active' && nonJcLicenseIds.includes(a.license_id)).length;
              const utilizationRate = totalSeats > 0 ? (assignedSeats / totalSeats) * 100 : 0;
              const totalCost = nonJcLicenses.reduce((sum, l) => sum + (l.total_cost || 0), 0);

              return (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#7828C8]/10 rounded-hero-sm p-3 text-center">
                      <p className="text-lg font-bold text-[#7828C8]">${totalCost.toLocaleString()}</p>
                      <p className="text-xs text-[#7828C8]/80">Spend</p>
                    </div>
                    <div className={cn("rounded-hero-sm p-3 text-center", utilizationRate >= 70 ? "bg-success/10" : "bg-warning/10")}>
                      <p className={cn("text-lg font-bold", utilizationRate >= 70 ? "text-success" : "text-warning")}>{utilizationRate.toFixed(0)}%</p>
                      <p className={cn("text-xs", utilizationRate >= 70 ? "text-success/80" : "text-warning/80")}>Used</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{assignedSeats}/{totalSeats} seats • {nonJcLicenses.length} apps</p>
                </div>
              );
            })()}
          </div>
        </motion.div>
      </motion.div>

      {/* Contact Detail Modal */}
      <UserDetailModal 
        contact={selectedContact}
        open={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        customerId={customerId}
      />

      {/* Team Members Modal */}
      <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Team Members ({contacts.length})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-2">
            {contacts.map(contact => (
              <div
                key={contact.id}
                onClick={() => { setShowTeamModal(false); setSelectedContact(contact); }}
                className="flex items-center gap-3 p-3 rounded-hero-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors duration-[250ms]"
              >
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
                  {contact.full_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate text-sm">{contact.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{contact.email || contact.title || 'No email'}</p>
                </div>
                {contact.is_primary && (
                  <Badge variant="flat" className="text-xs">Primary</Badge>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
              </div>
            ))}
            {contacts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p>No team members found</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
              <HelpCircle className="w-5 h-5 text-primary" />
              Submit Support Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Subject</label>
              <Input
                value={newTicket.summary}
                onChange={(e) => setNewTicket(prev => ({ ...prev, summary: e.target.value }))}
                placeholder="Brief description of your issue..."
                className="rounded-hero-md"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Details</label>
              <Textarea
                value={newTicket.details}
                onChange={(e) => setNewTicket(prev => ({ ...prev, details: e.target.value }))}
                placeholder="Please provide more details about your request..."
                rows={4}
                className="rounded-hero-md"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Priority</label>
              <Select
                value={newTicket.priority}
                onValueChange={(value) => setNewTicket(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger className="rounded-hero-md">
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
                className="gap-2"
              >
                {isCreatingTicket ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
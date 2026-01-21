import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  ArrowRight
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
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg hover:border-slate-200 transition-all duration-300"
  >
    <div className="flex items-start justify-between">
      <div className={cn(
        "w-11 h-11 rounded-xl flex items-center justify-center",
        color === 'blue' && "bg-blue-50",
        color === 'green' && "bg-emerald-50",
        color === 'orange' && "bg-orange-50",
        color === 'purple' && "bg-purple-50"
      )}>
        <Icon className={cn(
          "w-5 h-5",
          color === 'blue' && "text-blue-600",
          color === 'green' && "text-emerald-600",
          color === 'orange' && "text-orange-600",
          color === 'purple' && "text-purple-600"
        )} />
      </div>
      <TrendingUp className="w-4 h-4 text-emerald-500" />
    </div>
    <div className="mt-4">
      <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
      {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}
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
  onAddContact
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

  const handleSkipToTicket = (prefillSummary = '') => {
    setShowAssistant(false);
    setNewTicket(prev => ({ ...prev, summary: prefillSummary }));
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
        ...newTicket
      });
      if (response.data.success) {
        toast.success('Support ticket created!');
        setShowTicketModal(false);
        setNewTicket({ summary: '', details: '', priority: 'medium' });
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

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contracts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Contracts</h3>
              <p className="text-sm text-slate-500">{contracts.filter(c => c.status === 'active').length} active</p>
            </div>
            <Zap className="w-5 h-5 text-slate-300" />
          </div>
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {contracts.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">No contracts found</p>
              </div>
            ) : (
              contracts
                .sort((a, b) => (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0))
                .slice(0, 5)
                .map(contract => (
                  <ContractCard key={contract.id} contract={contract} />
                ))
            )}
            {contracts.length > 5 && (
              <button className="w-full py-2 text-sm text-purple-600 hover:text-purple-700 font-medium">
                View all {contracts.length} contracts →
              </button>
            )}
          </div>
        </motion.div>

        {/* Team Members */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Team</h3>
              <p className="text-sm text-slate-500">{contacts.length} members</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 px-3 text-slate-600"
                onClick={onAddContact}
              >
                <UserPlus className="w-4 h-4" />
              </Button>
              {customer?.source === 'halopsa' && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 px-3 text-slate-600"
                  onClick={handleSyncContacts}
                  disabled={isSyncing}
                >
                  <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                </Button>
              )}
            </div>
          </div>
          <div className="p-4">
            {contacts.length === 0 ? (
              <div className="py-8 text-center">
                <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400">No team members yet</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="mt-3"
                  onClick={onAddContact}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Member
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2">
                  <AnimatePresence mode="wait">
                    {paginatedContacts.map(contact => (
                      <TeamMemberCard 
                        key={contact.id} 
                        contact={contact} 
                        onClick={() => setSelectedContact(contact)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                      {(teamPage - 1) * itemsPerPage + 1}-{Math.min(teamPage * itemsPerPage, contacts.length)} of {contacts.length}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => setTeamPage(p => Math.max(1, p - 1))}
                        disabled={teamPage === 1}
                      >
                        ←
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => setTeamPage(p => Math.min(totalPages, p + 1))}
                        disabled={teamPage >= totalPages}
                      >
                        →
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
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
          <SupportAssistantChat 
            onCreateTicket={handleSkipToTicket}
            onClose={() => setShowAssistant(false)}
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
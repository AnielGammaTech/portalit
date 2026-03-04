import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { toast } from 'sonner';
import { 
  HelpCircle, 
  Plus, 
  RefreshCw, 
  Filter,
  X,
  Send,
  Building2
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

const SOURCE_COLORS = {
  halopsa: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'HaloPSA' },
  jumpcloud: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'JumpCloud' },
  manual: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Manual' },
};

export default function AdminTicketsPanel() {
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({
    customer_id: '',
    summary: '',
    details: '',
    priority: 'medium'
  });
  
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['all-tickets'],
    queryFn: () => client.entities.Ticket.list('-created_date', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => client.entities.Customer.list(),
  });

  const handleSyncAllTickets = async () => {
    setIsSyncing(true);
    try {
      const response = await client.functions.invoke('syncHaloPSATickets', { 
        action: 'sync_all'
      });
      if (response.data.success) {
        toast.success(`Synced ${response.data.recordsSynced} tickets`);
        queryClient.invalidateQueries({ queryKey: ['all-tickets'] });
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
    if (!newTicket.customer_id || !newTicket.summary) {
      toast.error('Please select a customer and enter a summary');
      return;
    }

    setIsCreating(true);
    try {
      const response = await client.functions.invoke('createHaloPSATicket', newTicket);
      if (response.data.success) {
        toast.success('Ticket created successfully');
        setShowCreateModal(false);
        setNewTicket({ customer_id: '', summary: '', details: '', priority: 'medium' });
        queryClient.invalidateQueries({ queryKey: ['all-tickets'] });
      } else {
        toast.error(response.data.error || 'Failed to create ticket');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Determine source from ticket data
  const getTicketSource = (ticket) => {
    if (ticket.halopsa_id) return 'halopsa';
    if (ticket.jumpcloud_id) return 'jumpcloud';
    return 'manual';
  };

  const filteredTickets = tickets.filter(ticket => {
    const source = getTicketSource(ticket);
    if (sourceFilter !== 'all' && source !== sourceFilter) return false;
    if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
    return true;
  });

  // Get unique sources from tickets
  const sources = [...new Set(tickets.map(t => getTicketSource(t)))];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Support Tickets</h2>
            <p className="text-sm text-slate-500">{filteredTickets.length} tickets</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncAllTickets}
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            Sync
          </Button>
          <Button 
            size="sm" 
            onClick={() => setShowCreateModal(true)}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-600">Source:</span>
          <div className="flex gap-1">
            <button
              onClick={() => setSourceFilter('all')}
              className={cn(
                "px-3 py-1 rounded-lg text-sm font-medium transition-colors",
                sourceFilter === 'all' 
                  ? "bg-slate-900 text-white" 
                  : "bg-white text-slate-600 hover:bg-slate-100"
              )}
            >
              All
            </button>
            {sources.map(source => (
              <button
                key={source}
                onClick={() => setSourceFilter(source)}
                className={cn(
                  "px-3 py-1 rounded-lg text-sm font-medium transition-colors",
                  sourceFilter === source 
                    ? `${SOURCE_COLORS[source]?.bg} ${SOURCE_COLORS[source]?.text}` 
                    : "bg-white text-slate-600 hover:bg-slate-100"
                )}
              >
                {SOURCE_COLORS[source]?.label || source}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <span className="text-sm text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting">Waiting</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-8 text-center">
            <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No tickets found</p>
          </div>
        ) : (
          filteredTickets.map(ticket => {
            const source = getTicketSource(ticket);
            const customer = customers.find(c => c.id === ticket.customer_id);
            
            return (
              <div key={ticket.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">#{ticket.ticket_number}</span>
                      <Badge className={cn("text-xs", SOURCE_COLORS[source]?.bg, SOURCE_COLORS[source]?.text)}>
                        {SOURCE_COLORS[source]?.label || source}
                      </Badge>
                    </div>
                    <p className="text-slate-900 font-medium truncate">{ticket.summary}</p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      {customer && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {customer.name}
                        </span>
                      )}
                      {ticket.date_opened && (
                        <span>{format(parseISO(ticket.date_opened), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={cn(
                      'text-xs capitalize',
                      ticket.priority === 'critical' && 'bg-red-100 text-red-700',
                      ticket.priority === 'high' && 'bg-orange-100 text-orange-700',
                      ticket.priority === 'medium' && 'bg-yellow-100 text-yellow-700',
                      ticket.priority === 'low' && 'bg-blue-100 text-blue-700'
                    )}>
                      {ticket.priority}
                    </Badge>
                    <Badge className={cn(
                      'text-xs capitalize',
                      ticket.status === 'new' && 'bg-blue-100 text-blue-700',
                      ticket.status === 'open' && 'bg-yellow-100 text-yellow-700',
                      ticket.status === 'in_progress' && 'bg-indigo-100 text-indigo-700',
                      ticket.status === 'waiting' && 'bg-orange-100 text-orange-700',
                      ticket.status === 'resolved' && 'bg-emerald-100 text-emerald-700',
                      ticket.status === 'closed' && 'bg-slate-100 text-slate-700'
                    )}>
                      {ticket.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Ticket Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Customer</label>
              <Select
                value={newTicket.customer_id}
                onValueChange={(value) => setNewTicket(prev => ({ ...prev, customer_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers
                    .filter(c => c.source === 'halopsa' && c.external_id)
                    .map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Only HaloPSA-linked customers shown</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Summary</label>
              <Input
                value={newTicket.summary}
                onChange={(e) => setNewTicket(prev => ({ ...prev, summary: e.target.value }))}
                placeholder="Brief description of the issue..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Details</label>
              <Textarea
                value={newTicket.details}
                onChange={(e) => setNewTicket(prev => ({ ...prev, details: e.target.value }))}
                placeholder="Additional details..."
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
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTicket}
                disabled={isCreating}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {isCreating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Create Ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
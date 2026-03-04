import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import {
  Building2,
  FileText,
  Receipt,
  HelpCircle,
  Cloud,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Filter,
  Clock
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO, formatDistanceToNow } from 'date-fns';

const ACTIVITY_ICONS = {
  customer_created: { icon: Plus, color: 'bg-emerald-100 text-emerald-600' },
  customer_updated: { icon: Edit, color: 'bg-blue-100 text-blue-600' },
  contract_created: { icon: FileText, color: 'bg-purple-100 text-purple-600' },
  contract_updated: { icon: Edit, color: 'bg-blue-100 text-blue-600' },
  contract_expired: { icon: AlertCircle, color: 'bg-red-100 text-red-600' },
  invoice_paid: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
  invoice_overdue: { icon: AlertCircle, color: 'bg-red-100 text-red-600' },
  ticket_created: { icon: HelpCircle, color: 'bg-amber-100 text-amber-600' },
  ticket_resolved: { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600' },
  sync_completed: { icon: RefreshCw, color: 'bg-blue-100 text-blue-600' },
  sync_failed: { icon: AlertCircle, color: 'bg-red-100 text-red-600' },
  license_assigned: { icon: Cloud, color: 'bg-purple-100 text-purple-600' },
  license_revoked: { icon: Trash2, color: 'bg-red-100 text-red-600' }
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Activity' },
  { value: 'customer', label: 'Customers' },
  { value: 'contract', label: 'Contracts' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'ticket', label: 'Tickets' },
  { value: 'license', label: 'Licenses' },
  { value: 'sync', label: 'Sync Status' }
];

export default function ActivityFeed({ limit = 20, showFilters = true, compact = false }) {
  const [filter, setFilter] = useState('all');

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: () => client.entities.Activity.list('-created_date', 100),
  });

  // Also fetch recent entity changes to supplement activity feed
  const { data: recentCustomers = [] } = useQuery({
    queryKey: ['recent_customers'],
    queryFn: () => client.entities.Customer.list('-updated_date', 20),
  });

  const { data: recentContracts = [] } = useQuery({
    queryKey: ['recent_contracts'],
    queryFn: () => client.entities.Contract.list('-updated_date', 20),
  });

  const { data: recentTickets = [] } = useQuery({
    queryKey: ['recent_tickets'],
    queryFn: () => client.entities.Ticket.list('-updated_date', 20),
  });

  const { data: syncLogs = [] } = useQuery({
    queryKey: ['sync_logs'],
    queryFn: () => client.entities.SyncLog.list('-created_date', 20),
  });

  // Combine activities with inferred activities from entity changes
  const combinedActivities = useMemo(() => {
    const items = [...activities];

    // Add sync logs as activities
    syncLogs.forEach(log => {
      items.push({
        id: `sync-${log.id}`,
        type: log.status === 'success' ? 'sync_completed' : 'sync_failed',
        title: `${log.source?.toUpperCase() || 'System'} Sync ${log.status === 'success' ? 'Completed' : 'Failed'}`,
        description: log.status === 'success' 
          ? `Synced ${log.records_synced || 0} ${log.sync_type || 'records'}`
          : log.error_message || 'Sync failed',
        entity_type: 'sync',
        entity_name: log.source,
        created_date: log.completed_at || log.created_date
      });
    });

    // Add recent customer activities
    recentCustomers.slice(0, 5).forEach(customer => {
      const isNew = customer.created_date === customer.updated_date;
      items.push({
        id: `customer-${customer.id}`,
        type: isNew ? 'customer_created' : 'customer_updated',
        title: isNew ? 'New Customer Added' : 'Customer Updated',
        description: customer.name,
        entity_type: 'customer',
        entity_id: customer.id,
        entity_name: customer.name,
        created_date: customer.updated_date
      });
    });

    // Add recent contract activities
    recentContracts.slice(0, 5).forEach(contract => {
      const isNew = contract.created_date === contract.updated_date;
      items.push({
        id: `contract-${contract.id}`,
        type: isNew ? 'contract_created' : 'contract_updated',
        title: isNew ? 'New Contract Created' : 'Contract Updated',
        description: contract.name,
        entity_type: 'contract',
        entity_id: contract.id,
        entity_name: contract.name,
        created_date: contract.updated_date
      });
    });

    // Add recent ticket activities
    recentTickets.slice(0, 5).forEach(ticket => {
      const isResolved = ['resolved', 'closed'].includes(ticket.status);
      items.push({
        id: `ticket-${ticket.id}`,
        type: isResolved ? 'ticket_resolved' : 'ticket_created',
        title: isResolved ? 'Ticket Resolved' : 'New Ticket',
        description: ticket.summary,
        entity_type: 'ticket',
        entity_id: ticket.id,
        entity_name: `#${ticket.ticket_number}`,
        created_date: ticket.last_updated || ticket.date_opened || ticket.created_date
      });
    });

    // Sort by date and remove duplicates
    const seen = new Set();
    return items
      .filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => {
        const dateA = a.created_date ? new Date(a.created_date) : new Date(0);
        const dateB = b.created_date ? new Date(b.created_date) : new Date(0);
        return dateB - dateA;
      });
  }, [activities, recentCustomers, recentContracts, recentTickets, syncLogs]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (filter === 'all') return combinedActivities.slice(0, limit);
    return combinedActivities
      .filter(a => a.entity_type === filter)
      .slice(0, limit);
  }, [combinedActivities, filter, limit]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400" />
          {FILTER_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                filter === option.value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {filteredActivities.length === 0 ? (
        <div className="py-8 text-center">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredActivities.map((activity, index) => {
            const config = ACTIVITY_ICONS[activity.type] || { icon: Clock, color: 'bg-slate-100 text-slate-600' };
            const Icon = config.icon;
            
            return (
              <div
                key={activity.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors",
                  compact && "p-2"
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                  config.color,
                  compact && "w-8 h-8"
                )}>
                  <Icon className={cn("w-4 h-4", compact && "w-3.5 h-3.5")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn(
                        "font-medium text-slate-900",
                        compact ? "text-sm" : "text-sm"
                      )}>
                        {activity.title}
                      </p>
                      <p className={cn(
                        "text-slate-500 truncate",
                        compact ? "text-xs" : "text-sm"
                      )}>
                        {activity.description}
                        {activity.entity_name && activity.description !== activity.entity_name && (
                          <span className="text-slate-400"> • {activity.entity_name}</span>
                        )}
                      </p>
                    </div>
                    <span className={cn(
                      "text-slate-400 whitespace-nowrap flex-shrink-0",
                      compact ? "text-xs" : "text-xs"
                    )}>
                      {activity.created_date 
                        ? formatDistanceToNow(parseISO(activity.created_date), { addSuffix: true })
                        : 'Just now'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
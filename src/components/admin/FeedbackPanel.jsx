import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MessageSquare, Bug, Lightbulb, HelpCircle, ExternalLink, Trash2, CheckCircle2, Eye, Clock, X, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import { format } from 'date-fns';

const typeIcons = {
  bug: Bug,
  feature: Lightbulb,
  question: HelpCircle,
  other: MessageSquare,
};

const typeColors = {
  bug: 'red',
  feature: 'amber',
  question: 'blue',
  other: 'slate',
};

const statusConfig = {
  new: { label: 'New', color: 'bg-purple-100 text-purple-700' },
  reviewing: { label: 'Reviewing', color: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-700' },
};

export default function FeedbackPanel() {
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [adminNotes, setAdminNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ['feedbacks'],
    queryFn: () => base44.entities.Feedback.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Feedback.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
      toast.success('Feedback updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Feedback.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
      setSelectedFeedback(null);
      toast.success('Feedback deleted');
    },
  });

  const handleStatusChange = (feedback, newStatus) => {
    updateMutation.mutate({ id: feedback.id, data: { status: newStatus } });
  };

  const handleSaveNotes = () => {
    if (selectedFeedback) {
      updateMutation.mutate({ id: selectedFeedback.id, data: { admin_notes: adminNotes } });
    }
  };

  const filteredFeedbacks = feedbacks.filter(f => 
    statusFilter === 'all' || f.status === statusFilter
  );

  const newCount = feedbacks.filter(f => f.status === 'new').length;

  if (isLoading) {
    return <div className="p-6 text-center text-slate-500">Loading feedback...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Customer Feedback</h2>
          {newCount > 0 && (
            <Badge className="bg-purple-100 text-purple-700">{newCount} new</Badge>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="reviewing">Reviewing</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Feedback List */}
      {filteredFeedbacks.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p>No feedback yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFeedbacks.map((feedback) => {
            const TypeIcon = typeIcons[feedback.type] || MessageSquare;
            const color = typeColors[feedback.type] || 'slate';
            const status = statusConfig[feedback.status] || statusConfig.new;
            const screenshots = feedback.screenshot_urls ? JSON.parse(feedback.screenshot_urls) : [];

            return (
              <div
                key={feedback.id}
                onClick={() => {
                  setSelectedFeedback(feedback);
                  setAdminNotes(feedback.admin_notes || '');
                }}
                className={cn(
                  "p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-all",
                  feedback.status === 'new' && "border-l-4 border-l-purple-500"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    color === 'red' && "bg-red-100",
                    color === 'amber' && "bg-amber-100",
                    color === 'blue' && "bg-blue-100",
                    color === 'slate' && "bg-slate-100"
                  )}>
                    <TypeIcon className={cn(
                      "w-4 h-4",
                      color === 'red' && "text-red-600",
                      color === 'amber' && "text-amber-600",
                      color === 'blue' && "text-blue-600",
                      color === 'slate' && "text-slate-600"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900 truncate">
                        {feedback.subject || feedback.description.slice(0, 50)}
                      </span>
                      <Badge className={cn("text-xs", status.color)}>{status.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{feedback.customer_name}</span>
                      <span>•</span>
                      <span>{feedback.submitted_by_name || feedback.submitted_by}</span>
                      <span>•</span>
                      <span>{format(new Date(feedback.created_date), 'MMM d, h:mm a')}</span>
                      {screenshots.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {screenshots.length} image{screenshots.length > 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedFeedback && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const TypeIcon = typeIcons[selectedFeedback.type] || MessageSquare;
                    return <TypeIcon className="w-5 h-5" />;
                  })()}
                  {selectedFeedback.subject || 'Feedback Details'}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Meta */}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className={statusConfig[selectedFeedback.status]?.color}>
                    {statusConfig[selectedFeedback.status]?.label}
                  </Badge>
                  <span className="text-slate-500">from</span>
                  <span className="font-medium">{selectedFeedback.customer_name}</span>
                  <span className="text-slate-500">by</span>
                  <span className="font-medium">{selectedFeedback.submitted_by_name || selectedFeedback.submitted_by}</span>
                </div>

                {/* Description */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-slate-700 whitespace-pre-wrap">{selectedFeedback.description}</p>
                </div>

                {/* Screenshots */}
                {selectedFeedback.screenshot_urls && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Screenshots</p>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(selectedFeedback.screenshot_urls).map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={url}
                            alt={`Screenshot ${i + 1}`}
                            className="w-32 h-32 object-cover rounded-lg border border-slate-200 hover:border-purple-500 transition-colors"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Page URL */}
                {selectedFeedback.page_url && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">Submitted from:</span>
                    <a
                      href={selectedFeedback.page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:underline flex items-center gap-1"
                    >
                      View page <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Admin Notes */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Admin Notes</p>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes..."
                    className="min-h-[80px]"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveNotes}
                    disabled={adminNotes === (selectedFeedback.admin_notes || '')}
                  >
                    Save Notes
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <span className="text-sm text-slate-500 mr-2">Status:</span>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={selectedFeedback.status === key ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(selectedFeedback, key)}
                      className="text-xs"
                    >
                      {config.label}
                    </Button>
                  ))}
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deleteMutation.mutate(selectedFeedback.id)}
                  >
                    <Trash2 className="w-4 h-4" />
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
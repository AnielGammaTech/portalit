import React, { useState } from 'react';
import { client } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  Wrench,
} from 'lucide-react';

function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseCronSchedule(schedule) {
  const parts = schedule.split(' ');
  const min = parts[0];
  const hour = parts[1];
  const h = parseInt(hour);
  const m = parseInt(min);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function describeCronFrequency(schedule) {
  const parts = schedule.split(' ');
  if (parts.length < 5) return 'Scheduled';
  if (parts[4] && parts[4] !== '*') return 'Weekly';
  return 'Daily';
}

function statusIcon(job, isRunning) {
  if (isRunning) return <Loader2 className="w-5 h-5 animate-spin text-sky-500" />;
  if (job.isRecentFailure || job.health === 'failed') return <XCircle className="w-5 h-5 text-red-500" />;
  if (job.isStale) return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  if (job.lastRun?.status === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  return <Clock className="w-5 h-5 text-slate-300" />;
}

export default function CronJobsPanel() {
  const queryClient = useQueryClient();
  const [runningJob, setRunningJob] = useState(null);
  const [catchingUp, setCatchingUp] = useState(false);
  const [expandedJob, setExpandedJob] = useState(null);

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['cron_jobs'],
    queryFn: () => client.cronJobs.getJobs(),
    refetchInterval: 30000,
  });

  const { data: historyData } = useQuery({
    queryKey: ['cron_history', expandedJob],
    queryFn: () => client.cronJobs.getHistory(expandedJob, 20),
    enabled: !!expandedJob,
    placeholderData: undefined, // prevent stale data flash when switching jobs
  });

  const jobs = jobsData?.jobs || [];
  const history = historyData?.runs || [];
  const summary = jobsData?.summary || {};

  const handleRunJob = async (jobName) => {
    setRunningJob(jobName);
    try {
      const result = await client.cronJobs.runJob(jobName);
      if (result.success) {
        const retryText = result.attempts > 1 ? ` after ${result.attempts} attempts` : '';
        toast.success(`Job completed in ${formatDuration(result.durationMs)}${retryText}`);
      } else {
        toast.error(`Job failed: ${result.error}`);
      }
      queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['cron_history'] });
    } catch (error) {
      toast.error(error.message || 'Failed to run job');
    } finally {
      setRunningJob(null);
    }
  };

  const handleCatchUp = async () => {
    setCatchingUp(true);
    try {
      const result = await client.cronJobs.catchUp();
      if (result.queued?.length) {
        toast.success(`Queued ${result.queued.length} stale job${result.queued.length === 1 ? '' : 's'} for catch-up`);
      } else {
        toast.success('No stale jobs need catch-up');
      }
      queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
      queryClient.invalidateQueries({ queryKey: ['cron_history'] });
    } catch (error) {
      toast.error(error.message || 'Failed to queue catch-up');
    } finally {
      setCatchingUp(false);
    }
  };

  if (jobsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">
            {jobs.length} scheduled jobs &middot; {summary.healthy || 0} healthy &middot; {summary.stale || 0} stale &middot; {summary.backoff || 0} in retry backoff
          </p>
          <p className="text-xs text-slate-400">
            Stale jobs are queued automatically on startup and hourly; failed jobs wait before retrying.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCatchUp}
            disabled={catchingUp || jobsData?.catchupDisabled}
            className="gap-2"
          >
            {catchingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
            Queue Catch-Up
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['cron_jobs'] });
              queryClient.invalidateQueries({ queryKey: ['cron_history'] });
            }}
            className="gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {jobs.map((job) => {
          const isExpanded = expandedJob === job.name;
          const isRunning = runningJob === job.name || job.isRunning;
          const lastRun = job.lastRun;

          return (
            <div
              key={job.name}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              {/* Job card header */}
              <div className="flex items-center gap-4 p-4">
                {/* Status indicator */}
                <div className="flex-shrink-0">
                  {statusIcon(job, isRunning)}
                </div>

                {/* Job info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-900 text-sm">{job.label}</h4>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        job.category === 'halopsa' && "border-indigo-200 text-indigo-600",
                        job.category === 'system' && "border-amber-200 text-amber-600",
                      )}
                    >
                      {job.category}
                    </Badge>
                    {isRunning && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-sky-200 text-sky-600">
                        Running
                      </Badge>
                    )}
                    {!isRunning && job.isRecentFailure && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-200 text-red-600">
                        Backoff
                      </Badge>
                    )}
                    {!isRunning && !job.isRecentFailure && job.isStale && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-200 text-amber-600">
                        Stale
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{job.description}</p>
                </div>

                {/* Schedule */}
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="text-xs font-medium text-slate-700">
                    {parseCronSchedule(job.schedule)}
                  </p>
                  <p className="text-[10px] text-slate-400">{describeCronFrequency(job.schedule)}</p>
                </div>

                {/* Last run info */}
                <div className="text-right flex-shrink-0 hidden md:block min-w-[120px]">
                  {lastRun ? (
                    <>
                      <p className="text-xs text-slate-700">
                        Last run {formatTimeAgo(lastRun.completed_at)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Last ok {formatTimeAgo(job.lastSuccess?.completed_at)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">Never run</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRunJob(job.name)}
                    disabled={isRunning || !!runningJob}
                    className="h-8 w-8 p-0"
                    title="Run now"
                  >
                    {isRunning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedJob(isExpanded ? null : job.name)}
                    className="h-8 w-8 p-0"
                    title="View history"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Expanded history */}
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
                  <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Recent Runs
                  </h5>
                  {history.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">No execution history yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {history.map((run) => (
                        <div
                          key={run.id}
                          className="flex items-center gap-3 text-xs bg-white rounded-lg px-3 py-2 border border-slate-100"
                        >
                          {run.status === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          )}
                          <span className="text-slate-600 flex-1">
                            {new Date(run.completed_at).toLocaleString()}
                          </span>
                          <span className="text-slate-400">
                            {formatDuration(run.duration_ms)}
                          </span>
                          {run.error_message && (
                            <span className="text-red-500 truncate max-w-[200px]" title={run.error_message}>
                              {run.error_message}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

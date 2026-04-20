import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import {
  Upload, Trash2, ChevronDown,
  Mail, AlertTriangle, MousePointerClick, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import {
  IntegrationHeader, FilterBar, TablePagination, ITEMS_PER_PAGE,
  CONNECTION_STATES, getConnectionStatusDisplay,
} from './shared/IntegrationTableParts';
import InkyUploadModal from './InkyUploadModal';

const REPORT_TYPES = [
  { key: 'threat_level_overview', label: 'Threat Overview', icon: AlertTriangle, color: 'text-red-600' },
  { key: 'graymail', label: 'Graymail', icon: Mail, color: 'text-blue-600' },
  { key: 'link_clicks', label: 'Link Clicks', icon: MousePointerClick, color: 'text-amber-600' },
  { key: 'user_reporting', label: 'User Reporting', icon: Users, color: 'text-purple-600' },
];

export default function InkyConfig() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [uploadTarget, setUploadTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: reports = [] } = useQuery({
    queryKey: ['inky-reports'],
    queryFn: () => client.entities.InkyReport.list('-report_date', 1000),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  const allRows = useMemo(() => {
    const reportMap = {};
    for (const r of reports) {
      if (!r.customer_id) continue;
      if (!reportMap[r.customer_id]) reportMap[r.customer_id] = { latest: r, count: 0, byType: {} };
      reportMap[r.customer_id].count++;
      const type = r.report_type || 'threat_level_overview';
      if (!reportMap[r.customer_id].byType[type] || new Date(r.report_date) > new Date(reportMap[r.customer_id].byType[type].report_date)) {
        reportMap[r.customer_id].byType[type] = r;
      }
      if (new Date(r.report_date) > new Date(reportMap[r.customer_id].latest.report_date)) {
        reportMap[r.customer_id].latest = r;
      }
    }
    return customers.map(c => {
      const data = reportMap[c.id];
      return {
        customerId: c.id,
        customerName: c.name,
        mailboxes: data?.latest?.total_users ?? null,
        reportCount: data?.count || 0,
        lastReport: data?.latest?.report_date || null,
        byType: data?.byType || {},
        hasData: !!data,
      };
    }).sort((a, b) => {
      if (a.hasData !== b.hasData) return b.hasData ? 1 : -1;
      return a.customerName.localeCompare(b.customerName);
    });
  }, [customers, reports]);

  const mappedCount = useMemo(() => allRows.filter(r => r.hasData).length, [allRows]);

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r => r.customerName.toLowerCase().includes(q));
    }
    if (filterTab === 'mapped') rows = rows.filter(r => r.hasData);
    if (filterTab === 'unmapped') rows = rows.filter(r => !r.hasData);
    return rows;
  }, [allRows, searchQuery, filterTab]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const statusDisplay = getConnectionStatusDisplay(mappedCount > 0 ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.NOT_CONFIGURED);

  const handleSaveCount = useCallback(async (customerId, customerName) => {
    const count = parseInt(editValue, 10);
    if (isNaN(count) || count < 0) { toast.error('Enter a valid number'); return; }
    try {
      const existing = reports.find(r => r.customer_id === customerId);
      if (existing) {
        await client.entities.InkyReport.update(existing.id, { total_users: count, report_data: { total_users: count }, report_date: new Date().toISOString().split('T')[0] });
      } else {
        await client.entities.InkyReport.create({ customer_id: customerId, customer_name: customerName, total_users: count, report_data: { total_users: count }, report_type: 'user_count', report_date: new Date().toISOString().split('T')[0] });
      }
      toast.success(`${customerName}: ${count} mailboxes`);
      queryClient.invalidateQueries({ queryKey: ['inky-reports'] });
      setEditingId(null);
    } catch (err) { toast.error(err.message); }
  }, [editValue, reports, queryClient]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this report?')) return;
    await client.entities.InkyReport.delete(id);
    toast.success('Deleted');
    queryClient.invalidateQueries({ queryKey: ['inky-reports'] });
  };

  return (
    <div className="space-y-3">
      <IntegrationHeader statusDisplay={statusDisplay} integrationName="INKY" hasData={mappedCount > 0} mappedCount={mappedCount} totalCount={allRows.length}>
        <span className="text-xs text-slate-500">Use <strong>LootIT Link</strong> extension to sync mailbox counts</span>
      </IntegrationHeader>

      <FilterBar filterTab={filterTab} setFilterTab={setFilterTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        totalCount={allRows.length} mappedCount={mappedCount} unmappedCount={allRows.length - mappedCount} staleCount={0}
        onPageReset={() => setCurrentPage(1)} searchPlaceholder="Search customers..." />

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-10" />
              <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Customer</th>
              <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-24">Mailboxes</th>
              <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-20">Reports</th>
              <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-28">Last Report</th>
              <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-6 text-xs text-slate-400">No customers match</td></tr>
            ) : paginatedRows.map((row, idx) => {
              const isExpanded = expandedId === row.customerId;
              const isEditing = editingId === row.customerId;
              return (
                <React.Fragment key={row.customerId}>
                  <tr className={cn("transition-colors hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/40", isExpanded && "bg-blue-50/30")}
                    onClick={() => row.hasData && setExpandedId(isExpanded ? null : row.customerId)}
                    style={{ cursor: row.hasData ? 'pointer' : 'default' }}>
                    <td className="px-3 py-2 text-center">
                      {row.hasData && <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform mx-auto", isExpanded && "rotate-180")} />}
                      {!row.hasData && <div className="w-2 h-2 rounded-full bg-slate-300 mx-auto" />}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-slate-900">{row.customerName}</td>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" value={editValue} onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveCount(row.customerId, row.customerName); if (e.key === 'Escape') setEditingId(null); }}
                            className="w-16 h-6 text-xs text-right border border-blue-300 rounded px-1 focus:outline-none focus:ring-1 focus:ring-blue-400" autoFocus />
                          <button onClick={() => handleSaveCount(row.customerId, row.customerName)} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500 text-white">OK</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingId(row.customerId); setEditValue(row.mailboxes != null ? String(row.mailboxes) : ''); }}
                          className={cn("text-xs tabular-nums font-medium px-1.5 py-0.5 rounded hover:bg-slate-100", row.mailboxes != null ? "text-slate-900" : "text-slate-300")}>
                          {row.mailboxes ?? '—'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{row.reportCount || '—'}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-500">{row.lastReport ? format(new Date(row.lastReport), 'MMM d, yyyy') : '—'}</td>
                    <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setUploadTarget({ customerId: row.customerId, customerName: row.customerName, reportType: 'threat_level_overview' })}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Upload report">
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr><td colSpan={6} className="p-0">
                      <div className="bg-slate-50 border-t border-slate-200 px-4 py-3">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          {REPORT_TYPES.map(type => {
                            const Icon = type.icon;
                            const report = row.byType[type.key];
                            return (
                              <div key={type.key} className={cn("rounded-lg border p-2.5", report ? "bg-white border-slate-200" : "bg-slate-50 border-dashed border-slate-200")}>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Icon className={cn("w-3 h-3", type.color)} />
                                  <span className="text-[10px] font-semibold text-slate-700">{type.label}</span>
                                </div>
                                {report ? (
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-slate-500">{format(new Date(report.report_date), 'MMM d, yyyy')}</p>
                                    {report.total_threats_blocked > 0 && <p className="text-[10px] text-blue-600 font-medium">{report.total_threats_blocked} threats blocked</p>}
                                    <div className="flex gap-1">
                                      {report.pdf_url && <button onClick={() => window.open(report.pdf_url, '_blank')} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200">View</button>}
                                      <button onClick={() => setUploadTarget({ customerId: row.customerId, customerName: row.customerName, reportType: type.key })} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">Update</button>
                                      <button onClick={() => handleDelete(report.id)} className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 hover:bg-red-100">Delete</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => setUploadTarget({ customerId: row.customerId, customerName: row.customerName, reportType: type.key })}
                                    className="w-full flex items-center justify-center gap-1 py-1.5 rounded border border-dashed border-slate-300 text-[10px] text-slate-400 hover:text-blue-600 hover:border-blue-300">
                                    <Upload className="w-2.5 h-2.5" /> Upload
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filteredRows.length > ITEMS_PER_PAGE && (
          <TablePagination page={safePage} totalPages={totalPages} totalItems={filteredRows.length} perPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
        )}
      </div>

      <InkyUploadModal
        open={!!uploadTarget}
        onClose={() => setUploadTarget(null)}
        customerId={uploadTarget?.customerId}
        customerName={uploadTarget?.customerName}
        reportType={uploadTarget?.reportType}
      />
    </div>
  );
}

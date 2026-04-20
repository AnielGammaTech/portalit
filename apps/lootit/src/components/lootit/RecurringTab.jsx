import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { matchLineItemToRules } from '@/lib/lootit-reconciliation';
import { STATUS_COLORS } from './lootit-constants';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Filter } from 'lucide-react';

const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'matched', label: 'Matched' },
  { key: 'unmatched', label: 'Unmatched' },
  { key: 'unused', label: 'Unused' },
];

function formatCurrency(value) {
  return `$${parseFloat(value || 0).toFixed(2)}`;
}

export default function RecurringTab({ lineItems, rules, overrides = [], pax8MatchedIds = new Set() }) {
  const [filter, setFilter] = useState('all');

  // Build set of line item IDs that have manual Pax8 overrides
  const overrideLineItemIds = useMemo(() => {
    const ids = new Set();
    for (const ov of overrides) {
      if (ov.line_item_id) ids.add(ov.line_item_id);
    }
    return ids;
  }, [overrides]);

  // Match computation: classify each line item and identify unused rules
  const { matchedItems, unmatchedItems, unusedRules, counts } = useMemo(() => {
    const items = (lineItems || []).filter((li) => {
      const desc = (li.description || '').toLowerCase();
      if (desc.startsWith('discount')) return false;
      if ((parseFloat(li.quantity) || 0) === 0) return false;
      return true;
    });
    const allRules = rules || [];
    const activeRules = allRules.filter((r) => r.is_active);
    const matchedRuleIds = new Set();

    const matched = [];
    const unmatched = [];

    for (const lineItem of items) {
      // Check manual Pax8 override first — overrides everything
      if (overrideLineItemIds.has(lineItem.id)) {
        matched.push({ ...lineItem, matchStatus: 'matched', matchedRule: { label: 'Manually mapped' } });
        continue;
      }
      // Check Pax8 auto-match (matched by product name in reconciliation engine)
      if (pax8MatchedIds.has(lineItem.id)) {
        matched.push({ ...lineItem, matchStatus: 'matched', matchedRule: { label: 'Pax8 auto-matched' } });
        continue;
      }
      const matchingRules = matchLineItemToRules(lineItem, activeRules);
      if (matchingRules.length > 0) {
        matched.push({ ...lineItem, matchStatus: 'matched', matchedRule: matchingRules[0] });
        for (const r of matchingRules) {
          matchedRuleIds.add(r.id);
        }
      } else {
        unmatched.push({ ...lineItem, matchStatus: 'unmatched', matchedRule: null });
      }
    }

    const unused = activeRules
      .filter((r) => !matchedRuleIds.has(r.id))
      .map((r) => ({ ...r, matchStatus: 'unused' }));

    return {
      matchedItems: matched,
      unmatchedItems: unmatched,
      unusedRules: unused,
      counts: {
        all: matched.length + unmatched.length,
        matched: matched.length,
        unmatched: unmatched.length,
        unused: unused.length,
      },
    };
  }, [lineItems, rules, overrideLineItemIds, pax8MatchedIds]);

  // Filtered display list based on active filter
  const displayItems = useMemo(() => {
    switch (filter) {
      case 'matched':
        return { items: matchedItems, isRuleView: false };
      case 'unmatched':
        return { items: unmatchedItems, isRuleView: false };
      case 'unused':
        return { items: unusedRules, isRuleView: true };
      default:
        return { items: [...matchedItems, ...unmatchedItems], isRuleView: false };
    }
  }, [filter, matchedItems, unmatchedItems, unusedRules]);

  const hasNoData = (!lineItems || lineItems.length === 0) && (!rules || rules.length === 0);

  if (hasNoData) {
    return (
      <div className="text-center py-12">
        <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">No recurring line items for this customer</p>
      </div>
    );
  }

  return (
    <>
      {/* Filter chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {FILTER_CHIPS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                filter === f.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              )}
            >
              {f.label}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                filter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
              )}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {displayItems.items.length === 0 ? (
        <div className="text-center py-12">
          <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No items match this filter</p>
        </div>
      ) : displayItems.isRuleView ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Net Amount</TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Match Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.items.map((rule) => (
              <TableRow key={rule.id} className="text-slate-400">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_COLORS.neutral.bar)} />
                    <span className="italic">{rule.label}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">---</TableCell>
                <TableCell className="text-right tabular-nums">---</TableCell>
                <TableCell className="text-right tabular-nums">---</TableCell>
                <TableCell>---</TableCell>
                <TableCell>---</TableCell>
                <TableCell>
                  <span className={STATUS_COLORS.neutral.text}>No matching line item</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Net Amount</TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Match Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      item.matchStatus === 'matched' ? STATUS_COLORS.match.bar : STATUS_COLORS.under.bar
                    )} />
                    <span className="max-w-xs truncate">{item.description}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(item.price)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(item.net_amount)}</TableCell>
                <TableCell className="text-xs text-slate-500">{item.item_code || '---'}</TableCell>
                <TableCell>{item.active ? 'Active' : 'Inactive'}</TableCell>
                <TableCell>
                  {item.matchStatus === 'matched' ? (
                    <span className={STATUS_COLORS.match.text}>{item.matchedRule.label}</span>
                  ) : (
                    <span className={STATUS_COLORS.under.text}>Unmatched</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {/* Show unused rules at bottom when filter is 'all' */}
            {filter === 'all' && unusedRules.map((rule) => (
              <TableRow key={`unused-${rule.id}`} className="text-slate-400">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_COLORS.neutral.bar)} />
                    <span className="italic">{rule.label}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">---</TableCell>
                <TableCell className="text-right tabular-nums">---</TableCell>
                <TableCell className="text-right tabular-nums">---</TableCell>
                <TableCell>---</TableCell>
                <TableCell>---</TableCell>
                <TableCell>
                  <span className={STATUS_COLORS.neutral.text}>No matching line item</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

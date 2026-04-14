import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

/**
 * Clean up recurring billing line item descriptions for display.
 * - Removes HaloPSA `$recurringbillingdate` tokens
 * - Renames "GTVoice Extension" → "GTVoice Monthly Recurring"
 */
/**
 * Safe JSON parse — returns fallback on failure instead of throwing.
 */
export function safeJsonParse(value, fallback = null) {
  if (!value || typeof value !== 'string') return typeof value === 'object' ? value : fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

/**
 * Safe date format — returns fallback string if date is invalid.
 */
export function safeFormatDate(dateValue, formatStr, fallback = '—') {
  if (!dateValue) return fallback;
  try {
    const { format, parseISO } = require('date-fns');
    const d = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch { return fallback; }
}

export function formatLineItemDescription(desc) {
  if (!desc) return '';
  let cleaned = desc.replace(/\s*\$recurringbillingdate\s*/gi, '').trim();
  if (/GTVoice\s+Extension/i.test(cleaned)) {
    cleaned = cleaned.replace(/GTVoice\s+Extension[^]*/i, 'GTVoice Monthly Recurring');
  }
  return cleaned;
}

import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as fnsFormat, parseISO as fnsParseISO, differenceInDays as fnsDifferenceInDays, formatDistanceToNow as fnsFormatDistanceToNow } from 'date-fns';

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
    const d = typeof dateValue === 'string' ? fnsParseISO(dateValue) : dateValue;
    if (isNaN(d.getTime())) return fallback;
    return fnsFormat(d, formatStr);
  } catch { return fallback; }
}

/**
 * Safe differenceInDays — returns fallback if date is invalid.
 */
export function safeDifferenceInDays(dateValue, baseDate, fallback = null) {
  if (!dateValue) return fallback;
  try {
    const d = typeof dateValue === 'string' ? fnsParseISO(dateValue) : dateValue;
    if (isNaN(d.getTime())) return fallback;
    return fnsDifferenceInDays(d, baseDate);
  } catch { return fallback; }
}

/**
 * Safe formatDistanceToNow — returns fallback if date is invalid.
 */
export function safeFormatDistanceToNow(dateValue, options = {}, fallback = 'recently') {
  if (!dateValue) return fallback;
  try {
    const d = typeof dateValue === 'string' ? fnsParseISO(dateValue) : dateValue;
    if (isNaN(d.getTime())) return fallback;
    return fnsFormatDistanceToNow(d, options);
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

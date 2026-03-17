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
export function formatLineItemDescription(desc) {
  if (!desc) return '';
  let cleaned = desc.replace(/\s*\$recurringbillingdate\s*/gi, '').trim();
  if (/GTVoice\s+Extension/i.test(cleaned)) {
    cleaned = cleaned.replace(/GTVoice\s+Extension[^]*/i, 'GTVoice Monthly Recurring');
  }
  return cleaned;
}

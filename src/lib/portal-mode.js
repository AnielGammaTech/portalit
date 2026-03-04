/**
 * Portal Mode — build-time configuration for customer vs full portal.
 *
 * Set VITE_PORTAL_MODE=customer on the customer-portal Railway service
 * to lock down the app to customer-only routes and UI.
 */

export const PORTAL_MODE = import.meta.env.VITE_PORTAL_MODE || 'full';
export const isCustomerPortal = PORTAL_MODE === 'customer';
export const isFullPortal = PORTAL_MODE === 'full';

/** Pages accessible in customer portal mode */
export const CUSTOMER_ALLOWED_PAGES = new Set([
  'CustomerDetail',
  'CustomerSettings',
  'AwaitingAccess',
]);

/** Default landing page for customer portal */
export const CUSTOMER_PORTAL_MAIN_PAGE = 'CustomerDetail';

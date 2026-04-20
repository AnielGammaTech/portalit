/**
 * Extracts individual vendor items from cached_data for integrations
 * that store item-level details. Returns null for count-only integrations.
 *
 * @param {string} integrationKey
 * @param {object} cachedData
 * @returns {Array<{id: string, label: string, meta?: object}>|null}
 */
export function extractVendorItems(integrationKey, cachedData) {
  const extractor = ITEM_EXTRACTORS[integrationKey];
  if (!extractor) return null;
  const data = typeof cachedData === 'string'
    ? (() => { try { return JSON.parse(cachedData); } catch { return null; } })()
    : cachedData;
  if (!data) return null;
  return extractor(data);
}

const ITEM_EXTRACTORS = {
  spanning: (data) => {
    if (!Array.isArray(data.users)) return null;
    return data.users
      .filter(u => (u.userType || 'standard') !== 'archived')
      .map(u => ({
        id: u.email || u.userPrincipalName || u.id || '',
        label: u.displayName
          ? `${u.displayName} (${u.email || u.userPrincipalName || ''})`
          : u.email || u.userPrincipalName || u.id || 'Unknown',
        meta: { userType: u.userType },
      }))
      .filter(item => item.id);
  },

  spanning_archived: (data) => {
    if (!Array.isArray(data.users)) return null;
    return data.users
      .filter(u => u.userType === 'archived')
      .map(u => ({
        id: u.email || u.userPrincipalName || u.id || '',
        label: u.displayName
          ? `${u.displayName} (${u.email || u.userPrincipalName || ''})`
          : u.email || u.userPrincipalName || u.id || 'Unknown',
        meta: { userType: u.userType },
      }))
      .filter(item => item.id);
  },

  cove: (data) => {
    if (!Array.isArray(data.devices)) return null;
    return data.devices.map(d => ({
      id: d.name || d.deviceName || d.id || '',
      label: d.name || d.deviceName || d.id || 'Unknown Device',
      meta: { osType: d.osType },
    })).filter(item => item.id);
  },

  cove_workstation: (data) => {
    if (!Array.isArray(data.devices)) return null;
    return data.devices
      .filter(d => d.osType === 'Workstation')
      .map(d => ({
        id: d.name || d.deviceName || d.id || '',
        label: d.name || d.deviceName || d.id || 'Unknown Device',
        meta: { osType: d.osType },
      }))
      .filter(item => item.id);
  },

  cove_server: (data) => {
    if (!Array.isArray(data.devices)) return null;
    return data.devices
      .filter(d => d.osType === 'Server')
      .map(d => ({
        id: d.name || d.deviceName || d.id || '',
        label: d.name || d.deviceName || d.id || 'Unknown Device',
        meta: { osType: d.osType },
      }))
      .filter(item => item.id);
  },

  datto_edr: (data) => {
    const items = data.hosts || data.devices || data.agents;
    if (!Array.isArray(items)) return null;
    return items.map(d => ({
      id: d.hostname || d.name || d.id || '',
      label: d.hostname || d.name || d.id || 'Unknown Host',
      meta: {},
    })).filter(item => item.id);
  },

  unifi: (data) => {
    if (!Array.isArray(data.devices)) return null;
    return data.devices.map(d => ({
      id: d.mac || d.name || d.id || '',
      label: d.name || d.model || d.mac || 'Unknown Device',
      meta: { type: d.type || d.device_type, model: d.model },
    })).filter(item => item.id);
  },

  unifi_firewall: (data) => {
    if (!Array.isArray(data.devices)) return null;
    return data.devices
      .filter(d =>
        d.type === 'firewall' ||
        d.device_type === 'firewall' ||
        d.model?.toLowerCase().includes('udm') ||
        d.model?.toLowerCase().includes('usg') ||
        d.model?.toLowerCase().includes('gateway')
      )
      .map(d => ({
        id: d.mac || d.name || d.id || '',
        label: d.name || d.model || d.mac || 'Unknown Device',
        meta: { type: d.type || d.device_type, model: d.model },
      }))
      .filter(item => item.id);
  },

  pax8: (data) => {
    if (!Array.isArray(data.products)) return null;
    const items = [];
    for (const product of data.products) {
      const subs = product.subscriptions || [];
      if (subs.length === 0) {
        items.push({
          id: `product:${product.name}`,
          label: `${product.name} (qty: ${product.quantity || 0})`,
          meta: { quantity: product.quantity },
        });
      } else {
        for (const sub of subs) {
          items.push({
            id: sub.id || `sub:${product.name}:${sub.billingTerm || ''}`,
            label: `${product.name} — ${sub.billingTerm || 'subscription'} (qty: ${sub.quantity || 1})`,
            meta: { quantity: sub.quantity, billingTerm: sub.billingTerm },
          });
        }
      }
    }
    return items.length > 0 ? items : null;
  },
};

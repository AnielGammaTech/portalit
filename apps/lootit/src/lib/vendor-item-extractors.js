/**
 * Extracts individual vendor items from cached_data for integrations
 * that store item-level details. Returns null for count-only integrations.
 *
 * @param {string} integrationKey
 * @param {object} cachedData
 * @param {Array} [haloDevices] - HaloPSA devices for this customer (used by datto_rmm)
 * @returns {Array<{id: string, label: string, meta?: object}>|null}
 */
export function extractVendorItems(integrationKey, cachedData, haloDevices) {
  if (DEVICE_BACKED_KEYS[integrationKey] && Array.isArray(haloDevices) && haloDevices.length > 0) {
    return DEVICE_BACKED_KEYS[integrationKey](haloDevices);
  }
  const extractor = ITEM_EXTRACTORS[integrationKey];
  if (!extractor) return null;
  const data = typeof cachedData === 'string'
    ? (() => { try { return JSON.parse(cachedData); } catch { return null; } })()
    : cachedData;
  if (!data) return null;
  return extractor(data);
}

const DEVICE_BACKED_KEYS = {
  datto_rmm: (devices) =>
    devices.map(d => ({
      id: d.name || d.id || '',
      label: d.name || 'Unknown Device',
      meta: { deviceType: d.device_type },
    })).filter(i => i.id),
  datto_rmm_workstation: (devices) =>
    devices
      .filter(d => d.device_type === 'desktop' || d.device_type === 'laptop' || d.device_type === 'workstation')
      .map(d => ({
        id: d.name || d.id || '',
        label: d.name || 'Unknown Device',
        meta: { deviceType: d.device_type },
      })).filter(i => i.id),
  datto_rmm_server: (devices) =>
    devices
      .filter(d => d.device_type === 'server')
      .map(d => ({
        id: d.name || d.id || '',
        label: d.name || 'Unknown Device',
        meta: { deviceType: d.device_type },
      })).filter(i => i.id),
};

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

  jumpcloud: (data) => {
    if (!Array.isArray(data.users)) return null;
    return data.users
      .filter(u => u.state !== 'SUSPENDED')
      .map(u => ({
        id: u.email || u.id || '',
        label: [u.firstname, u.lastname].filter(Boolean).join(' ')
          ? `${[u.firstname, u.lastname].filter(Boolean).join(' ')} (${u.email || ''})`
          : u.email || u.username || u.id || 'Unknown',
        meta: { state: u.state, username: u.username },
      }))
      .filter(item => item.id);
  },

  rocket_cyber: (data) => {
    if (!Array.isArray(data.agents)) return null;
    return data.agents.map(a => ({
      id: a.id || a.hostname || '',
      label: a.hostname || a.name || 'Unknown Agent',
      meta: { os: a.os, status: a.status },
    })).filter(item => item.id);
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

// Vendor registry — maps URLs to vendor config
export const VENDORS = {
  inky: {
    key: 'inky',
    label: 'INKY',
    color: '#1e3a5f',
    matchUrls: ['app.inkyphishfence.com'],
    dataLabel: 'Mailboxes',
    supportsUpload: true,
    uploadLabel: 'Threat Report (PDF)',
    contentScript: 'content-scripts/inky.js',
  },
  bullphish: {
    key: 'bullphish',
    label: 'BullPhish ID',
    color: '#e53e3e',
    matchUrls: ['bullphishid.com', 'app.bullphishid.com', 'bullphish.kaseya.com'],
    dataLabel: 'Emails Sent',
    supportsUpload: true,
    uploadLabel: 'Phishing Report (PDF)',
    contentScript: 'content-scripts/bullphish.js',
  },
  darkweb: {
    key: 'darkweb',
    label: 'Dark Web ID',
    color: '#2d3748',
    matchUrls: ['darkwebid.com', 'app.darkwebid.com', 'darkweb.kaseya.com'],
    dataLabel: 'Domains',
    supportsUpload: true,
    uploadLabel: 'Scan Report (PDF)',
    contentScript: 'content-scripts/darkweb.js',
  },
  threecx: {
    key: 'threecx',
    label: '3CX',
    color: '#f6a623',
    matchUrls: ['login.3cx.com', '3cx.com/webclient', '.3cx.us', '.3cx.com.au'],
    dataLabel: 'Extensions',
    supportsUpload: false,
    contentScript: 'content-scripts/threecx.js',
  },
  graphus: {
    key: 'graphus',
    label: 'Graphus',
    color: '#00b4d8',
    matchUrls: ['cloud.graph.us', 'portal.graph.us', 'graph.us'],
    dataLabel: 'Protected Users',
    supportsUpload: false,
    contentScript: 'content-scripts/graphus.js',
  },
};

export function detectVendor(url) {
  if (!url) return null;
  const hostname = new URL(url).hostname;
  for (const vendor of Object.values(VENDORS)) {
    if (vendor.matchUrls.some(m => hostname.includes(m) || hostname.endsWith(m.replace('*', '')))) {
      return vendor;
    }
  }
  return null;
}

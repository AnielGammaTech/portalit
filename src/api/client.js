import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (url, options = {}) => {
      // 15s timeout for all Supabase REST calls
      // Compose with any existing signal to avoid clobbering
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: { eventsPerSecond: 2 },
  },
});

// ── Helpers ────────────────────────────────────────────────────────────

function toSnakeCase(str) {
  return str
    .replace(/([A-Z])/g, (match, _p1, offset) =>
      (offset > 0 ? '_' : '') + match.toLowerCase()
    )
    .replace(/__/g, '_');
}

// Cache the auth token to avoid calling getSession() on every API request.
// Supabase's onAuthStateChange keeps it up to date automatically.
let _cachedToken = null;
let _tokenExpiresAt = 0;

supabase.auth.onAuthStateChange((_event, session) => {
  _cachedToken = session?.access_token || null;
  // Cache until 60s before expiry (Supabase tokens are typically 3600s)
  _tokenExpiresAt = session?.expires_at
    ? (session.expires_at * 1000) - 60000
    : 0;
});

async function getAuthToken() {
  // Use cached token if still valid
  if (_cachedToken && Date.now() < _tokenExpiresAt) {
    return _cachedToken;
  }
  // Fallback: fetch fresh session (cold start or expired)
  const { data: { session } } = await supabase.auth.getSession();
  _cachedToken = session?.access_token || null;
  _tokenExpiresAt = session?.expires_at
    ? (session.expires_at * 1000) - 60000
    : 0;
  return _cachedToken;
}

async function apiFetch(path, { method = 'POST', body, timeout = 60000 } = {}) {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      const error = new Error('Request timed out');
      error.status = 408;
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Entity → Table Mapping ────────────────────────────────────────────
//
// Explicit mapping because Supabase tables are plural snake_case
// and toSnakeCase alone doesn't pluralize or handle acronyms (ID, EDR, SaaS).

const ENTITY_TABLE_MAP = {
  Activity: 'activities',
  Application: 'applications',
  BullPhishIDReport: 'bull_phish_id_reports',
  Contact: 'contacts',
  Contract: 'contracts',
  ContractItem: 'contract_items',
  CoveDataMapping: 'cove_data_mappings',
  Customer: 'customers',
  CustomerPortalSettings: 'customer_portal_settings',
  DarkWebIDMapping: 'dark_web_id_mappings',
  DarkWebIDReport: 'dark_web_id_reports',
  DattoEDRMapping: 'datto_edr_mappings',
  DattoSiteMapping: 'datto_site_mappings',
  Device: 'devices',
  Feedback: 'feedbacks',
  Invoice: 'invoices',
  InkyReport: 'inky_reports',
  InvoiceLineItem: 'invoice_line_items',
  JumpCloudMapping: 'jump_cloud_mappings',
  LootITContract: 'lootit_contracts',
  LicenseAssignment: 'license_assignments',
  Pax8LineItemOverride: 'pax8_line_item_overrides',
  Pax8Mapping: 'pax8_mappings',
  PortalSettings: 'portal_settings',
  Quote: 'quotes',
  QuoteItem: 'quote_items',
  ReconciliationRule: 'reconciliation_rules',
  ReconciliationReview: 'reconciliation_reviews',
  RecurringBill: 'recurring_bills',
  RecurringBillLineItem: 'recurring_bill_line_items',
  RocketCyberIncident: 'rocket_cyber_incidents',
  RocketCyberMapping: 'rocket_cyber_mappings',
  SaaSAlertsMapping: 'saas_alerts_mappings',
  SaaSLicense: 'saas_licenses',
  Settings: 'settings',
  SpanningMapping: 'spanning_mappings',
  SyncLog: 'sync_logs',
  ThreeCXMapping: 'threecx_mappings',
  ThreeCXReport: 'threecx_reports',
  Ticket: 'tickets',
  UniFiMapping: 'unifi_mappings',
  User: 'users',
  VendorBilling: 'vendor_billings',
};

// ── Entity Proxy ───────────────────────────────────────────────────────
//
// Provides the same API as client.entities.EntityName.method()
// but backed by Supabase PostgreSQL.

function createEntityHandler(entityName) {
  const tableName = ENTITY_TABLE_MAP[entityName] || toSnakeCase(entityName);

  return {
    async list(sortField, limit) {
      let query = supabase.from(tableName).select('*');

      if (sortField) {
        const desc = sortField.startsWith('-');
        const col = desc ? sortField.slice(1) : sortField;
        query = query.order(col, { ascending: !desc });
      }

      // Default limit prevents unbounded table scans on large tables
      query = query.limit(limit || 1000);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async filter(filters, sortField, limit) {
      let query = supabase.from(tableName).select('*');

      if (filters && typeof filters === 'object') {
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }
      }

      if (sortField) {
        const desc = sortField.startsWith('-');
        const col = desc ? sortField.slice(1) : sortField;
        query = query.order(col, { ascending: !desc });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async filterIn(column, values, sortField, limit) {
      if (!values || values.length === 0) return [];
      let query = supabase.from(tableName).select('*').in(column, values);

      if (sortField) {
        const desc = sortField.startsWith('-');
        const col = desc ? sortField.slice(1) : sortField;
        query = query.order(col, { ascending: !desc });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async count(filters) {
      let query = supabase.from(tableName).select('*', { count: 'exact', head: true });
      if (filters && typeof filters === 'object') {
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }
      }
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },

    async create(record) {
      const { data, error } = await supabase
        .from(tableName)
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async update(id, updates) {
      const { data, error } = await supabase
        .from(tableName)
        .update({ ...updates, updated_date: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },

    async bulkCreate(records) {
      const { data, error } = await supabase
        .from(tableName)
        .insert(records)
        .select();
      if (error) throw error;
      return data || [];
    },

    subscribe(callback) {
      const channel = supabase
        .channel(`${tableName}_changes`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tableName },
          (payload) => callback({ data: payload.new || payload.old })
        )
        .subscribe();

      // Return unsubscribe function
      return () => supabase.removeChannel(channel);
    },
  };
}

const entities = new Proxy(
  {},
  {
    get(_target, entityName) {
      return createEntityHandler(String(entityName));
    },
  }
);

// ── Auth ───────────────────────────────────────────────────────────────

const auth = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      const authError = new Error('Not authenticated');
      authError.status = 401;
      throw authError;
    }

    // Fetch profile from users table
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single();

    return {
      id: profile?.id || user.id,
      auth_id: user.id,
      email: user.email,
      full_name: profile?.full_name || '',
      role: profile?.role || 'user',
      customer_id: profile?.customer_id || null,
      customer_name: profile?.customer_name || null,
      ...profile,
    };
  },

  logout(redirectUrl) {
    supabase.auth.signOut();
    if (redirectUrl) {
      window.location.href = '/login';
    }
  },

  redirectToLogin(returnUrl) {
    const params = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
    window.location.href = `/login${params}`;
  },

  async updateMe(data) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('users')
      .update(data)
      .eq('auth_id', user.id);
    if (error) throw error;
  },
};

// ── Functions ──────────────────────────────────────────────────────────

const functions = {
  async invoke(functionName, params = {}) {
    return apiFetch(`/api/functions/${functionName}`, { body: params });
  },
};

// ── Integrations ───────────────────────────────────────────────────────

const integrations = {
  Core: {
    async UploadFile({ file }) {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${apiBaseUrl}/api/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      return data; // { file_url: '...' }
    },

    async InvokeLLM(params) {
      return apiFetch('/api/llm/invoke', { body: params, timeout: 180000 });
    },
  },
};

// ── Agents ─────────────────────────────────────────────────────────────

const agents = {
  async createConversation(config) {
    // Create a conversation record in Supabase
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        agent_name: config.agent_name,
        metadata: config.metadata || {},
        messages: [],
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  subscribeToConversation(conversationId, callback) {
    const channel = supabase
      .channel(`conversation_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`,
        },
        (payload) => callback(payload.new)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  },

  async addMessage(conversation, message) {
    return apiFetch('/api/agents/message', {
      body: { conversation_id: conversation.id, ...message },
    });
  },
};

// ── Users ──────────────────────────────────────────────────────────────

const users = {
  async inviteUser(email, role, invite_type = 'tech', customer_id, full_name) {
    return apiFetch('/api/users/invite', {
      body: { email, role, invite_type, customer_id, full_name },
    });
  },

  async getAuthDetails() {
    return apiFetch('/api/users/auth-details', { method: 'GET' });
  },

  async getSignIns(userId) {
    return apiFetch(`/api/users/${userId}/sign-ins`, { method: 'GET' });
  },

  async resendInvite(email) {
    return apiFetch('/api/users/resend-invite', { body: { email } });
  },
};

// ── HaloPSA ─────────────────────────────────────────────────────────────

const halo = {
  async getStatus() {
    return apiFetch('/api/halo/status', { method: 'GET' });
  },
  async testConnection() {
    return apiFetch('/api/halo/test');
  },
  async syncAll() {
    return apiFetch('/api/halo/sync');
  },
  async syncCustomer(customerId) {
    return apiFetch('/api/halo/sync/customer', { body: { customer_id: customerId } });
  },
  async syncContacts(customerId) {
    return apiFetch('/api/halo/sync/contacts', { body: { customer_id: customerId } });
  },
  async getHaloCustomers() {
    return apiFetch('/api/halo/customers', { method: 'GET' });
  },
};

// ── App Logs ───────────────────────────────────────────────────────────

const appLogs = {
  async logUserInApp(_pageName) {
    // No-op: analytics not implemented.
    // Can optionally log to an analytics table if needed.
  },
};

// ── Cron Jobs ─────────────────────────────────────────────────────────

const cronJobs = {
  async getJobs() {
    return apiFetch('/api/cron/jobs', { method: 'GET' });
  },
  async getHistory(jobName, limit = 50) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (jobName) params.set('job_name', jobName);
    return apiFetch(`/api/cron/history?${params}`, { method: 'GET' });
  },
  async runJob(jobName) {
    return apiFetch('/api/cron/run', { body: { job_name: jobName }, timeout: 120000 });
  },
};

// ── Exported Client ────────────────────────────────────────────────────

export const client = {
  entities,
  auth,
  functions,
  integrations,
  agents,
  users,
  halo,
  appLogs,
  cronJobs,
};

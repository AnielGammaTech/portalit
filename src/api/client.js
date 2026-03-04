import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Helpers ────────────────────────────────────────────────────────────

function toSnakeCase(str) {
  return str
    .replace(/([A-Z])/g, (match, _p1, offset) =>
      (offset > 0 ? '_' : '') + match.toLowerCase()
    )
    .replace(/__/g, '_');
}

async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function apiFetch(path, { method = 'POST', body } = {}) {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

// ── Entity Proxy ───────────────────────────────────────────────────────
//
// Provides the same API as client.entities.EntityName.method()
// but backed by Supabase PostgreSQL.

function createEntityHandler(entityName) {
  const tableName = toSnakeCase(entityName);

  return {
    async list(sortField, limit) {
      let query = supabase.from(tableName).select('*');

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
      return apiFetch('/api/llm/invoke', { body: params });
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
  async inviteUser(email, role) {
    return apiFetch('/api/users/invite', { body: { email, role } });
  },
};

// ── App Logs ───────────────────────────────────────────────────────────

const appLogs = {
  async logUserInApp(_pageName) {
    // No-op: analytics not implemented.
    // Can optionally log to an analytics table if needed.
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
  appLogs,
};

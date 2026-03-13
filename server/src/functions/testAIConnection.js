import { getServiceSupabase } from '../lib/supabase.js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const PROVIDER_CONFIG = {
  anthropic: {
    envKey: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'claude-haiku-4-20250514', label: 'Claude Haiku 4' },
    ],
  },
  openai: {
    envKey: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    ],
  },
};

async function testAnthropicConnection() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'REPLACE_ME') {
    return { success: false, error: 'ANTHROPIC_API_KEY not configured' };
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-haiku-4-20250514',
    max_tokens: 20,
    messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
  });

  const text = response.content.find(c => c.type === 'text')?.text || '';
  return { success: true, message: `Claude connected — response: "${text.trim()}"` };
}

async function testOpenAIConnection() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'REPLACE_ME') {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 20,
    messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
  });

  const text = response.choices[0]?.message?.content || '';
  return { success: true, message: `OpenAI connected — response: "${text.trim()}"` };
}

export async function testAIConnection(body, user) {
  const supabase = getServiceSupabase();
  const { action, provider, model } = body;

  switch (action) {
    case 'get_config': {
      const { data: settings } = await supabase
        .from('portal_settings')
        .select('ai_provider, ai_model')
        .limit(1)
        .single();

      const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'REPLACE_ME';
      const openaiConfigured = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'REPLACE_ME';

      return {
        success: true,
        config: {
          provider: settings?.ai_provider || 'anthropic',
          model: settings?.ai_model || 'claude-sonnet-4-20250514',
          providers: PROVIDER_CONFIG,
          keyStatus: {
            anthropic: anthropicConfigured,
            openai: openaiConfigured,
          },
        },
      };
    }

    case 'test_connection': {
      try {
        const targetProvider = provider || 'anthropic';
        if (targetProvider === 'anthropic') return await testAnthropicConnection();
        if (targetProvider === 'openai') return await testOpenAIConnection();
        return { success: false, error: `Unknown provider: ${targetProvider}` };
      } catch (error) {
        return { success: false, error: error.message || 'Connection test failed' };
      }
    }

    case 'save_config': {
      if (!provider) return { success: false, error: 'Provider is required' };

      const validProviders = Object.keys(PROVIDER_CONFIG);
      if (!validProviders.includes(provider)) {
        return { success: false, error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` };
      }

      const selectedModel = model || PROVIDER_CONFIG[provider].models[0].id;

      // Upsert portal_settings
      const { data: existing } = await supabase
        .from('portal_settings')
        .select('id')
        .limit(1)
        .single();

      if (existing) {
        await supabase
          .from('portal_settings')
          .update({ ai_provider: provider, ai_model: selectedModel })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('portal_settings')
          .insert({ ai_provider: provider, ai_model: selectedModel });
      }

      return { success: true, message: `AI provider set to ${provider} (${selectedModel})` };
    }

    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

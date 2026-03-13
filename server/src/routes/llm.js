import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { requireAuth } from '../middleware/auth.js';
import { getServiceSupabase } from '../lib/supabase.js';

const router = Router();

let anthropicClient = null;
let openaiClient = null;

function getAnthropic() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function getOpenAI() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

async function getAISettings() {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('portal_settings')
    .select('ai_provider, ai_model')
    .limit(1)
    .single();

  return {
    provider: data?.ai_provider || 'anthropic',
    model: data?.ai_model || 'claude-sonnet-4-20250514',
  };
}

async function invokeAnthropic(prompt, model, jsonSchema) {
  const anthropic = getAnthropic();

  const requestParams = {
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  };

  if (jsonSchema) {
    requestParams.system = `You must respond with valid JSON matching this schema: ${JSON.stringify(jsonSchema)}. Do not include any text outside the JSON.`;
  }

  const response = await anthropic.messages.create(requestParams);
  const textContent = response.content.find(c => c.type === 'text');
  return textContent?.text || '';
}

async function invokeOpenAI(prompt, model, jsonSchema) {
  const openai = getOpenAI();

  const messages = [{ role: 'user', content: prompt }];

  if (jsonSchema) {
    messages.unshift({
      role: 'system',
      content: `You must respond with valid JSON matching this schema: ${JSON.stringify(jsonSchema)}. Do not include any text outside the JSON.`,
    });
  }

  const response = await openai.chat.completions.create({
    model,
    max_tokens: 4096,
    messages,
  });

  return response.choices[0]?.message?.content || '';
}

router.post('/invoke', requireAuth, async (req, res, next) => {
  try {
    const { prompt, response_json_schema } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const { provider, model } = await getAISettings();

    let responseText;

    if (provider === 'openai') {
      responseText = await invokeOpenAI(prompt, model, response_json_schema);
    } else {
      responseText = await invokeAnthropic(prompt, model, response_json_schema);
    }

    if (response_json_schema) {
      try {
        const parsed = JSON.parse(responseText);
        return res.json(parsed);
      } catch {
        return res.json(responseText);
      }
    }

    res.json(responseText);
  } catch (error) {
    next(error);
  }
});

export { router as llmRouter };

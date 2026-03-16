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

  let model = data?.ai_model || 'claude-sonnet-4-20250514';
  // Fix legacy incorrect model ID
  if (model === 'claude-haiku-4-20250514') model = 'claude-haiku-4-5-20251001';

  return {
    provider: data?.ai_provider || 'anthropic',
    model,
  };
}

async function fetchFileAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from ${url}: ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || 'application/pdf';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { base64: buffer.toString('base64'), contentType };
}

async function invokeAnthropic(prompt, model, jsonSchema, fileUrls) {
  const anthropic = getAnthropic();

  // Build content blocks: files first, then prompt text
  const contentBlocks = [];

  if (fileUrls?.length) {
    for (const url of fileUrls) {
      const { base64, contentType } = await fetchFileAsBase64(url);
      if (contentType.includes('pdf')) {
        contentBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        });
      } else if (contentType.startsWith('image/')) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: contentType, data: base64 },
        });
      }
    }
  }

  contentBlocks.push({ type: 'text', text: prompt });

  const requestParams = {
    model,
    max_tokens: 8192,
    messages: [{ role: 'user', content: contentBlocks }],
  };

  if (jsonSchema) {
    requestParams.system = `You must respond with valid JSON matching this schema: ${JSON.stringify(jsonSchema)}. Do not include any text outside the JSON.`;
  }

  const response = await anthropic.messages.create(requestParams);
  const textContent = response.content.find(c => c.type === 'text');
  return textContent?.text || '';
}

async function invokeOpenAI(prompt, model, jsonSchema, fileUrls) {
  const openai = getOpenAI();

  // Build content parts: files first, then prompt text
  const contentParts = [];

  if (fileUrls?.length) {
    for (const url of fileUrls) {
      const { base64, contentType } = await fetchFileAsBase64(url);
      if (contentType.startsWith('image/')) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: `data:${contentType};base64,${base64}` },
        });
      } else if (contentType.includes('pdf')) {
        // OpenAI supports file input via the file object for some models,
        // but for broad compatibility, include as a URL data reference
        contentParts.push({
          type: 'file',
          file: { filename: 'report.pdf', file_data: `data:application/pdf;base64,${base64}` },
        });
      }
    }
  }

  contentParts.push({ type: 'text', text: prompt });

  const messages = [{ role: 'user', content: contentParts }];

  if (jsonSchema) {
    messages.unshift({
      role: 'system',
      content: `You must respond with valid JSON matching this schema: ${JSON.stringify(jsonSchema)}. Do not include any text outside the JSON.`,
    });
  }

  const response = await openai.chat.completions.create({
    model,
    max_tokens: 8192,
    messages,
  });

  return response.choices[0]?.message?.content || '';
}

router.post('/invoke', requireAuth, async (req, res, next) => {
  try {
    const { prompt, file_urls, response_json_schema } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const { provider, model } = await getAISettings();

    let responseText;

    if (provider === 'openai') {
      responseText = await invokeOpenAI(prompt, model, response_json_schema, file_urls);
    } else {
      responseText = await invokeAnthropic(prompt, model, response_json_schema, file_urls);
    }

    if (response_json_schema) {
      try {
        // Handle cases where the LLM wraps JSON in markdown code blocks
        let jsonText = responseText.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }
        const parsed = JSON.parse(jsonText);
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

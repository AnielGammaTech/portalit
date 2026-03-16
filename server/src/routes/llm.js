import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
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

  const provider = data?.ai_provider || 'anthropic';
  let model = data?.ai_model || 'claude-sonnet-4-20250514';
  if (model === 'claude-haiku-4-20250514') model = 'claude-haiku-4-5-20251001';

  // Validate model matches provider to prevent cross-provider errors
  if (provider === 'openai' && model.startsWith('claude')) {
    model = 'gpt-4o';
  } else if (provider === 'anthropic' && (model.startsWith('gpt') || model.startsWith('o1'))) {
    model = 'claude-sonnet-4-20250514';
  }

  return { provider, model };
}

// Validate URL to prevent SSRF — only allow http(s) to public hosts
function validateFileUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid file URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    /^localhost$/, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./, /^169\.254\./, /^0\./, /^\[::1\]/, /^metadata\./, /\.internal$/,
  ];
  if (blocked.some(re => re.test(hostname))) {
    throw new Error('URL points to a restricted address');
  }
  return url;
}

async function getFileContentType(url) {
  const safeUrl = validateFileUrl(url);
  const response = await fetch(safeUrl, { method: 'HEAD' });
  return response.headers.get('content-type') || 'application/pdf';
}

/**
 * Download a PDF from a URL and extract its text content server-side.
 * This bypasses the Anthropic 100-page PDF limit entirely.
 * Uses pdf-parse v2.4.5 PDFParse class API.
 */
async function extractPdfText(url) {
  const safeUrl = validateFileUrl(url);
  const response = await fetch(safeUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  const pageCount = result.total || 0;
  const text = result.text || '';
  console.log(`[LLM] Extracted text from PDF: ${pageCount} pages, ${text.length} chars`);
  return { text, pageCount };
}

async function invokeAnthropic(prompt, model, jsonSchema, fileUrls) {
  const anthropic = getAnthropic();

  // Build content blocks: files first, then prompt text
  const contentBlocks = [];

  if (fileUrls?.length) {
    for (const fileUrl of fileUrls) {
      const safeUrl = validateFileUrl(fileUrl);
      const contentType = await getFileContentType(safeUrl);

      if (contentType.includes('pdf')) {
        // Extract text server-side to bypass Anthropic's 100-page PDF limit
        const { text, pageCount } = await extractPdfText(safeUrl);
        contentBlocks.push({
          type: 'text',
          text: `[PDF Document — ${pageCount} pages]\n\n${text}`,
        });
      } else if (contentType.startsWith('image/')) {
        contentBlocks.push({
          type: 'image',
          source: { type: 'url', url: safeUrl },
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
    for (const fileUrl of fileUrls) {
      const safeUrl = validateFileUrl(fileUrl);
      const contentType = await getFileContentType(safeUrl);

      if (contentType.startsWith('image/')) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: safeUrl },
        });
      } else if (contentType.includes('pdf')) {
        // Extract text server-side — OpenAI Chat Completions doesn't support PDF natively
        const { text, pageCount } = await extractPdfText(safeUrl);
        contentParts.push({
          type: 'text',
          text: `[PDF Document — ${pageCount} pages]\n\n${text}`,
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

router.post('/invoke', requireAdmin, async (req, res, next) => {
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

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

let anthropicClient = null;

function getAnthropic() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

router.post('/invoke', requireAuth, async (req, res, next) => {
  try {
    const { prompt, response_json_schema, add_context_from_internet } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const anthropic = getAnthropic();

    const messages = [{ role: 'user', content: prompt }];

    const requestParams = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages,
    };

    // If a JSON schema is requested, instruct the model to return JSON
    if (response_json_schema) {
      requestParams.system = `You must respond with valid JSON matching this schema: ${JSON.stringify(response_json_schema)}. Do not include any text outside the JSON.`;
    }

    const response = await anthropic.messages.create(requestParams);

    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent?.text || '';

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

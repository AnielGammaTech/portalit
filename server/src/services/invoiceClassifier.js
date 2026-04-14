import Anthropic from '@anthropic-ai/sdk';

const CATEGORIES = ['monthly_recurring', 'voip', 'ticket_adhoc', 'hardware_project', 'uncategorized'];
const CONFIDENCE_THRESHOLD = 70;

let anthropicClient = null;

function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export async function classifyInvoice({ customerName, lineItems, invoiceTotal }) {
  if (!lineItems || lineItems.length === 0) {
    return { category: 'uncategorized', confidence: 0 };
  }

  const lineItemsSummary = lineItems
    .map(li => `- ${li.description} | qty: ${li.quantity} | unit: $${li.unit_price} | total: $${li.total}${li.item_code ? ` | code: ${li.item_code}` : ''}`)
    .join('\n');

  const prompt = `Classify this invoice into exactly one category based on its line items.

Categories:
- monthly_recurring: Managed services, Microsoft 365/Azure licenses, backup subscriptions, security subscriptions, RMM, endpoint protection, email filtering
- voip: VoIP services, SIP trunks, phone systems, 3CX, call plans, network management, hosted PBX, phone hardware rental
- ticket_adhoc: One-time labor, ad-hoc tickets, break-fix work, consulting hours, time-based billing, support incidents
- hardware_project: Hardware purchases, equipment sales, project-based installs, cabling, server deployments, one-time infrastructure
- uncategorized: Cannot determine with confidence

Customer: ${customerName}
Invoice Total: $${invoiceTotal}

Line Items:
${lineItemsSummary}

Respond with JSON only: { "category": "<one of the categories above>", "confidence": <0-100> }`;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (response.content.find(c => c.type === 'text')?.text || '').trim();
    let jsonText = text;
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    const category = CATEGORIES.includes(parsed.category) ? parsed.category : 'uncategorized';
    const confidence = Math.max(0, Math.min(100, parseInt(parsed.confidence, 10) || 0));

    if (confidence < CONFIDENCE_THRESHOLD) {
      return { category: 'uncategorized', confidence };
    }

    return { category, confidence };
  } catch (err) {
    console.error(`[InvoiceClassifier] Classification failed: ${err.message}`);
    return { category: 'uncategorized', confidence: 0 };
  }
}

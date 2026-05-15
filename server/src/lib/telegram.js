const TELEGRAM_API = 'https://api.telegram.org';

export function isTelegramConfigured() {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegramMessage(text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping');
    return { success: false, skipped: true };
  }

  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[Telegram] Send failed:', res.status, body);
    return { success: false, error: body };
  }

  return { success: true };
}

import Anthropic from '@anthropic-ai/sdk';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterOptions {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
}

/** Достаточный запас для 4 блоков сценария на русском (раньше 3000 обрезало фиксацию). */
export const SCENARIO_OUTPUT_MAX_TOKENS = 12_000;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Map OpenRouter model IDs to Anthropic model IDs
function resolveModel(model: string): string {
  const modelMap: Record<string, string> = {
    'anthropic/claude-opus-4-5': 'claude-opus-4-5',
    'anthropic/claude-3.7-sonnet': 'claude-opus-4-5',
    'anthropic/claude-sonnet-4.5': 'claude-opus-4-5',
    'openai/gpt-4o': 'claude-opus-4-5',
    'openai/gpt-4o-mini': 'claude-opus-4-5',
    'google/gemini-2.5-pro': 'claude-opus-4-5',
  };
  return modelMap[model] ?? 'claude-opus-4-5';
}

export async function callOpenRouter(options: OpenRouterOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY не настроен');
  }

  const model = resolveModel(options.model);

  // Extract system message and user/assistant messages separately
  const systemMessage = options.messages.find((m) => m.role === 'system')?.content ?? '';
  const conversationMessages = options.messages.filter((m) => m.role !== 'system');

  // Ensure messages alternate properly and start with 'user'
  const anthropicMessages: Anthropic.MessageParam[] = conversationMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // If no conversation messages, add a placeholder
  if (anthropicMessages.length === 0) {
    anthropicMessages.push({ role: 'user', content: 'Начни работу.' });
  }

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: options.max_tokens ?? 2000,
      temperature: options.temperature ?? 0.7,
      system: systemMessage || undefined,
      messages: anthropicMessages,
    });

    if (response.stop_reason === 'max_tokens') {
      console.warn(
        '[callOpenRouter] Ответ обрезан по max_tokens — увеличьте max_tokens или сократите промпт.',
      );
    }

    const content = response.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('AI не вернул результат. Попробуйте снова или заполните вручную');
    }

    return content.text;
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const msg = err.message ?? '';
      const billingHint =
        /credit balance|Plans & Billing|insufficient_quota|billing/i.test(msg) ||
        err.status === 402;
      if (billingHint) {
        throw new Error(
          'На аккаунте Anthropic закончились кредиты или не настроена оплата. Откройте console.anthropic.com → Plans & Billing, пополните баланс или проверьте ключ ANTHROPIC_API_KEY в .env.local.'
        );
      }
      if (err.status === 401) throw new Error('Проверьте API ключ Anthropic в настройках');
      if (err.status === 429) throw new Error('Превышен лимит запросов. Попробуйте через минуту');
      if (err.status === 529) throw new Error('Сервис AI перегружен. Попробуйте через минуту');
      throw new Error(`Сервис AI временно недоступен (${err.status}): ${msg.slice(0, 280)}`);
    }
    throw err;
  }
}

export const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-opus-4-5', name: 'Claude Opus 4.5', context_length: 200000 },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', context_length: 200000 },
  { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', context_length: 200000 },
];

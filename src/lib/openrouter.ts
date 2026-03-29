const DEFAULT_OPENROUTER_MODEL = 'google/gemma-3-4b-it:free';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 2;

export interface OpenRouterExtractedField {
  label: string;
  canonicalKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface OpenRouterChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCanonicalKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extractAssistantText(payload: OpenRouterChatResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim();
  }

  return '';
}

function parseJsonLenient(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Model returned empty content');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with fallbacks.
  }

  const fencedMatches = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/gi) ?? [];
  for (const fenced of fencedMatches) {
    const candidate = fenced.replace(/```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next fenced block.
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    return JSON.parse(candidate);
  }

  throw new Error('Could not parse model output as JSON');
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeExtractedFields(data: unknown): OpenRouterExtractedField[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const root = data as Record<string, unknown>;
  const fields = Array.isArray(root.fields) ? root.fields : [];

  return fields
    .map((item): OpenRouterExtractedField | null => {
      if (!item || typeof item !== 'object') return null;

      const record = item as Record<string, unknown>;
      const label = typeof record.label === 'string' ? record.label.trim() : '';

      const rawCanonical =
        typeof record.canonicalKey === 'string'
          ? record.canonicalKey
          : typeof record.canonical_key === 'string'
            ? record.canonical_key
            : label;

      const canonicalKey = normalizeCanonicalKey(rawCanonical);
      const bbox = (record.bbox ?? {}) as Record<string, unknown>;

      const x = asNumber(record.x ?? bbox.x);
      const y = asNumber(record.y ?? bbox.y);
      const width = asNumber(record.width ?? bbox.width);
      const height = asNumber(record.height ?? bbox.height);

      if (!label || !canonicalKey || width <= 0 || height <= 0) {
        return null;
      }

      const confidence = Math.max(0, Math.min(1, asNumber(record.confidence, 0.75)));

      return {
        label,
        canonicalKey,
        x,
        y,
        width,
        height,
        confidence,
      };
    })
    .filter((item): item is OpenRouterExtractedField => item !== null);
}

function buildExtractionPrompt(): string {
  return [
    'You are extracting fillable form fields from an image.',
    'Return strict JSON only. No markdown.',
    'Schema:',
    '{',
    '  "fields": [',
    '    {',
    '      "label": "visible field label",',
    '      "canonical_key": "snake_case_key",',
    '      "bbox": { "x": 0, "y": 0, "width": 0, "height": 0 },',
    '      "confidence": 0.0',
    '    }',
    '  ]',
    '}',
    'Rules:',
    '- Include only fields intended to be filled by a user.',
    '- Coordinates are pixel values relative to the input image.',
    '- Confidence must be between 0 and 1.',
    '- canonical_key should be stable and semantic, e.g. first_name, date_of_birth, phone_number.',
  ].join('\n');
}

export async function extractFieldsWithOpenRouter(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<OpenRouterExtractedField[]> {
  const apiKey = getRequiredEnv('OPENROUTER_API_KEY');
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
  const timeoutMs = getNumberEnv('OPENROUTER_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const retries = getNumberEnv('OPENROUTER_RETRIES', DEFAULT_RETRIES);

  const imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  const payload = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildExtractionPrompt(),
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
            },
          },
        ],
      },
    ],
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(process.env.OPENROUTER_SITE_URL
            ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL }
            : {}),
          ...(process.env.OPENROUTER_APP_NAME
            ? { 'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME }
            : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;

        if (retryable && attempt < retries) {
          await sleep((attempt + 1) * 500);
          continue;
        }

        throw new Error(`OpenRouter request failed (${response.status}): ${bodyText}`);
      }

      const result = (await response.json()) as OpenRouterChatResponse;
      const assistantText = extractAssistantText(result);
      const parsed = parseJsonLenient(assistantText);
      const fields = normalizeExtractedFields(parsed);

      if (fields.length === 0) {
        throw new Error('OpenRouter returned no valid fields');
      }

      return fields;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown OpenRouter error');
      if (attempt < retries) {
        await sleep((attempt + 1) * 500);
        continue;
      }
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw lastError ?? new Error('OpenRouter extraction failed');
}
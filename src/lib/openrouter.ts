import { devLogger } from '@/lib/devLogger';
import type { DetectedFormField, FillPoint, FormFieldMapping } from '@/lib/formTypes';
import { isOptionalFieldLabel, resolveCanonicalProfileKey } from '@/lib/profileKeys';

const DEFAULT_OPENROUTER_MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-3-27b-it:free',
  'google/gemma-3-12b-it:free',
  'google/gemma-3-4b-it:free',
];

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 2;

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

function getOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function getNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getModels(): string[] {
  const configuredModels = process.env.OPENROUTER_MODELS?.trim();
  if (configuredModels) {
    const models = configuredModels
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean);

    if (models.length > 0) {
      return models;
    }
  }

  const configuredModel = process.env.OPENROUTER_MODEL?.trim();
  if (configuredModel) {
    return [configuredModel];
  }

  return DEFAULT_OPENROUTER_MODELS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function normalizeExtractedFields(data: unknown): DetectedFormField[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const root = data as Record<string, unknown>;
  const fields = Array.isArray(root.fields) ? root.fields : [];

  return fields
    .map((item): DetectedFormField | null => {
      if (!item || typeof item !== 'object') return null;

      const record = item as Record<string, unknown>;
      const detectedLabel = typeof record.label === 'string' ? record.label.trim() : '';
      const rawOriginalKey =
        typeof record.original_form_key === 'string'
          ? record.original_form_key
          : typeof record.originalFormKey === 'string'
            ? record.originalFormKey
            : detectedLabel;
      const rawCanonical =
        typeof record.canonical_key === 'string'
          ? record.canonical_key
          : typeof record.canonicalKey === 'string'
            ? record.canonicalKey
            : rawOriginalKey;
      const bbox = (record.bbox ?? {}) as Record<string, unknown>;
      const x = asNumber(record.x ?? bbox.x);
      const y = asNumber(record.y ?? bbox.y);
      const width = asNumber(record.width ?? bbox.width);
      const height = asNumber(record.height ?? bbox.height);
      const confidence = Math.max(0, Math.min(1, asNumber(record.confidence, 0.75)));
      const rawOptional =
        typeof record.is_optional === 'boolean'
          ? record.is_optional
          : typeof record.isOptional === 'boolean'
            ? record.isOptional
            : isOptionalFieldLabel(detectedLabel);

      if (!detectedLabel || width <= 0 || height <= 0) {
        return null;
      }

      return {
        detectedLabel,
        originalFormKey: rawOriginalKey || detectedLabel,
        canonicalKey: resolveCanonicalProfileKey(rawCanonical, rawOriginalKey, detectedLabel),
        isOptional: Boolean(rawOptional),
        confidence,
        labelBox: {
          x,
          y,
          width,
          height,
        },
      };
    })
    .filter((item): item is DetectedFormField => item !== null);
}

function normalizeFillPoint(data: unknown): FillPoint | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const root = data as Record<string, unknown>;
  const point = (root.fill_point ?? root.fillPoint ?? root) as Record<string, unknown>;
  const x = asNumber(point.x);
  const y = asNumber(point.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

function buildExtractionPrompt(): string {
  return [
    'You are extracting fillable form fields from an image.',
    'Return strict JSON only. No markdown.',
    'The coordinates must describe the visible field text or label region that identifies the field.',
    'Do not return the blank whitespace where the answer will be written.',
    'Schema:',
    '{',
    '  "fields": [',
    '    {',
    '      "label": "visible field label text",',
    '      "canonical_key": "snake_case_key",',
    '      "original_form_key": "raw field name as seen on the form",',
    '      "is_optional": false,',
    '      "bbox": { "x": 0, "y": 0, "width": 0, "height": 0 },',
    '      "confidence": 0.0',
    '    }',
    '  ]',
    '}',
    'Rules:',
    '- Include only fields intended to be filled by a user.',
    '- Detect optional fields too, for example middle name.',
    '- Coordinates are pixel values relative to the input image.',
    '- Confidence must be between 0 and 1.',
    '- canonical_key should be semantic and stable, for example first_name, dob, phone.',
  ].join('\n');
}

function buildFillPointPrompt(field: FormFieldMapping): string {
  return [
    'You are locating where a value should be written on a form.',
    'Return strict JSON only. No markdown.',
    'The input field label region has already been detected.',
    'Find the blank whitespace corresponding to this field and return a safe top-left anchor point for writing the value.',
    'Field details:',
    `label: ${field.detectedLabel}`,
    `canonical_key: ${field.canonicalKey}`,
    `value_to_write: ${field.value ?? ''}`,
    `label_box: ${JSON.stringify(field.labelBox)}`,
    'Schema:',
    '{ "fill_point": { "x": 0, "y": 0 } }',
    'Rules:',
    '- The point must be inside the image.',
    '- The point must be in the blank answer area for this field.',
    '- Do not place the point on top of the label text.',
    '- Prefer the whitespace immediately associated with the provided label box.',
  ].join('\n');
}

async function sendOpenRouterRequest(
  prompt: string,
  imageBuffer: Buffer,
  mimeType: string,
  options?: { allowMissingApiKey?: boolean },
): Promise<unknown> {
  const apiKey = getOptionalEnv('OPENROUTER_API_KEY');
  if (!apiKey) {
    if (options?.allowMissingApiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    throw new Error('Missing required environment variable: OPENROUTER_API_KEY');
  }

  const models = getModels();
  const timeoutMs = getNumberEnv('OPENROUTER_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const retries = getNumberEnv('OPENROUTER_RETRIES', DEFAULT_RETRIES);
  const imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  let lastError: Error | null = null;
  const totalAttempts = models.length * (retries + 1);

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const model = models[attempt % models.length];
    const cycle = Math.floor(attempt / models.length) + 1;
    const payload = {
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
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

        devLogger.warn('openrouter', 'Received non-OK response', {
          attempt: attempt + 1,
          cycle,
          model,
          status: response.status,
          retryable,
          bodyPreview: bodyText.slice(0, 500),
        });

        if (retryable && attempt < totalAttempts - 1) {
          await sleep((attempt + 1) * 500);
          continue;
        }

        throw new Error(`OpenRouter request failed (${response.status}): ${bodyText}`);
      }

      const result = (await response.json()) as OpenRouterChatResponse;
      return parseJsonLenient(extractAssistantText(result));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown OpenRouter error');
      devLogger.error('openrouter', 'OpenRouter request failed', {
        attempt: attempt + 1,
        cycle,
        model,
        message: lastError.message,
      });
      if (attempt < totalAttempts - 1) {
        await sleep((attempt + 1) * 500);
        continue;
      }
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  throw lastError ?? new Error('OpenRouter request failed');
}

function heuristicFillPoint(field: FormFieldMapping): FillPoint {
  return {
    x: Math.max(0, Math.round(field.labelBox.x + field.labelBox.width + 14)),
    y: Math.max(0, Math.round(field.labelBox.y + field.labelBox.height * 0.2)),
  };
}

export async function extractFieldsWithOpenRouter(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<DetectedFormField[]> {
  devLogger.log('openrouter', 'Starting extraction request', {
    mimeType,
    imageBytes: imageBuffer.length,
  });

  const parsed = await sendOpenRouterRequest(buildExtractionPrompt(), imageBuffer, mimeType);
  const fields = normalizeExtractedFields(parsed);

  devLogger.log('openrouter', 'Parsed extraction response', {
    fieldCount: fields.length,
    sampleFields: fields.slice(0, 5),
  });

  if (fields.length === 0) {
    throw new Error('OpenRouter returned no valid fields');
  }

  return fields;
}

export async function locateFillPointWithOpenRouter(
  imageBuffer: Buffer,
  mimeType: string,
  field: FormFieldMapping,
): Promise<{ fillPoint: FillPoint; source: 'ai' | 'heuristic' }> {
  try {
    const parsed = await sendOpenRouterRequest(buildFillPointPrompt(field), imageBuffer, mimeType, {
      allowMissingApiKey: true,
    });
    const fillPoint = normalizeFillPoint(parsed);
    if (!fillPoint) {
      throw new Error('OpenRouter returned no fill point');
    }

    return {
      fillPoint,
      source: 'ai',
    };
  } catch (error) {
    devLogger.warn('openrouter', 'Falling back to heuristic fill point', {
      fieldId: field.fieldId,
      label: field.detectedLabel,
      message: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      fillPoint: heuristicFillPoint(field),
      source: 'heuristic',
    };
  }
}

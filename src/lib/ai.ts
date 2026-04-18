import { GoogleGenAI } from '@google/genai';
import { devLogger } from '@/lib/devLogger';
import type { DetectedFormField, FillPoint, FormFieldMapping } from '@/lib/formTypes';
import { isOptionalFieldLabel, resolveCanonicalProfileKey } from '@/lib/profileKeys';

const DEFAULT_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  
];

const DEFAULT_RETRIES = 2;

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
  const configuredModels = process.env.GEMINI_MODELS?.trim() || process.env.AI_MODELS?.trim() || process.env.OPENROUTER_MODELS?.trim();
  if (configuredModels) {
    const models = configuredModels
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean);

    if (models.length > 0) {
      return models;
    }
  }

  const configuredModel = process.env.GEMINI_MODEL?.trim() || process.env.AI_MODEL?.trim() || process.env.OPENROUTER_MODEL?.trim();
  if (configuredModel) {
    return [configuredModel];
  }

  return DEFAULT_GEMINI_MODELS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function sendGeminiRequest(
  prompt: string,
  imageBuffer: Buffer,
  mimeType: string,
  options?: { allowMissingApiKey?: boolean },
): Promise<unknown> {
  const apiKey = getOptionalEnv('GEMINI_API_KEY');
  if (!apiKey) {
    if (options?.allowMissingApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    throw new Error('Missing required environment variable: GEMINI_API_KEY');
  }

  const ai = new GoogleGenAI({ apiKey });

  const models = getModels();
  const retries = getNumberEnv('GEMINI_RETRIES', DEFAULT_RETRIES);

  let lastError: Error | null = null;
  const totalAttempts = models.length * (retries + 1);

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const model = models[attempt % models.length];
    const cycle = Math.floor(attempt / models.length) + 1;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          prompt,
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType,
            },
          },
        ],
        config: {
          temperature: 0.2,
        }
      });
      
      const text = response.text;
      if (!text) {
        throw new Error('Model returned empty response');
      }

      return parseJsonLenient(text);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown Gemini AI error');
      devLogger.error('gemini', 'Gemini AI request failed', {
        attempt: attempt + 1,
        cycle,
        model,
        message: lastError.message,
      });
      if (attempt < totalAttempts - 1) {
        await sleep((attempt + 1) * 1000);
        continue;
      }
    }
  }

  throw lastError ?? new Error('Gemini AI request failed');
}

function heuristicFillPoint(field: FormFieldMapping): FillPoint {
  return {
    x: Math.max(0, Math.round(field.labelBox.x + field.labelBox.width + 14)),
    y: Math.max(0, Math.round(field.labelBox.y + field.labelBox.height * 0.2)),
  };
}

export async function extractFieldsWithAI(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<DetectedFormField[]> {
  devLogger.log('gemini', 'Starting extraction request', {
    mimeType,
    imageBytes: imageBuffer.length,
  });

  const parsed = await sendGeminiRequest(buildExtractionPrompt(), imageBuffer, mimeType);
  const fields = normalizeExtractedFields(parsed);

  devLogger.log('gemini', 'Parsed extraction response', {
    fieldCount: fields.length,
    sampleFields: fields.slice(0, 5),
  });

  if (fields.length === 0) {
    throw new Error('Gemini returned no valid fields');
  }

  return fields;
}

export async function locateFillPointWithAI(
  imageBuffer: Buffer,
  mimeType: string,
  field: FormFieldMapping,
): Promise<{ fillPoint: FillPoint; source: 'ai' | 'heuristic' }> {
  try {
    const parsed = await sendGeminiRequest(buildFillPointPrompt(field), imageBuffer, mimeType, {
      allowMissingApiKey: true,
    });
    const fillPoint = normalizeFillPoint(parsed);
    if (!fillPoint) {
      throw new Error('Gemini returned no fill point');
    }

    return {
      fillPoint,
      source: 'ai',
    };
  } catch (error) {
    devLogger.warn('gemini', 'Falling back to heuristic fill point', {
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

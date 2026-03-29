import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { extractFieldsFromImage } from '@/lib/ocr';
import { matchFields } from '@/lib/matcher';
import type { DetectedField } from '@/lib/ocr';
import dbConnect from '@/lib/database';
import { User } from '@/models/user';
import { generateFilledForm } from '@/lib/imageGenerator';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MIN_IMAGE_DIMENSION = 200;
const MAX_IMAGE_DIMENSION = 8000;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

interface Timings {
  openrouter_ms: number;
  mapping_ms: number;
  fill_ms: number;
  total_ms: number;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Error processing form';
}

function parseStringMap(value: FormDataEntryValue | null, fieldName: string): Record<string, string> {
  if (!value) return {};
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a JSON string object`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${fieldName} is not valid JSON`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be an object`);
  }

  const map: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof rawValue === 'string') {
      map[key] = rawValue;
    }
  }
  return map;
}

function parseDetectedFields(value: FormDataEntryValue | null): DetectedField[] {
  if (!value) return [];
  if (typeof value !== 'string') {
    throw new Error('extractedFields must be a JSON array string');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('extractedFields is not valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('extractedFields must be an array');
  }

  return parsed
    .map((item): DetectedField | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;

      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const canonicalKey = typeof record.canonicalKey === 'string' ? record.canonicalKey.trim() : '';
      const x = Number(record.x);
      const y = Number(record.y);
      const width = Number(record.width);
      const height = Number(record.height);
      const confidence = Number(record.confidence);

      if (!label || !canonicalKey || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
      }

      return {
        label,
        canonicalKey,
        x,
        y,
        width,
        height,
        confidence: Number.isFinite(confidence) ? confidence : 0.75,
      };
    })
    .filter((field): field is DetectedField => field !== null);
}

async function validateImageSafety(image: File, imageBuffer: Buffer): Promise<void> {
  if (!ALLOWED_MIME_TYPES.has(image.type)) {
    throw new Error('Unsupported file type. Allowed: PNG, JPEG, WEBP, GIF');
  }

  if (image.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File size exceeds 10MB limit');
  }

  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    throw new Error(`Image dimensions are too small. Minimum ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION}`);
  }

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new Error(`Image dimensions are too large. Maximum ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}`);
  }
}

function failedResponse(requestId: string, timings: Timings, message: string, status = 500) {
  return NextResponse.json(
    {
      status: 'failed',
      requestId,
      error: message,
      extractedFields: [],
      autoFilledFields: [],
      missingFields: [],
      filledImage: null,
      timings,
    },
    { status },
  );
}

export async function POST(req: Request) {
  const requestId = randomUUID();
  const startTotal = Date.now();
  const timings: Timings = {
    openrouter_ms: 0,
    mapping_ms: 0,
    fill_ms: 0,
    total_ms: 0,
  };

  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      timings.total_ms = Date.now() - startTotal;
      return failedResponse(requestId, timings, 'No image provided', 400);
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    await validateImageSafety(image, buffer);

    let extractedFields = parseDetectedFields(formData.get('extractedFields'));
    const openRouterStart = Date.now();
    if (extractedFields.length === 0) {
      extractedFields = await extractFieldsFromImage(buffer, image.type);
    }
    timings.openrouter_ms = Date.now() - openRouterStart;

    const mappingStart = Date.now();
    const userProvidedValues = {
      ...parseStringMap(formData.get('missingValues'), 'missingValues'),
      ...parseStringMap(formData.get('userValues'), 'userValues'),
    };

    await dbConnect();
    const dbUser = await User.findOne();
    const dbData = dbUser && dbUser.data ? Object.fromEntries(dbUser.data) : {};

    const { autoFilledFields, missingFields } = matchFields(extractedFields, dbData, userProvidedValues);
    timings.mapping_ms = Date.now() - mappingStart;

    if (missingFields.length > 0) {
      timings.total_ms = Date.now() - startTotal;
      return NextResponse.json({
        status: 'needs_input',
        requestId,
        error: null,
        extractedFields,
        autoFilledFields,
        missingFields,
        filledImage: null,
        timings,
      });
    }

    const fillStart = Date.now();
    const finalImageBuffer = await generateFilledForm(
      buffer,
      autoFilledFields.map((field) => ({
        label: field.label,
        canonicalKey: field.canonicalKey,
        value: field.value,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
      })),
    );
    timings.fill_ms = Date.now() - fillStart;
    timings.total_ms = Date.now() - startTotal;

    return NextResponse.json({
      status: 'completed',
      requestId,
      error: null,
      extractedFields,
      autoFilledFields,
      missingFields: [],
      filledImage: `data:image/png;base64,${finalImageBuffer.toString('base64')}`,
      timings,
    });
  } catch (error) {
    timings.total_ms = Date.now() - startTotal;
    const message = toErrorMessage(error);
    console.error('Processing Error:', message);
    return failedResponse(requestId, timings, message, 500);
  }
}

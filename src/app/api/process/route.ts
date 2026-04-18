import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { extractFieldsFromImage } from '@/lib/ocr';
import { createFormFields, rehydrateFormFields, classifyFormFields, buildPersistencePatch } from '@/lib/formFields';
import { locateFillPointWithAI } from '@/lib/ai';
import type { FormFieldMapping } from '@/lib/formTypes';
import { generateFilledForm } from '@/lib/imageGenerator';
import { requireAuthenticatedUser } from '@/lib/authSession';
import { devLogger } from '@/lib/devLogger';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MIN_IMAGE_DIMENSION = 200;
const MAX_IMAGE_DIMENSION = 8000;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

interface Timings {
  extraction_ms: number;
  mapping_ms: number;
  persistence_ms: number;
  fill_point_ms: number;
  render_ms: number;
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
    if (typeof rawValue === 'string' && rawValue.trim()) {
      map[key] = rawValue.trim();
    }
  }
  return map;
}

function parseFormFields(value: FormDataEntryValue | null): FormFieldMapping[] {
  if (!value) return [];
  if (typeof value !== 'string') {
    throw new Error('formFields must be a JSON array string');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('formFields is not valid JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('formFields must be an array');
  }

  return rehydrateFormFields(
    parsed.filter((item): item is FormFieldMapping => Boolean(item && typeof item === 'object')) as FormFieldMapping[],
  );
}

async function validateImageSafety(image: File, imageBuffer: Buffer) {
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

  return metadata;
}

function clampFieldPoint(field: FormFieldMapping, imageWidth: number, imageHeight: number): FormFieldMapping {
  if (!field.fillPoint) {
    return field;
  }

  return {
    ...field,
    fillPoint: {
      x: Math.max(0, Math.min(imageWidth - 1, Math.round(field.fillPoint.x))),
      y: Math.max(0, Math.min(imageHeight - 1, Math.round(field.fillPoint.y))),
    },
  };
}

function failedResponse(requestId: string, timings: Timings, message: string, status = 500) {
  return NextResponse.json(
    {
      status: 'failed',
      requestId,
      error: message,
      formFields: [],
      resolvedFields: [],
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
    extraction_ms: 0,
    mapping_ms: 0,
    persistence_ms: 0,
    fill_point_ms: 0,
    render_ms: 0,
    total_ms: 0,
  };

  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const { user, response } = await requireAuthenticatedUser(req);

    if (!image) {
      timings.total_ms = Date.now() - startTotal;
      return failedResponse(requestId, timings, 'No image provided', 400);
    }

    if (!user) {
      timings.total_ms = Date.now() - startTotal;
      return response;
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const metadata = await validateImageSafety(image, buffer);
    const imageWidth = metadata.width ?? MAX_IMAGE_DIMENSION;
    const imageHeight = metadata.height ?? MAX_IMAGE_DIMENSION;

    devLogger.log('process', 'Incoming process request', {
      requestId,
      hasImage: Boolean(image),
      imageName: image.name,
      imageType: image.type,
      imageSize: image.size,
      hasFormFields: formData.has('formFields'),
      hasMissingValues: formData.has('missingValues'),
      authenticatedUserId: user._id?.toString?.() ?? null,
      authenticatedEmail: user.email ?? null,
    });

    let formFields = parseFormFields(formData.get('formFields'));

    if (formFields.length === 0) {
      const extractionStart = Date.now();
      const detectedFields = await extractFieldsFromImage(buffer, image.type);
      timings.extraction_ms = Date.now() - extractionStart;
      formFields = createFormFields(detectedFields);
    }

    const userProvidedValues = {
      ...parseStringMap(formData.get('missingValues'), 'missingValues'),
      ...parseStringMap(formData.get('userValues'), 'userValues'),
    };

    const dbData = user.data ? Object.fromEntries(user.data) : {};

    const mappingStart = Date.now();
    const classified = classifyFormFields(formFields, dbData, userProvidedValues);
    timings.mapping_ms = Date.now() - mappingStart;

    const persistencePatch = buildPersistencePatch(classified.formFields);
    if (Object.keys(persistencePatch).length > 0) {
      const persistenceStart = Date.now();
      user.data = new Map<string, string>([
        ...Object.entries(dbData),
        ...Object.entries(persistencePatch),
        ['name', user.name],
        ['email', user.email],
      ]);
      await user.save();
      timings.persistence_ms = Date.now() - persistenceStart;
    }

    devLogger.log('process', 'Mapping complete', {
      requestId,
      formFieldCount: classified.formFields.length,
      resolvedCount: classified.resolvedFields.length,
      missingCount: classified.missingFields.length,
      persistedKeys: Object.keys(persistencePatch),
    });

    if (classified.missingFields.length > 0) {
      timings.total_ms = Date.now() - startTotal;
      return NextResponse.json({
        status: 'needs_input',
        requestId,
        error: null,
        formFields: classified.formFields,
        resolvedFields: classified.resolvedFields,
        missingFields: classified.missingFields,
        filledImage: null,
        timings,
      });
    }

    const fillPointStart = Date.now();
    const formFieldsWithPoints: FormFieldMapping[] = [];
    for (const field of classified.formFields) {
      if (field.matchStatus !== 'matched' || !field.value) {
        formFieldsWithPoints.push(field);
        continue;
      }

      const placement = await locateFillPointWithAI(buffer, image.type, field);
      formFieldsWithPoints.push(
        clampFieldPoint(
          {
            ...field,
            fillPoint: placement.fillPoint,
            fillPointSource: placement.source,
          },
          imageWidth,
          imageHeight,
        ),
      );
    }
    timings.fill_point_ms = Date.now() - fillPointStart;

    const renderStart = Date.now();
    const finalImageBuffer = await generateFilledForm(buffer, formFieldsWithPoints);
    timings.render_ms = Date.now() - renderStart;
    timings.total_ms = Date.now() - startTotal;

    const resolvedFields = formFieldsWithPoints.filter(
      (field) => field.matchStatus === 'matched' && Boolean(field.value),
    );

    return NextResponse.json({
      status: 'completed',
      requestId,
      error: null,
      formFields: formFieldsWithPoints,
      resolvedFields,
      missingFields: [],
      filledImage: `data:image/png;base64,${finalImageBuffer.toString('base64')}`,
      timings,
    });
  } catch (error) {
    timings.total_ms = Date.now() - startTotal;
    const message = toErrorMessage(error);
    devLogger.error('process', 'Process request failed', {
      requestId,
      totalMs: timings.total_ms,
      message,
    });
    return failedResponse(requestId, timings, message, 500);
  }
}

import { NextResponse } from 'next/server';
import { extractFieldsFromImage } from '@/lib/ocr';
import { matchFields } from '@/lib/matcher';
import dbConnect from '@/lib/database';
import { User } from '@/models/user';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());

    // 1. OCR Extraction
    const detectedFields = await extractFieldsFromImage(buffer);
    const detectedLabels = detectedFields.map(f => f.label);

    // 2. Database Fetch
    await dbConnect();
    const dbUser = await User.findOne();
    const dbData = dbUser && dbUser.data ? Object.fromEntries(dbUser.data) : {};

    // 3. Matching
    const { autoFilled, missingFields } = matchFields(detectedLabels, dbData);

    return NextResponse.json({
      detectedFields,
      autoFilled,
      missingFields
    });
  } catch (error: any) {
    console.error('OCR Processing Error:', error);
    return NextResponse.json({ error: error.message || 'Error processing form' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { generateFilledForm, FieldValue } from '@/lib/imageGenerator';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const fieldsStr = formData.get('fields') as string | null;

    if (!image || !fieldsStr) {
      return NextResponse.json({ error: 'Image and fields are required' }, { status: 400 });
    }

    const fields: FieldValue[] = JSON.parse(fieldsStr);
    const buffer = Buffer.from(await image.arrayBuffer());

    const finalImageBuffer = await generateFilledForm(buffer, fields);

    return new NextResponse(finalImageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="filled-form.png"'
      }
    });
  } catch (error: any) {
    console.error('Generation Error:', error);
    return NextResponse.json({ error: error.message || 'Error generating image' }, { status: 500 });
  }
}

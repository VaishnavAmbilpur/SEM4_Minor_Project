import sharp from 'sharp';

export interface FieldValue {
  label: string;
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function generateFilledForm(imageBuffer: Buffer, fields: FieldValue[]): Promise<Buffer> {
  const { width = 800, height = 1000 } = await sharp(imageBuffer).metadata();

  let svgOverlays = '';

  for (const field of fields) {
    const fillX = field.x + field.width + 15;
    const fillY = field.y + field.height - 5;
    
    // Escape unsafe XML characters
    const escapedValue = (field.value || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    svgOverlays += `<text x="${fillX}" y="${fillY}" font-family="Arial" font-weight="bold" font-size="22" fill="#0000AA">${escapedValue}</text>`;
  }

  const svgImage = `<svg width="${width}" height="${height}">${svgOverlays}</svg>`;

  const finalImageBuffer = await sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svgImage),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return finalImageBuffer;
}

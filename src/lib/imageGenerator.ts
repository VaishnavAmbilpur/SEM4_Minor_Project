import sharp from 'sharp';

export interface FieldValue {
  label: string;
  canonicalKey?: string;
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(value: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);

    if (word.length > maxCharsPerLine) {
      lines.push(word.slice(0, maxCharsPerLine));
      current = word.slice(maxCharsPerLine);
    } else {
      current = word;
    }

    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (words.length > 0 && lines.length === maxLines) {
    const joined = lines.join(' ');
    const original = words.join(' ');
    if (joined.length < original.length && lines[maxLines - 1].length > 0) {
      const last = lines[maxLines - 1];
      lines[maxLines - 1] = last.slice(0, Math.max(1, last.length - 1)) + '...';
    }
  }

  return lines;
}

export async function generateFilledForm(imageBuffer: Buffer, fields: FieldValue[]): Promise<Buffer> {
  const { width = 800, height = 1000 } = await sharp(imageBuffer).metadata();

  let clipPaths = '';
  let textOverlays = '';

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const value = (field.value || '').toString().trim();
    if (!value) continue;

    const padding = 4;
    const safeWidth = Math.max(24, Math.floor(field.width - padding * 2));
    const safeHeight = Math.max(16, Math.floor(field.height - padding * 2));
    const fontSize = Math.max(12, Math.min(24, Math.floor(safeHeight * 0.5)));
    const lineHeight = Math.max(14, Math.floor(fontSize * 1.2));

    const maxLines = Math.max(1, Math.floor(safeHeight / lineHeight));
    const approxCharWidth = Math.max(6, fontSize * 0.55);
    const maxCharsPerLine = Math.max(1, Math.floor(safeWidth / approxCharWidth));
    const lines = wrapText(value, maxCharsPerLine, maxLines);

    const clipId = `field_clip_${index}`;
    const textX = Math.round(field.x + padding);
    const textY = Math.round(field.y + padding + fontSize * 0.85);

    clipPaths += `<clipPath id="${clipId}"><rect x="${field.x}" y="${field.y}" width="${field.width}" height="${field.height}" /></clipPath>`;

    const escapedLines = lines.map((line) => escapeXml(line));
    const tspan = escapedLines
      .map((line, lineIndex) => {
        const dy = lineIndex === 0 ? 0 : lineHeight;
        return `<tspan x="${textX}" dy="${dy}">${line}</tspan>`;
      })
      .join('');

    textOverlays += `<text clip-path="url(#${clipId})" x="${textX}" y="${textY}" font-family="Arial" font-size="${fontSize}" font-weight="600" fill="#0A2C8B">${tspan}</text>`;
  }

  const svgImage = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs>${clipPaths}</defs>${textOverlays}</svg>`;

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

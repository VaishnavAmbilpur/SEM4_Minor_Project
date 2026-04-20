import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicDir = join(__dirname, 'public');
if (!existsSync(publicDir)){
    mkdirSync(publicDir);
}

const svgText = `
<svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="50" y="80" font-family="Arial" font-size="30" font-weight="bold" fill="black">Registration Form</text>
  
  <text x="50" y="200" font-family="Arial" font-size="20" fill="black">Name:</text>
  
  <text x="50" y="350" font-family="Arial" font-size="20" fill="black">Date of Birth:</text>
  
  <text x="50" y="500" font-family="Arial" font-size="20" fill="black">Phone Number:</text>
  
  <text x="50" y="650" font-family="Arial" font-size="20" fill="black">Address:</text>
</svg>
`;

sharp(Buffer.from(svgText))
  .png()
  .toFile(join(publicDir, 'test-form.png'))
  .then(() => console.log('Test form created at public/test-form.png'))
  .catch(err => console.error(err));

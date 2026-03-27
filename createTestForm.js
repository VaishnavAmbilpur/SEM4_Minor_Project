const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)){
    fs.mkdirSync(publicDir);
}

const svgText = `
<svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="50" y="80" font-family="Arial" font-size="30" font-weight="bold" fill="black">Registration Form</text>
  
  <text x="50" y="160" font-family="Arial" font-size="20" fill="black">Name:</text>
  <line x1="120" y1="165" x2="500" y2="165" stroke="black" stroke-width="1"/>
  
  <text x="50" y="240" font-family="Arial" font-size="20" fill="black">Date of Birth:</text>
  <line x1="190" y1="245" x2="500" y2="245" stroke="black" stroke-width="1"/>
  
  <text x="50" y="320" font-family="Arial" font-size="20" fill="black">Phone Number:</text>
  <line x1="200" y1="325" x2="500" y2="325" stroke="black" stroke-width="1"/>
  
  <text x="50" y="400" font-family="Arial" font-size="20" fill="black">Address:</text>
  <line x1="140" y1="405" x2="500" y2="405" stroke="black" stroke-width="1"/>

  <text x="50" y="480" font-family="Arial" font-size="20" fill="black">Signature:</text>
  <line x1="150" y1="485" x2="500" y2="485" stroke="black" stroke-width="1"/>
</svg>
`;

sharp(Buffer.from(svgText))
  .png()
  .toFile(path.join(publicDir, 'test-form.png'))
  .then(() => console.log('Test form created at public/test-form.png'))
  .catch(err => console.error(err));

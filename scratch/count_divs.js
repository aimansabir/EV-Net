import fs from 'fs';
const content = fs.readFileSync('src/pages/app/ChargerDetail.jsx', 'utf8');
const opens = content.split('<div').length - 1;
const closes = content.split('</div').length - 1;
console.log(`Opens: ${opens}`);
console.log(`Closes: ${closes}`);

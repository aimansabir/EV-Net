import fs from 'fs';
const content = fs.readFileSync('src/pages/app/ChargerDetail.jsx', 'utf8');
const lines = content.split('\n');
for (let i = Math.max(0, lines.length - 20); i < lines.length; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

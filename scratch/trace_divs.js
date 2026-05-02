import fs from 'fs';
const content = fs.readFileSync('src/pages/app/ChargerDetail.jsx', 'utf8');
const lines = content.split('\n');
let level = 0;
for (let i = 0; i < lines.length; i++) {
  const opens = (lines[i].match(/<div(?![^>]*\/>)/g) || []).length;
  const closes = (lines[i].match(/<\/div>/g) || []).length;
  if (opens > 0 || closes > 0) {
    level += opens - closes;
    console.log(`${i+1}: Level ${level} (opens: ${opens}, closes: ${closes}) - ${lines[i].trim().substring(0, 50)}`);
  }
}

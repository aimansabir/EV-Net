import fs from 'fs';
const content = fs.readFileSync('src/pages/app/ChargerDetail.jsx', 'utf8');

// Simple regex to find <div... but not </div
const openMatches = content.match(/<div(?![^>]*\/>)/g) || [];
const closeMatches = content.match(/<\/div>/g) || [];

console.log(`Opens: ${openMatches.length}`);
console.log(`Closes: ${closeMatches.length}`);
console.log(`Difference: ${openMatches.length - closeMatches.length}`);

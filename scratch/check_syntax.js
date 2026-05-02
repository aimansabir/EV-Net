const fs = require('fs');
const content = fs.readFileSync('src/pages/app/ChargerDetail.jsx', 'utf8');
try {
  // Simple check for basic syntax errors (though this won't catch everything in JSX)
  new Function(content);
} catch (e) {
  console.log(e.message);
  console.log(e.stack);
}

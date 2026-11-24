// The server is compiled to CommonJS. The project is "type": "module", so mark the build folder as CommonJS.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'dist', 'server');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
console.log('wrote', path.join(dir, 'package.json'));

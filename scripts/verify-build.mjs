import fs from 'node:fs';
const required = ['dist/client/index.html','dist-server/src/index.js'];
const missing = required.filter((p) => !fs.existsSync(p));
if (missing.length) {
  console.error('Build verification failed. Missing:', missing.join(', '));
  process.exit(1);
}
console.log('Build verification passed:', required.join(', '));

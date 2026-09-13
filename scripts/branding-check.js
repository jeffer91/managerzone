const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const electron = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');

for (const file of ['assets/favicon.png','assets/managerzone-icon.png','assets/managerzone-logo.png']) {
  assert(fs.existsSync(path.join(root, file)), `${file} debe existir`);
  assert(fs.statSync(path.join(root, file)).size > 1000, `${file} no debe estar vacío`);
}

assert(html.includes('../assets/favicon.png'), 'index.html debe cargar el favicon oficial');
assert(html.includes('../assets/managerzone-logo.png'), 'la interfaz debe mostrar el logo oficial');
assert(electron.includes("assets', 'managerzone-icon.png"), 'Electron debe usar el icono oficial');

console.log('✓ Logo, favicon and Electron icon integration OK');

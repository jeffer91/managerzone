const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');

const root=path.resolve(__dirname,'..');
const integration=path.join(root,'src/slot-integration.js');
assert(fs.existsSync(integration),'src/slot-integration.js debe existir');
execFileSync(process.execPath,['--check',integration],{stdio:'pipe'});

const js=fs.readFileSync(integration,'utf8');
const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
assert(html.includes('src="slot-integration.js"'),'index.html debe cargar slot-integration.js');
assert(html.indexOf('src="finance-engine.js"')<html.indexOf('src="slot-integration.js"'),'slot-integration debe cargar después del motor financiero');
assert(html.indexOf('src="slot-integration.js"')<html.indexOf('src="finance-view.js"'),'slot-integration debe cargar antes de la vista financiera');
assert(js.includes('MZEngine.slotRating'),'la integración debe usar valoración por puesto exacto');
assert(js.includes('MZEngine.slotLabel'),'la integración debe usar nombres de puestos exactos');
assert(js.includes('details.every'),'Mercado debe exigir todos los atributos obligatorios de Qué comprar');
assert(js.includes('positionalSaleCandidates'),'Finanzas debe valorar candidatos a venta por utilidad posicional');
assert(js.includes("registerView('market'"),'Mercado debe usar el renderer posicional integrado');
assert(js.includes("registerView('youth'"),'Juveniles debe corregir el diagnóstico posicional');
assert(js.includes("metric-need"),'Inicio debe actualizar la mayor necesidad con el puesto exacto');
assert(js.includes("current-tactic-explanation"),'Tácticas debe explicar el punto débil por puesto exacto');
console.log('✓ Exact-position integration across dashboard, tactics, youth, market and finance OK');

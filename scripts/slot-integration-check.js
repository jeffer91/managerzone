const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');

const root=path.resolve(__dirname,'..');
const integration=path.join(root,'src/slot-integration.js');
const sync=path.join(root,'src/slot-integration-sync.js');
for(const file of [integration,sync]){
  assert(fs.existsSync(file),`${path.relative(root,file)} debe existir`);
  execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
}

const js=fs.readFileSync(integration,'utf8');
const syncJs=fs.readFileSync(sync,'utf8');
const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
assert(html.includes('src="slot-integration.js"'),'index.html debe cargar slot-integration.js');
assert(html.includes('src="slot-integration-sync.js"'),'index.html debe cargar slot-integration-sync.js');
assert(html.indexOf('src="finance-engine.js"')<html.indexOf('src="slot-integration.js"'),'slot-integration debe cargar después del motor financiero');
assert(html.indexOf('src="slot-integration.js"')<html.indexOf('src="slot-integration-sync.js"'),'la sincronización debe cargar después de la integración');
assert(html.indexOf('src="slot-integration-sync.js"')<html.indexOf('src="finance-view.js"'),'la integración posicional debe quedar activa antes de la vista financiera');
assert(js.includes('MZEngine.slotRating'),'la integración debe usar valoración por puesto exacto');
assert(js.includes('MZEngine.slotLabel'),'la integración debe usar nombres de puestos exactos');
assert(js.includes('details.every'),'Mercado debe exigir todos los atributos obligatorios de Qué comprar');
assert(js.includes('positionalSaleCandidates'),'Finanzas debe valorar candidatos a venta por utilidad posicional');
assert(js.includes("registerView('market'"),'Mercado debe usar el renderer posicional integrado');
assert(js.includes("registerView('youth'"),'Juveniles debe corregir el diagnóstico posicional');
assert(js.includes('metric-need'),'Inicio debe actualizar la mayor necesidad con el puesto exacto');
assert(js.includes('current-tactic-explanation'),'Tácticas debe explicar el punto débil por puesto exacto');
assert(syncJs.includes('MutationObserver'),'Juveniles debe mantener el diagnóstico exacto después de mover jugadores');
assert(syncJs.includes('target.formationName'),'Mercado debe respetar la formación enviada desde Qué comprar');
assert(syncJs.includes('compareFormationsWithBench')&&syncJs.includes('benchStrength'),'el desempate espacial debe volver a considerar el banco');
assert(syncJs.includes('parseRosterPreservingProfiles'),'recargar plantilla debe conservar el perfil enriquecido');
assert(syncJs.includes('tolerantEnrichProfiles'),'el importador de Pie/altura/peso debe ser tolerante');
assert(syncJs.includes('Pases cortos · con cautela'),'Pases cortos debe ser preferencia inteligente, no regla fija');
assert(syncJs.includes('Más ofensivo')&&syncJs.includes('Más conservador'),'el estilo debe analizar la fortaleza del XI');
assert(syncJs.includes('Subir un nivel')&&syncJs.includes('Bajar un nivel'),'la agresividad debe analizar Entradas, Resistencia y estado físico');
assert(syncJs.includes('Resultado operativo')&&syncJs.includes('fi-row.negative'),'Finanzas debe diferenciar visualmente déficit y superávit');
assert(syncJs.includes('Pie ${p.foot||p.pie}'),'la ficha del jugador debe mostrar Pie, altura y peso guardados');
console.log('✓ Exact-position integration, profile persistence, tactical advice and finance visuals OK');

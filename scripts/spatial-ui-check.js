const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
for(const file of ['src/spatial-engine.js','src/spatial-tools.js','src/finance-insights.js']){
  assert(fs.existsSync(path.join(root,file)),`${file} debe existir`);
  execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});
}
const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
assert(html.indexOf('src="engine.js"')<html.indexOf('src="spatial-engine.js"'),'spatial-engine debe cargar después de engine');
assert(html.indexOf('src="spatial-engine.js"')<html.indexOf('src="app.js"'),'spatial-engine debe instalarse antes de app');
assert(html.indexOf('src="slot-integration-sync.js"')<html.indexOf('src="spatial-tools.js"'),'spatial-tools debe envolver la UI final');
assert(html.indexOf('src="finance-view.js"')<html.indexOf('src="finance-insights.js"'),'finance-insights debe cargar después de finance-view');
const tools=fs.readFileSync(path.join(root,'src/spatial-tools.js'),'utf8');
assert(tools.includes("f['4-4-2']"),'4-4-2 debe usar distribución espacial corregida');
assert(tools.includes('Pases cortos'),'la recomendación base debe conservar pases cortos');
assert(tools.includes('penaltyScore'),'debe ordenar penales con prioridad ofensiva');
assert(tools.includes('Pie, altura y peso'),'debe permitir enriquecer perfiles');
const fin=fs.readFileSync(path.join(root,'src/finance-insights.js'),'utf8');
assert(fin.includes('Gráficos y recomendaciones'),'Finanzas debe mostrar gráficos y recomendaciones');
console.log('✓ Spatial UI, tactical advice, profile enrichment and finance insights integration OK');
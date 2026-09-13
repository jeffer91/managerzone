const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
for(const file of ['src/team-engine.js','src/team-tactics-ui.js']){
  assert(fs.existsSync(path.join(root,file)),`${file} debe existir`);
  execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});
}
const html=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
assert(html.indexOf('src="spatial-engine.js"')<html.indexOf('src="team-engine.js"'),'team-engine debe cargar después del motor espacial');
assert(html.indexOf('src="team-engine.js"')<html.indexOf('src="app.js"'),'team-engine debe instalarse antes de calcular formaciones');
assert(html.indexOf('src="finance-insights.js"')<html.indexOf('src="team-tactics-ui.js"'),'diagnóstico colectivo debe envolver la UI final');
const ui=fs.readFileSync(path.join(root,'src/team-tactics-ui.js'),'utf8');
assert(ui.includes('Cómo atacar')&&ui.includes('Cómo defender'),'la UI debe explicar ataque y defensa');
assert(ui.includes('Cohesión')&&ui.includes('Conexión'),'la UI debe mostrar cohesión y conexión entre líneas');
const engine=fs.readFileSync(path.join(root,'src/team-engine.js'),'utf8');
assert(engine.includes('positional*.30')&&engine.includes('cohesion.score*.20')&&engine.includes('connection.score*.20'),'la nota debe ponderar puesto, cohesión y conexión');
assert(engine.includes("return(i===0||i===n-1)?'WB':'CB'"),'una defensa de cinco debe separar carrileros y tres centrales');
assert(engine.includes('refineLineup'),'la selección del XI debe optimizar también el funcionamiento colectivo');
console.log('✓ Team engine UI and integration audit OK');
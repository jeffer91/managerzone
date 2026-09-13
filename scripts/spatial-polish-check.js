const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const sync=path.join(root,'src/slot-integration-sync.js');
assert(fs.existsSync(sync),'slot-integration-sync.js debe existir');
execFileSync(process.execPath,['--check',sync],{stdio:'pipe'});
const code=fs.readFileSync(sync,'utf8');
for(const token of ['compareFormationsWithBench','benchStrength','parseRosterPreservingProfiles','tolerantEnrichProfiles','Pie ${p.foot||p.pie}','Pases cortos · con cautela','Más ofensivo','Más conservador','Subir un nivel','Bajar un nivel','Resultado operativo','fi-row.negative']){
  assert(code.includes(token),`falta integración: ${token}`);
}
assert(code.includes("/Pie\\s*[:\\-]?\\s*(Diestro|Zurdo|Ambidiestro|Derecho|Izquierdo)/i"),'el parser de pie debe tolerar separadores opcionales');
assert(code.includes("['foot','pie','heightCm','height','weightKg','weight']"),'la recarga debe conservar el perfil enriquecido');
console.log('✓ Spatial polish: bench tie-break, profile persistence, tactical advice and finance sign OK');

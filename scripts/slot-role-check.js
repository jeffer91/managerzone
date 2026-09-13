const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const engine = require('../src/engine.js');

const root = path.resolve(__dirname, '..');
for (const file of ['src/engine.js','src/slot-aware-ui.js','src/needs-minimal.js']) {
  assert(fs.existsSync(path.join(root,file)),`${file} debe existir`);
  execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});
}
const html = fs.readFileSync(path.join(root,'src/index.html'),'utf8');
assert(html.includes('src="slot-aware-ui.js"'),'index.html debe cargar slot-aware-ui.js');
assert(html.indexOf('src="tactics-visibility.js"') < html.indexOf('src="slot-aware-ui.js"'),'slot-aware-ui.js debe cargarse después del renderer táctico');

const front3 = [
  {role:'DEL',x:18,y:22},
  {role:'DEL',x:50,y:15},
  {role:'DEL',x:82,y:22}
];

const make = (uid, attrs) => {
  const p = {uid,name:uid,age:24,...attrs};
  p.ratings = engine.ratePlayer(p);
  return p;
};

const finisher = make('finisher',{rem:10,pa:2,ctrl:7,ve:6,intel:7,ca:7,exp:5,res:6,en:2,at:1,pl:2});
const creator = make('creator',{rem:7,pa:10,ctrl:8,ve:8,intel:8,ca:3,exp:5,res:7,en:2,at:1,pl:6});
const wing = make('wing',{rem:7,pa:8,ctrl:8,ve:9,intel:6,ca:2,exp:4,res:7,en:2,at:1,pl:5});

assert.equal(engine.slotCode(front3[0],front3),'EI');
assert.equal(engine.slotCode(front3[1],front3),'DC');
assert.equal(engine.slotCode(front3[2],front3),'ED');
assert(engine.slotRating(finisher,front3[1],front3)>engine.slotRating(creator,front3[1],front3));
assert(engine.slotRating(creator,front3[0],front3)>engine.slotRating(finisher,front3[0],front3));

const best=engine.bestAssignment(front3,[creator,finisher,wing]);
assert.equal(best.lineup[1].uid,'finisher');
const swapped=best.lineup.slice();
[swapped[0],swapped[1]]=[swapped[1],swapped[0]];
assert(engine.tacticScore(front3,best.lineup)>engine.tacticScore(front3,swapped));

const req=engine.slotRequirements(creator,front3[0],front3).map(x=>x.key);
assert(req.includes('rem')&&req.includes('pa'));

const back4=[
  {role:'DEF',x:18,y:72},{role:'DEF',x:39,y:77},{role:'DEF',x:61,y:77},{role:'DEF',x:82,y:72}
];
assert.equal(engine.slotCode(back4[0],back4),'LI');
assert.equal(engine.slotCode(back4[1],back4),'DFC');
assert.equal(engine.slotCode(back4[3],back4),'LD');

const midfield433=[
  {role:'VOL',x:26,y:48},{role:'VOL',x:50,y:55},{role:'VOL',x:74,y:48}
];
assert.equal(engine.slotCode(midfield433[0],midfield433),'MC');
assert.equal(engine.slotCode(midfield433[1],midfield433),'MCD');

console.log('✓ Exact-position tactical engine and UI integration OK');

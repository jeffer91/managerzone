const assert = require('assert');
const engine = require('../src/engine.js');

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
console.log('✓ Exact-position tactical engine OK');

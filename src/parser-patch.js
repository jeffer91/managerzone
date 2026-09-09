(()=>{
'use strict';
const old=typeof parseRoster==='function'?parseRoster:null;
const KEYS=['ve','res','intel','pa','rem','ca','at','ctrl','en','pl','bp','exp','ef'];
let report={strategy:'none',count:0,warnings:[]};
const strip=v=>String(v??'').replace(/\u00a0/g,' ').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/&nbsp;/gi,' ').replace(/<[^>]+>/g,' ').replace(/\[\*\*(.*?)\*\*\]\([^)]*\)/g,'$1').replace(/\[(.*?)\]\([^)]*\)/g,'$1').replace(/\*\*|__/g,'').trim();
const line=v=>strip(v).replace(/[ ]{2,}/g,' ').trim();
const key=v=>strip(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const money=v=>{const d=strip(v).replace(/[^0-9]/g,'');return d?Number(d):0};
const currency=v=>/(?:USD|EUR|SEK|\$|€)/i.test(strip(v))&&/\d/.test(v);
const standaloneId=v=>/^\d{1,4}[.)-]?$/.test(strip(v));
const idOf=v=>((strip(v).match(/^(\d{1,4})/)||[])[1]||'');
const header=v=>/^(n|nombre|valor|sueldo|edad|temp|ve|res|in|pa|rem|ca|at|ctrl|en|pl|bp|exp|ef|velocidad|resistencia|inteligencia|pases|remates|cabezazos|atajando|control de balon|entradas|pases largos|balon parado|experiencia|estado fisico)$/i.test(key(v))||/^n nombre valor sueldo edad temp/.test(key(v));
const name=v=>{const s=strip(v).replace(/^\d{1,4}\s*[.)-]?\s+/,'').trim();return !!s&&!header(s)&&!currency(s)&&/[A-Za-zÁÉÍÓÚÜÑáéíóúüñÀ-ÿ]/.test(s)&&!/^(edad|pie|velocidad|resistencia|inteligencia|pases|remates|cabezazos|atajando|control|entradas|experiencia|estado)/i.test(s)&&s.length<90};
const cleanName=v=>strip(v).replace(/^\d{1,4}\s*[.)-]?\s+/,'').replace(/\s+/g,' ').trim();
const nums=v=>(strip(v).match(/-?\d+/g)||[]).map(Number);
const valid=s=>s.length>=15&&s[0]>=14&&s[0]<=60&&s[1]>=0&&s[1]<=100&&s.slice(2,15).every(n=>Number.isInteger(n)&&n>=0&&n<=10);
function player(id,n,v,s,st,source){if(!valid(st)||!name(n))return null;const a=st.slice(0,15),p={id:String(id||''),name:cleanName(n),value:money(v),salary:money(s),age:a[0],temp:a[1],ve:a[2],res:a[3],intel:a[4],pa:a[5],rem:a[6],ca:a[7],at:a[8],ctrl:a[9],en:a[10],pl:a[11],bp:a[12],exp:a[13],ef:a[14],importSource:source};try{return typeof normalizePlayer==='function'?normalizePlayer(p):p}catch{return p}}
function unique(arr){const m=new Map;for(const p of arr.filter(Boolean)){const k=key(p.name);if(!m.has(k))m.set(k,p)}return [...m.values()]}
function smart(text){const L=String(text??'').replace(/\r\n?/g,'\n').split('\n').map(line).filter(Boolean),out=[];for(let i=0;i<L.length;i++){
 let id='',ni=-1;
 const combo=L[i].match(/^(\d{1,4})\s*[.)-]?\s+(.+)$/);
 if(combo&&name(combo[2])){id=combo[1];ni=i}
 else if(standaloneId(L[i])){id=idOf(L[i]);for(let x=i+1;x<=Math.min(i+4,L.length-1);x++){if(name(L[x])){ni=x;break}}}
 else if(name(L[i])){ni=i;if(i&&standaloneId(L[i-1]))id=idOf(L[i-1])}
 if(ni<0)continue;
 const n=combo&&ni===i?combo[2]:L[ni];
 const ci=[];for(let x=ni+1;x<=Math.min(ni+8,L.length-1);x++){if(currency(L[x]))ci.push(x);if(ci.length===2)break;if(x>ni+1&&standaloneId(L[x]))break}if(ci.length<2)continue;
 const st=[];let end=ci[1];for(let x=ci[1]+1;x<L.length&&x<=ci[1]+7&&st.length<15;x++){if(st.length&&standaloneId(L[x]))break;if(!currency(L[x])&&!header(L[x]))st.push(...nums(L[x]));end=x}if(!valid(st))continue;
 const p=player(id||String(out.length+1),n,L[ci[0]],L[ci[1]],st,'smart');if(p){out.push(p);i=Math.max(i,end)}
 }return unique(out)}
function parse(text){const attempts=[];if(old){try{attempts.push({strategy:'tabla',players:unique(old(text)||[])})}catch{attempts.push({strategy:'tabla',players:[]})}}attempts.push({strategy:'inteligente',players:smart(text)});attempts.sort((a,b)=>b.players.length-a.players.length);const best=attempts[0]||{strategy:'none',players:[]};const warnings=[];if(best.players.length&&best.players.length<11)warnings.push('La selección parece parcial.');if(!best.players.length)warnings.push('No se encontraron bloques completos de jugadores.');report={strategy:best.strategy,count:best.players.length,warnings,attempts:attempts.map(a=>({strategy:a.strategy,count:a.players.length}))};window.MZ_LAST_PARSE_REPORT=report;return best.players}
parseRoster=parse;
function preview(){const input=document.querySelector('#roster-input'),msg=document.querySelector('#import-message');if(!input||!msg)return;let t;const go=()=>{clearTimeout(t);t=setTimeout(()=>{if(!input.value.trim())return;const p=parse(input.value);if(p.length){msg.textContent=`${p.length} jugadores detectados automáticamente · formato ${report.strategy}.`;msg.style.color='#55e98a'}else{msg.textContent='Aún no detecto jugadores completos. Pega directamente desde ManagerZone; no necesitas ordenar el texto.';msg.style.color=''}},120)};input.addEventListener('paste',go);input.addEventListener('input',go)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',preview,{once:true});else preview();
window.MZSmartParser={parse,getReport:()=>report};
})();

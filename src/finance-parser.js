(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MZFinanceParser=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clean=value=>String(value??'').replace(/\r/g,'').replace(/\u00a0/g,' ').replace(/&nbsp;/gi,' ').replace(/\*\*/g,'').replace(/^\s*#{1,6}\s*/gm,'');
  function money(value){const raw=clean(value);const negative=/^\s*-/.test(raw);const digits=raw.replace(/[^0-9]/g,'');return digits?Number((negative?'-':'')+digits):0;}
  function find(text,label){const raw=clean(text);const index=raw.toLowerCase().indexOf(label.toLowerCase());if(index<0)return null;const tail=raw.slice(index+label.length, index+label.length+80);const match=tail.match(/([+-]?[0-9][0-9 .,'’]*)\s*USD/i);return match?money(match[1]):null;}
  return{clean,money,find};
});
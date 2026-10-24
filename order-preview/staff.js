/* Staff orders PREVIEW. Reads demo orders from this browser's localStorage. No texts are sent. */
(function(){
  const $=s=>document.querySelector(s);
  const LS={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
  const money=c=>'$'+(c/100).toFixed(2);
  const fmtTime=t=>new Date(t).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  const fmtPhone=d=>d&&d.length===10?`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`:(d||'');
  let ctx=null, chimeTimer=null;

  function chime(){
    if(!ctx)return;
    [0,0.18,0.36].forEach((t,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';
      o.frequency.value=[880,1175,1568][i];g.gain.setValueAtTime(0.0001,ctx.currentTime+t);
      g.gain.exponentialRampToValueAtTime(0.5,ctx.currentTime+t+0.02);g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+t+0.3);
      o.connect(g).connect(ctx.destination);o.start(ctx.currentTime+t);o.stop(ctx.currentTime+t+0.32);});
  }
  $('#start').addEventListener('click',()=>{try{ctx=new (window.AudioContext||window.webkitAudioContext)();chime();}catch(e){}
    $('#gate').classList.add('hidden');render();});

  function orders(){return LS.get('hfgb_oo_orders',[]);}
  function save(q){LS.set('hfgb_oo_orders',q);render();}
  function update(num,fn){const q=orders();const o=q.find(x=>x.num===num);if(o){fn(o);save(q);}}

  function tix(o){
    const items=o.items.map(i=>`<li><b>${i.q}&times;</b><span>${i.name}${i.note?` <small>${i.note}</small>`:''}</span></li>`).join('');
    const when=o.when==='asap'?'ASAP':'At '+fmtTime(o.readyAt);
    let act='';
    if(o.status==='new') act=`<span class="lbl">Accept, ready in:</span>${[10,15,20,30].map(m=>`<button class="st-btn st-btn--go" data-acc="${o.num}" data-min="${m}">${m} min</button>`).join('')}`;
    if(o.status==='making') act=`<span class="lbl">Promised ${fmtTime(o.readyAt)}</span><button class="st-btn st-btn--ready" data-ready="${o.num}">Mark Ready (texts guest)</button>`;
    if(o.status==='ready') act=`<span class="lbl">Ready since ${fmtTime(o.readyTs)}</span><button class="st-btn st-btn--done" data-picked="${o.num}">Picked Up</button>`;
    return `<div class="tix ${o.status==='new'?'tix--new':''}">
      <div class="tix__top"><span class="tix__num">#${o.num}</span><span class="tix__name">${o.name}</span><span class="tix__when">${when}</span></div>
      <ul>${items}</ul>${o.notes?`<div class="tix__notes">${o.notes}</div>`:''}
      <div class="tix__meta"><span>${fmtPhone(o.phone)} · in ${fmtTime(o.createdAt)}</span><span>Paid ${money(o.total)}</span></div>
      <div class="tix__act">${act}</div></div>`;
  }
  function render(){
    const q=orders().filter(o=>o.status!=='picked');
    const cols={new:[],making:[],ready:[]}; q.forEach(o=>cols[o.status]&&cols[o.status].push(o));
    [['new','colNew','nNew'],['making','colMaking','nMaking'],['ready','colReady','nReady']].forEach(([k,c,n])=>{
      $('#'+c).innerHTML=cols[k].map(tix).join('')||'<div class="empty">None right now</div>'; $('#'+n).textContent=cols[k].length;});
    const nNew=cols.new.length, a=$('#alert');
    a.classList.toggle('hidden',!nNew); $('#alertTxt').textContent=nNew===1?`New order #${cols.new[0].num} from ${cols.new[0].name}!`:`${nNew} new orders!`;
    clearInterval(chimeTimer); if(nNew){chimeTimer=setInterval(chime,8000);}
  }
  let seen=new Set(orders().map(o=>o.num));
  function check(){const q=orders();let fresh=false;q.forEach(o=>{if(!seen.has(o.num)){seen.add(o.num);fresh=true;}});if(fresh)chime();render();}
  window.addEventListener('storage',e=>{if(e.key==='hfgb_oo_orders')check();});
  setInterval(check,3000);

  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.acc)update(+b.dataset.acc,o=>{o.status='making';o.readyAt=Date.now()+ +b.dataset.min*60000;});
    if(b.dataset.ready)update(+b.dataset.ready,o=>{o.status='ready';o.readyTs=Date.now();});
    if(b.dataset.picked)update(+b.dataset.picked,o=>{o.status='picked';});
  });
  const SAMPLE=[{name:'Kyle',items:[{id:'NETRVSWPPN4XP',q:1,name:'All Meat Flatbread',note:'',price:1400},{id:'2R4RZ4R701V6G',q:1,name:'Wings',note:'12 piece',price:1600}],notes:'Buffalo on the wings'},
    {name:'Megan',items:[{id:'A7BHBXAD6HV5W',q:2,name:'Pretzel Bites',note:'15, w/ cheese',price:900},{id:'3ZX33E5G6R7GE',q:1,name:'Cheeseburger',note:'',price:800}],notes:''},
    {name:'Tom',items:[{id:'6BVRZ13F73RGT',q:1,name:'Cheese Balls',note:'Bucket of 18',price:1100},{id:'QX5PVE7HBAEDM',q:1,name:'Boneless Bites',note:'12 piece',price:1400}],notes:'Ranch on the side'}];
  $('#testOrder').addEventListener('click',()=>{
    const s=SAMPLE[Math.floor(Math.random()*SAMPLE.length)], seq=LS.get('hfgb_oo_seq',1040)+1; LS.set('hfgb_oo_seq',seq);
    const sub=s.items.reduce((a,i)=>a+i.price*i.q,0), tax=Math.round(sub*0.075);
    const q=orders(); q.push({num:seq,name:s.name,phone:'4025550199',items:s.items,notes:s.notes,sub,tax,total:sub+tax,when:'asap',readyAt:Date.now()+20*60000,createdAt:Date.now(),status:'new',demo:true});
    seen.add(seq); save(q); chime();
  });
  function tick(){$('#clock').textContent=new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});}
  tick(); setInterval(tick,15000); render();
})();

/* High Flyers online ordering PREVIEW. Static mockup: menu snapshot from Clover (read-only),
   customers remembered in this browser only (localStorage), no real payment, nothing sent to Clover. */
(function(){
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const LS={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
  const money=c=>'$'+(c/100).toFixed(2);
  const digits=s=>(s||'').replace(/\D/g,'').slice(-10);
  const fmtPhone=d=>d.length===10?`(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`:d;
  const fmtTime=t=>new Date(t).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  let MENU=null, ITEMS={}, cart={}, when='asap', TAX=0.075;
  const PREP_MIN=20;

  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),1400);}

  // ---------- data ----------
  fetch('menu.json').then(r=>r.json()).then(m=>{
    MENU=m; TAX=m.taxRate||TAX;
    m.categories.forEach(c=>c.items.forEach(i=>ITEMS[i.id]=Object.assign({cat:c.name},i)));
    cart=LS.get('hfgb_oo_cart',{});
    Object.keys(cart).forEach(k=>{if(!ITEMS[k])delete cart[k]});
    renderMenu(); renderWelcome(); renderCartBar(); route();
  });

  // ---------- menu ----------
  function renderMenu(){
    $('#etaMin').textContent=PREP_MIN;
    if(!openNow()) $('.oo-hero__sub').innerHTML="We're closed right now. Order ahead and pick a time after we open at <b>11 AM</b>.";
    $('#tabs').innerHTML=MENU.categories.map((c,i)=>`<a href="#cat-${c.id}" data-cat="${c.id}" class="${i?'':'on'}">${c.name}</a>`).join('')+'<a href="#drinks" data-cat="drinks">Beer &amp; Cocktails</a>';
    $('#menuList').innerHTML=MENU.categories.map(c=>`
      <div class="cat" id="cat-${c.id}">
        <div class="cat__head"><span class="cat__title">${c.name}</span><img src="/assets/logo-color.png" alt=""></div>
        <div class="cat__body">${c.items.map(itemRow).join('')}</div>
      </div>`).join('');
    $('#drinksNote').id='drinks';
    $('#drinks').innerHTML='<b>Beer &amp; cocktails: TBD with JD</b>'+MENU.drinksNote+' Pop is on the menu above.';
    $$('.tabs a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();
      const el=document.getElementById(a.getAttribute('href').slice(1));
      window.scrollTo({top:el.getBoundingClientRect().top+scrollY-140,behavior:'smooth'});
      setTab(a.dataset.cat);}));
    $('#menuList').addEventListener('click',e=>{
      const b=e.target.closest('button[data-act]'); if(!b)return;
      const id=b.dataset.id; cart[id]=(cart[id]||0)+(b.dataset.act==='add'||b.dataset.act==='inc'?1:-1);
      if(cart[id]<=0)delete cart[id];
      if(b.dataset.act==='add')toast('Added '+ITEMS[id].name);
      saveCart(); refreshRow(id); renderCartBar(true);
    });
    window.addEventListener('scroll',spy,{passive:true});
  }
  function itemRow(i){
    return `<div class="item" data-row="${i.id}">
      <div class="item__main"><div class="item__name">${i.name}</div>${i.note?`<div class="item__note">${i.note}</div>`:''}</div>
      <div class="item__price">${money(i.price)}</div>${ctrl(i.id)}</div>`;
  }
  function ctrl(id){
    const q=cart[id]||0;
    return q?`<div class="qty"><button data-act="dec" data-id="${id}" aria-label="Remove one">&minus;</button><span>${q}</span><button data-act="inc" data-id="${id}" aria-label="Add one">+</button></div>`
            :`<button class="add" data-act="add" data-id="${id}" aria-label="Add ${ITEMS[id].name}">+</button>`;
  }
  function refreshRow(id){const r=document.querySelector(`[data-row="${id}"]`);if(!r)return;r.lastElementChild.outerHTML=ctrl(id);}
  function setTab(id){$$('.tabs a').forEach(a=>a.classList.toggle('on',a.dataset.cat===id));
    const on=$('.tabs a.on'); if(on)on.scrollIntoView({inline:'center',block:'nearest'});}
  let spyT; function spy(){clearTimeout(spyT);spyT=setTimeout(()=>{
    let cur=MENU.categories[0].id; MENU.categories.forEach(c=>{const el=document.getElementById('cat-'+c.id);if(el&&el.getBoundingClientRect().top<170)cur=c.id;});
    const d=$('#drinks'); if(d&&d.getBoundingClientRect().top<window.innerHeight-120&&window.innerHeight+scrollY>=document.body.scrollHeight-40)cur='drinks';
    setTab(cur);},60);}

  // ---------- cart ----------
  function saveCart(){LS.set('hfgb_oo_cart',cart);}
  function sums(){
    let n=0,sub=0; Object.entries(cart).forEach(([id,q])=>{n+=q;sub+=ITEMS[id].price*q;});
    const tax=Math.round(sub*TAX); return {n,sub,tax,total:sub+tax};
  }
  function renderCartBar(bump){
    const s=sums(), bar=$('#cartbar');
    $('#cartCount').textContent=s.n; $('#cartAmt').textContent=money(s.sub);
    bar.classList.toggle('hidden',!s.n||currentView()!=='menu');
    if(bump){bar.classList.remove('bump');void bar.offsetWidth;bar.classList.add('bump');}
  }
  $('#cartBtn').addEventListener('click',()=>go('checkout'));

  function lineHTML(id,q,editable){
    const i=ITEMS[id];
    return `<div class="line"><div class="line__name">${i.name}${i.note?`<small>${i.note}</small>`:''}</div>
      ${editable?`<div class="qty"><button data-act="dec" data-id="${id}">&minus;</button><span>${q}</span><button data-act="inc" data-id="${id}">+</button></div>`:`<span>&times;${q}</span>`}
      <div class="line__amt">${money(i.price*q)}</div></div>`;
  }
  function totalsHTML(){const s=sums();return `<div class="trow"><span>Subtotal</span><span>${money(s.sub)}</span></div>
    <div class="trow"><span>Tax (7.5%)</span><span>${money(s.tax)}</span></div>
    <div class="trow trow--big"><span>Total</span><span>${money(s.total)}</span></div>`;}
  function renderCheckout(){
    const ids=Object.keys(cart);
    if(!ids.length){go('menu');return;}
    $('#cartLines').innerHTML=ids.map(id=>lineHTML(id,cart[id],true)).join('');
    $('#totals').innerHTML=totalsHTML();
    fillTimes();
    const asapBtn=$('#whenSeg [data-when="asap"]');
    if(openNow()){asapBtn.disabled=false;$('#asapTime').textContent='about '+fmtTime(readyAsap());}
    else{asapBtn.disabled=true;$('#asapTime').textContent='closed now';if(when==='asap')$('#whenSeg [data-when="later"]').click();}
    const me=currentCustomer();
    if(me){ if(!$('#phone').value)$('#phone').value=fmtPhone(me.phone); if(!$('#name').value)$('#name').value=me.name; phoneLookup(); }
  }
  $('#cartLines').addEventListener('click',e=>{const b=e.target.closest('button[data-act]');if(!b)return;
    const id=b.dataset.id;cart[id]=(cart[id]||0)+(b.dataset.act==='inc'?1:-1);if(cart[id]<=0)delete cart[id];
    saveCart();refreshRow(id);renderCheckout();});

  // pickup time. Hours from the site: Mon-Sat 11 AM to 1 AM, Sun 11 AM to 10 PM (kitchen cutoff TBD with JD).
  function isOpen(ms){
    const t=new Date(ms), h=t.getHours()+t.getMinutes()/60, d=t.getDay();
    if(h>=11) return d===0 ? h<21.75 : true;          // last pickup 15 min before close
    const prev=(d+6)%7; return h<0.75 && prev!==0;     // after midnight: open till 1 AM except Sun night
  }
  function openNow(){return isOpen(readyAsap());}
  function readyAsap(){const n=sums().n;return Date.now()+(PREP_MIN+(n>6?5:0))*60000;}
  function fillTimes(){
    const sel=$('#pickupTime'), keep=sel.value; sel.innerHTML='';
    let t=new Date(Date.now()+30*60000); t.setMinutes(Math.ceil(t.getMinutes()/15)*15,0,0);
    let k=0; for(let g=0;g<200&&k<16;g++){ if(isOpen(t.getTime())){const o=document.createElement('option');o.value=t.getTime();o.textContent=fmtTime(t)+(t.getDate()!==new Date().getDate()?' (tomorrow)':'');sel.appendChild(o);k++;} t=new Date(t.getTime()+15*60000);}
    if(keep)sel.value=keep;
  }
  $('#whenSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;when=b.dataset.when;
    $$('#whenSeg button').forEach(x=>x.classList.toggle('on',x===b));$('#pickupTime').classList.toggle('hidden',when!=='later');});

  // remember customers by phone
  function customers(){return LS.get('hfgb_oo_customers',{});}
  function currentCustomer(){const p=LS.get('hfgb_oo_me',null);return p?customers()[p]||null:null;}
  function phoneLookup(){
    const d=digits($('#phone').value), c=customers()[d], h=$('#phoneHint');
    if(d.length===10&&c){ if(!$('#name').value)$('#name').value=c.name; h.textContent='Welcome back, '+c.name+'!'; h.classList.add('ok'); }
    else { h.textContent="We'll remember you next time."; h.classList.remove('ok'); }
  }
  $('#phone').addEventListener('input',e=>{const d=digits(e.target.value);if(d.length===10)e.target.value=fmtPhone(d);phoneLookup();});

  $('#toPay').addEventListener('click',()=>{
    const d=digits($('#phone').value), nm=$('#name').value.trim();
    if(d.length!==10||!nm){$('#coErr').classList.remove('hidden');return;}
    $('#coErr').classList.add('hidden'); go('pay');
  });

  function renderPay(){
    if(!Object.keys(cart).length){go('menu');return;}
    $('#payTotals').innerHTML=totalsHTML(); $('#payAmt').textContent=money(sums().total);
  }
  $('#payBtn').addEventListener('click',()=>{
    const b=$('#payBtn'); b.disabled=true; b.textContent='Processing (Demo)...';
    setTimeout(()=>{placeOrder(); b.disabled=false;},700);
  });

  function placeOrder(){
    const d=digits($('#phone').value), nm=$('#name').value.trim(), s=sums();
    const seq=LS.get('hfgb_oo_seq',1040)+1; LS.set('hfgb_oo_seq',seq);
    const readyAt= when==='later'?+$('#pickupTime').value:readyAsap();
    const order={num:seq,name:nm,phone:d,items:Object.entries(cart).map(([id,q])=>({id,q,name:ITEMS[id].name,note:ITEMS[id].note,price:ITEMS[id].price})),
      notes:$('#notes').value.trim(),sub:s.sub,tax:s.tax,total:s.total,when,readyAt,createdAt:Date.now(),status:'new',demo:true};
    // remember the customer (this browser only in the preview)
    const cs=customers(), c=cs[d]||{phone:d,orders:[]};
    c.name=nm; c.orders=(c.orders||[]).concat([{items:Object.assign({},cart),ts:Date.now(),total:s.total}]).slice(-10);
    cs[d]=c; LS.set('hfgb_oo_customers',cs); LS.set('hfgb_oo_me',d);
    // demo "order bus" the staff screen listens to
    const q=LS.get('hfgb_oo_orders',[]); q.push(order); LS.set('hfgb_oo_orders',q.slice(-30));
    LS.set('hfgb_oo_lastOrder',order);
    cart={}; saveCart(); $$('[data-row]').forEach(r=>refreshRow(r.dataset.row)); $('#notes').value='';
    go('done');
  }
  function renderDone(){
    const o=LS.get('hfgb_oo_lastOrder',null); if(!o){go('menu');return;}
    $('#doneNum').textContent='#'+o.num; $('#doneReady').textContent=fmtTime(o.readyAt);
    $('#doneSub').textContent=`Thanks, ${o.name}! We'll text ${fmtPhone(o.phone)} when it's ready.`;
    $('#doneLines').innerHTML=o.items.map(i=>`<div class="line"><div class="line__name">${i.name}${i.note?`<small>${i.note}</small>`:''}</div><span>&times;${i.q}</span><div class="line__amt">${money(i.price*i.q)}</div></div>`).join('')
      +`<div class="totals"><div class="trow trow--big"><span>Paid (demo)</span><span>${money(o.total)}</span></div></div>`;
  }
  $('#newOrder').addEventListener('click',()=>{renderWelcome();go('menu');window.scrollTo(0,0);});

  // usual = most frequent basket among recent orders (falls back to last)
  function usualOf(c){
    if(!c||!c.orders||!c.orders.length)return null;
    const cnt={}; c.orders.forEach(o=>{const k=JSON.stringify(Object.keys(o.items).sort().map(id=>[id,o.items[id]]));cnt[k]=(cnt[k]||0)+1;});
    const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1]||0)[0][0];
    const items={}; JSON.parse(best).forEach(([id,q])=>{if(ITEMS[id])items[id]=q;}); return Object.keys(items).length?items:null;
  }
  function renderWelcome(){
    const c=currentCustomer(), w=$('#welcome');
    if(!c){w.classList.add('hidden');return;}
    const u=usualOf(c);
    $('#welcomeName').textContent='Hey, '+c.name+'!';
    $('#welcomeUsual').innerHTML=u?'Your usual: '+Object.entries(u).map(([id,q])=>`${q>1?q+'&times; ':''}${ITEMS[id].name}${ITEMS[id].note?' ('+ITEMS[id].note+')':''}`).join(', '):'';
    $('#reorderBtn').classList.toggle('hidden',!u);
    w.classList.remove('hidden');
  }
  $('#reorderBtn').addEventListener('click',()=>{
    const u=usualOf(currentCustomer()); if(!u)return; cart=Object.assign({},u); saveCart();
    $$('[data-row]').forEach(r=>refreshRow(r.dataset.row)); go('checkout');
  });
  $('#notYou').addEventListener('click',()=>{localStorage.removeItem('hfgb_oo_me');$('#phone').value='';$('#name').value='';renderWelcome();});

  // ---------- routing ----------
  const VIEWS=['menu','checkout','pay','done'];
  function currentView(){const h=location.hash.slice(1);return VIEWS.includes(h)?h:'menu';}
  function go(v){if(location.hash!=='#'+v)location.hash=v;else route();}
  function route(){
    if(!MENU)return; const v=currentView();
    VIEWS.forEach(x=>$('#v-'+x).classList.toggle('hidden',x!==v));
    if(v==='checkout')renderCheckout(); if(v==='pay')renderPay(); if(v==='done')renderDone();
    if(v!=='menu')window.scrollTo(0,0);
    renderCartBar();
  }
  window.addEventListener('hashchange',route);
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
})();

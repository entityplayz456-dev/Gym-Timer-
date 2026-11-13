'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ld=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2200)};
const E=(name,sets,reps,rest,ss)=>({id:uid(),name,sets,reps,rest,warm:[],...(ss?{ss}:{})});
const PLAN_VER=4;
const UL=[
{id:'push',name:'Push',ex:[['Incline Isolated Chest Press',3,'6–9',180],['Flat Chest Machine',3,'6–9',180],['Pec Deck',3,'6–9',120],['Machine Shoulder Press',3,'6–9',180],['Lateral Raises',3,'6–9',90],['Overhead Cable Triceps Extension',3,'6–9',90],['Triceps Pushdown',3,'6–9',90],['Dip Machine',2,'6–9',150]]},
{id:'pull',name:'Pull',ex:[['Lat Pulldown',3,'6–9',150],['Smith Machine Rows',2,'6–9',150],['Modified Wide-Grip Row',2,'6–9',150],['Reverse Pec Deck',3,'6–9',90],['Face Pulls',2,'6–9',90],['Supinating Dumbbell Curls',3,'6–9',120],['Preacher Curls',3,'6–9',120]]},
{id:'legs',name:'Legs',ex:[['Romanian Deadlift',3,'6–9',210],['Leg Press',3,'10–15',180],['Leg Extensions',3,'10–15',90],['Hamstring Curls',3,'10–15',120],['Calf Raises',3,'10–15',90],['Hanging Leg Raises',3,'10–15',90],['Cable Crunches',3,'10–15',75]]}];
const ulDays=()=>UL.map(d=>({id:d.id,name:d.name,ex:d.ex.map(a=>E(...a))}));
const defaults=()=>({planVer:PLAN_VER,days:ulDays(),
set:{trans:60,ss:15,sound:true,vib:true,notify:false},templates:[],history:[]});
let D=ld('grm.data',null)||defaults(),S=ld('grm.active',null),tab='workout',sum=null,wd=D.days[0]?.id,inst=null;
D.set={...defaults().set,...D.set};
/* one-time reset of the plan to the Push/Pull/Legs list above; history, settings, templates and warm-ups are kept */
(function(){if(D.planVer===PLAN_VER)return;
 const old=['push','pull','legs','upperA','upperB','upper','lower'],warm={};
 D.days.forEach(d=>d.ex.forEach(x=>{if(x.warm?.length&&!warm[x.name])warm[x.name]=x.warm}));
 const nd=ulDays();nd.forEach(d=>d.ex.forEach(x=>{if(warm[x.name])x.warm=warm[x.name]}));
 D.days=[...nd,...D.days.filter(d=>!old.includes(d.id))];D.planVer=PLAN_VER;wd=D.days[0].id;
 try{localStorage.setItem('grm.data',JSON.stringify(D))}catch{}})();
const save=()=>{try{localStorage.setItem('grm.data',JSON.stringify(D))}catch{toast('Storage full or blocked')}};
const saveS=()=>{try{S?localStorage.setItem('grm.active',JSON.stringify(S)):localStorage.removeItem('grm.active')}catch{}};
const fmt=ms=>{const s=Math.ceil(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const sec=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
const dur=ms=>{const m=Math.round(ms/60000);return m>=60?Math.floor(m/60)+' h '+m%60+' min':m+' min'};
const kg=n=>(+n||0)+' kg';
const C=2*Math.PI*114;

/* ---------- audio / vibration / wake lock / notifications ---------- */
let ac,wl;
function unlock(){try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume()}catch{}}
function beep(f,t0,d){const o=ac.createOscillator(),g=ac.createGain(),n=ac.currentTime+t0;o.frequency.value=f;o.connect(g);g.connect(ac.destination);g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(.6,n+.02);g.gain.exponentialRampToValueAtTime(.0001,n+d);o.start(n);o.stop(n+d+.05)}
function alarm(){
 if(D.set.sound&&ac){try{[0,.35,.7].forEach(t=>beep(880,t,.25));beep(1320,1.05,.6)}catch{}}
 if(D.set.vib&&navigator.vibrate)navigator.vibrate([300,150,300,150,600]);
 if(D.set.notify&&document.hidden&&window.Notification&&Notification.permission==='granted'&&navigator.serviceWorker)
  navigator.serviceWorker.ready.then(r=>r.showNotification('Rest complete',{body:S?('Next: '+nextText()):'Start your next set',tag:'rest',renotify:true,vibrate:[300,150,300]}));
}
async function wake(){try{if(S&&'wakeLock'in navigator&&!wl){wl=await navigator.wakeLock.request('screen');wl.onrelease=()=>{wl=null}}}catch{}}
function unwake(){try{wl&&wl.release()}catch{}wl=null}

/* ---------- session helpers ---------- */
/* flat step list: warm-ups of a superset group first, then work sets alternate A1 B1 A2 B2 ... */
function buildPlan(ex){const plan=[];let i=0;
 while(i<ex.length){let j=i+1;while(ex[i].ss&&j<ex.length&&ex[j].ss===ex[i].ss)j++;
  const g=[];for(let a=i;a<j;a++)g.push(a);
  g.forEach(a=>ex[a].warm.forEach((_,n)=>plan.push({ei:a,warm:true,n,grp:i})));
  const mx=Math.max(...g.map(a=>ex[a].sets));
  for(let r=0;r<mx;r++)g.forEach(a=>{if(r<ex[a].sets)plan.push({ei:a,warm:false,n:r,grp:i})});
  i=j}
 return plan}
const grpOf=(st)=>[...new Set(S.plan.filter(x=>x.grp===st.grp).map(x=>x.ei))];
function cs(){const st=S.plan[S.p],e=S.ex[st.ei];return{st,e,warm:st.warm,n:st.n+1,tot:st.warm?e.warm.length:e.sets}}
function restAfter(p){const st=S.plan[p],nx=S.plan[p+1],e=S.ex[st.ei];
 if(!nx)return{kind:'end',d:0};
 if(nx.grp!==st.grp)return{kind:'trans',d:D.set.trans};
 if(st.warm)return{kind:'rest',d:e.warm[st.n].rest};
 if(!nx.warm&&nx.ei>st.ei)return{kind:'ss',d:D.set.ss};
 return{kind:'rest',d:Math.max(...grpOf(st).map(i=>S.ex[i].rest))}}
function nextText(){const nx=S.plan[S.p+1];if(!nx)return 'finish';return S.ex[nx.ei].name+' · '+(nx.warm?'warm-up ':'set ')+(nx.n+1)}
function prevSets(name,after=-1){for(let i=after+1;i<D.history.length;i++){const x=D.history[i].ex.find(x=>x.name===name&&x.work.length);if(x)return x.work}return null}
function prefill(){
 const c=cs(),same=S.log.filter(l=>l.ei===c.st.ei&&l.warm===c.warm).pop();
 let w=0,r=0;
 if(c.warm){const x=c.e.warm[c.n-1];w=x.w;r=x.r}
 else if(same){w=same.w;r=same.r}
 else{const p=prevSets(c.e.name);if(p){const q=p[Math.min(c.n-1,p.length-1)];w=q.w;r=q.r}else r=parseInt(c.e.reps)||0}
 S.cur={w,r,rir:2,fat:'ok',note:''};
}
function startTimer(kind,s){const n=Date.now();S.timer={kind,start:n,end:n+s*1000,total:s*1000,base:s*1000,paused:null,fired:false}}
const closeRest=n=>{if(S.timer){S.rests.push(Math.max(0,n-S.timer.start));S.timer=null}};

function start(id){
 if(S&&!confirm('A workout is in progress. Discard it and start a new one?'))return;
 const d=D.days.find(x=>x.id===id);if(!d||!d.ex.length)return toast('Add exercises in Settings first');
 S={id:uid(),day:d.name,start:Date.now(),ex:JSON.parse(JSON.stringify(d.ex)),p:0,log:[],timer:null,rests:[],hint:null};S.plan=buildPlan(S.ex);S.i=S.plan[0].ei;
 prefill();saveS();unlock();wake();tab='timer';render();
}
function complete(){
 unlock();const c=cs(),n=Date.now(),ra=restAfter(S.p);closeRest(n);
 const q=S.cur,l={ei:c.st.ei,warm:c.warm,w:+q.w||0,r:+q.r||0,rir:q.rir,fat:q.fat,note:(q.note||'').trim(),at:n};
 S.log.push(l);S.hint=null;S.p++;
 if(S.p>=S.plan.length)return finish(true);
 S.i=S.plan[S.p].ei;
 if(!c.warm&&ra.kind==='rest'){
  const p=S.log.filter(x=>x.ei===l.ei&&!x.warm).slice(-2,-1)[0];let add=0,msg='';
  if(p){const dr=p.r-l.r;add=dr>=3?60:dr>=2?30:0;if(add)msg='Reps dropped from '+p.r+' to '+l.r+'.'}
  if(l.fat==='heavy'&&add<30){add=30;msg='You marked that set heavy.'}
  if(add)S.hint={add,msg};
 }
 if(ra.d>0)startTimer(ra.kind,ra.d);
 prefill();saveS();render();
}
function finish(auto){
 const n=Date.now();closeRest(n);
 const rec={id:S.id,day:S.day,start:S.start,end:n,rests:S.rests,
  ex:S.ex.map((e,i)=>({name:e.name,planned:e.sets,warm:S.log.filter(l=>l.ei===i&&l.warm).length,
   work:S.log.filter(l=>l.ei===i&&!l.warm).map(({w,r,rir,note})=>({w,r,rir,note}))}))};
 if(S.log.length){D.history.unshift(rec);save();sum=rec}
 S=null;saveS();unwake();render();
}
function addTime(s){const t=S?.timer;if(!t)return;const n=Date.now(),ms=s*1000;
 if(t.fired||(t.paused==null&&t.end<=n)){t.end=n+ms;t.total=ms;t.fired=false;t.paused=null}
 else if(t.paused!=null){t.paused+=ms;t.total+=ms}else{t.end+=ms;t.total+=ms}
 saveS();render()}

/* ---------- ticking (timestamp based, single interval) ---------- */
function tick(){
 const t=S?.timer,nt=$('#nt');
 if(!t){if(nt)nt.textContent='Timer';return}
 const n=Date.now(),left=t.paused!=null?t.paused:Math.max(0,t.end-n);
 if(t.paused==null&&!t.fired&&n>=t.end){t.fired=true;saveS();if(n-t.end<4000)alarm();if(tab==='timer')render()}
 if(nt)nt.textContent=t.fired?'Ready':fmt(left);
 const td=$('#td');if(tab!=='timer'||!td)return;
 td.textContent=fmt(left);
 $('#pr').style.strokeDashoffset=t.fired?0:C*(1-(t.total?left/t.total:0));
}
setInterval(tick,250);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){wake();tick();render()}});

/* ---------- views ---------- */
function vWork(){
 const d=D.days.find(x=>x.id===wd)||D.days[0];
 let h='<h1>Workout</h1>';
 if(S)h+=`<div class="card"><h2>${esc(S.day)} in progress</h2><p>${S.log.filter(l=>!l.warm).length} working sets logged · ${esc(S.ex[S.i].name)}</p><button class="btn pri full" style="margin-top:10px" data-a="tab" data-v="timer">Resume workout</button></div>`;
 h+='<div class="days">'+D.days.map(x=>`<button class="day ${d&&x.id===d.id?'on':''}" data-a="day" data-v="${x.id}">${esc(x.name)}</button>`).join('')+'</div>';
 if(!d)return h+'<p>No workout days yet. Add one in Settings.</p>';
 const ts=d.ex.reduce((a,e)=>a+e.sets,0);
 h+=`<div class="card"><p>${d.ex.length} exercises · ${ts} working sets</p>`+d.ex.map((e,i)=>`<div class="ex"><b>${(e.ss&&(d.ex[i-1]?.ss===e.ss||d.ex[i+1]?.ss===e.ss))?'<span style="color:var(--ac)">⇄ </span>':''}${esc(e.name)}</b><span class="mu">${e.sets} × ${esc(e.reps)} · ${sec(e.rest)}${e.warm.length?' · '+e.warm.length+' warm-up':''}</span></div>`).join('')+'</div>';
 return h+`<div class="dock"><button class="btn pri big" data-a="start" data-v="${d.id}">START ${esc(d.name.toUpperCase())}</button></div>`;
}
function vTimer(){
 if(sum)return vSum(sum);
 if(!S)return '<div class="empty"><h2>No workout running</h2><p>Pick Push, Pull or Legs to begin.</p><button class="btn pri" data-a="tab" data-v="workout">Choose a workout</button></div>';
 const c=cs(),t=S.timer,tot=S.ex.reduce((a,e)=>a+e.sets,0),dn=S.log.filter(l=>!l.warm).length,q=S.cur;
 const prev=prevSets(c.e.name),today=S.log.filter(l=>l.ei===c.st.ei&&!l.warm),ra=restAfter(S.p),pg=grpOf(c.st).filter(i=>i!==c.st.ei);
 const left=t?(t.paused!=null?t.paused:Math.max(0,t.end-Date.now())):0,done=t&&(t.fired||(t.paused==null&&left===0));
 const lbl=!t?'Start your set':t.paused!=null?'Paused':done?(t.kind==='ss'?'Go — superset':'Rest complete'):t.kind==='trans'?'Moving to next exercise':t.kind==='ss'?'Switch to superset partner':'Rest remaining';
 const rec=ra.d,cap=!t?(ra.kind==='ss'?'Then switch'+(ra.d?' ('+ra.d+' s)':' straight away'):ra.kind==='end'?'Last set':(ra.kind==='trans'?'Then next exercise: ':'Rest after this set: ')+sec(rec)):(t.kind==='trans'?'Transition':t.kind==='ss'?'Switch time':'Planned rest')+': '+sec(t.base/1000)+(t.total!==t.base?' (+'+Math.round((t.total-t.base)/1000)+' s)':'');
 const ring=`<div class="ringw ${done?'done':''} ${!t?'idle':''}"><svg viewBox="0 0 260 260"><circle class="tr" cx="130" cy="130" r="114"/><circle id="pr" class="pr" cx="130" cy="130" r="114" stroke-dasharray="${C}" style="stroke-dashoffset:${!t?C:done?0:C*(1-left/t.total)}"/></svg><div class="rc"><div class="mu sm">${lbl}</div><div id="td">${!t?sec(rec).padStart(5,'0'):fmt(left)}</div><div class="mu sm">${cap}</div></div></div>`;
 const fat=['fresh','ok','heavy'];
 return `<div class="mu sm">${esc(S.day)} · ${dn} / ${tot} working sets</div><div class="bar"><i style="width:${tot?dn/tot*100:0}%"></i></div>
 <div class="cx"><div class="name">${esc(c.e.name)}</div><div class="set">${c.warm?'Warm-up':'Set'} ${c.n} / ${c.tot}${c.warm?'':' · target '+esc(c.e.reps)+' reps'}</div>${pg.length?`<div class="mu sm">⇄ Superset with ${esc(pg.map(i=>S.ex[i].name).join(', '))}</div>`:''}</div>
 ${ring}
 <p class="cx">Next: ${esc(nextText()==='finish'?'finish workout':nextText())}</p>
 ${S.hint&&t&&!done?`<div class="hint"><b>${esc(S.hint.msg)}</b> Consider ${S.hint.add} more seconds before the next set.<div class="row"><button class="btn pri" data-a="hint">Add ${S.hint.add} s</button><button class="btn" data-a="nohint">Keep planned rest</button></div></div>`:''}
 <div class="ctl"><button class="btn" data-a="${t&&t.paused!=null?'resume':'pause'}" ${t&&!done?'':'disabled'}>${t&&t.paused!=null?'Resume':'Pause'}</button><button class="btn" data-a="add" data-v="15" ${t?'':'disabled'}>+15 s</button><button class="btn" data-a="add" data-v="30" ${t?'':'disabled'}>+30 s</button><button class="btn" data-a="skip" ${t&&!done?'':'disabled'}>Skip</button><button class="btn" data-a="reset" ${t?'':'disabled'}>Reset</button></div>
 <div class="card"><div class="g2"><div><label>Weight (kg)</label><div class="st"><button class="btn" data-a="adj" data-k="w" data-d="-2.5">−</button><input id="iw" type="number" inputmode="decimal" step="0.5" value="${q.w}"><button class="btn" data-a="adj" data-k="w" data-d="2.5">+</button></div></div>
 <div><label>Reps</label><div class="st"><button class="btn" data-a="adj" data-k="r" data-d="-1">−</button><input id="ir" type="number" inputmode="numeric" value="${q.r}"><button class="btn" data-a="adj" data-k="r" data-d="1">+</button></div></div></div>
 <label style="margin-top:10px">Reps in reserve</label><div class="chips">${[0,1,2,3].map(v=>`<button class="chip ${q.rir===v?'on':''}" data-a="rir" data-v="${v}">${v===3?'3+':v}</button>`).join('')}</div>
 <label style="margin-top:10px">How did it feel?</label><div class="chips">${fat.map(v=>`<button class="chip ${q.fat===v?'on':''}" data-a="fat" data-v="${v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div>
 <input id="inote" style="margin-top:10px" placeholder="Note (optional)" value="${esc(q.note)}"></div>
 <div class="card sm"><div class="mu">Previous session</div>${prev?prev.map((s,i)=>`Set ${i+1}: ${s.w} kg × ${s.r}`).join('<br>'):'<span class="mu">No previous record</span>'}<div class="mu" style="margin-top:8px">Today</div>${today.length?today.map((s,i)=>`Set ${i+1}: ${s.w} kg × ${s.r}`).join('<br>'):'<span class="mu">Nothing logged yet</span>'}</div>
 <button class="btn dng full" data-a="end">End workout</button>
 <div class="dock"><button class="btn pri big" data-a="complete">SET COMPLETE</button></div>`;
}
function stats(rec){
 const w=rec.ex.flatMap(e=>e.work),pl=rec.ex.reduce((a,e)=>a+e.planned,0),rs=rec.rests.reduce((a,b)=>a+b,0);
 return{sets:w.length,pl,reps:w.reduce((a,s)=>a+s.r,0),total:rec.end-rec.start,rs,avg:rec.rests.length?rs/rec.rests.length:0,done:rec.ex.filter(e=>e.work.length).length};
}
function exRows(rec,idx){
 return rec.ex.filter(e=>e.work.length).map(e=>{
  const p=idx>=0?prevSets(e.name,idx):null,r=e.work.reduce((a,s)=>a+s.r,0),pr=p?p.reduce((a,s)=>a+s.r,0):null;
  const vol=e.work.reduce((a,s)=>a+s.w*s.r,0),pv=p?p.reduce((a,s)=>a+s.w*s.r,0):null;
  let cmp='';if(p){const d=vol-pv;cmp=`<div class="sm ${d>0?'up':d<0?'dn':'mu'}">${d>0?'▲':d<0?'▼':'='} volume ${d>0?'+':''}${Math.round(d)} kg vs last (${pr} → ${r} reps)</div>`}
  return `<div class="ex"><div><b>${esc(e.name)}</b> <span class="mu sm">${e.work.length}/${e.planned} sets</span><div class="sm mu">${e.work.map(s=>s.w+'×'+s.r).join(' · ')}</div>${cmp}</div></div>`}).join('');
}
function statHTML(rec){const s=stats(rec);return `<div class="stat"><div><b>${s.sets} / ${s.pl}</b>working sets</div><div><b>${s.reps}</b>total reps</div><div><b>${dur(s.total)}</b>duration</div><div><b>${dur(s.rs)}</b>resting</div><div><b>${rec.rests.length?sec(Math.round(s.avg/1000)):'–'}</b>average rest</div><div><b>${s.done} / ${rec.ex.length}</b>exercises done</div></div>`}
function vSum(rec){return `<h1>Workout complete</h1><p style="margin-bottom:10px">${esc(rec.day)} · ${new Date(rec.start).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short'})}</p>${statHTML(rec)}<div class="card">${exRows(rec,D.history.findIndex(h=>h.id===rec.id))}</div><button class="btn pri full" data-a="sumdone">Done</button>`}
function vHist(){
 let h='<h1>History</h1>';if(!D.history.length)return h+'<div class="card"><p>No finished workouts yet. Complete a session and it will appear here.</p></div>';
 const names={};[...D.history].reverse().forEach(s=>s.ex.forEach(e=>{if(e.work.length){const top=e.work.reduce((a,b)=>b.w>a.w||(b.w===a.w&&b.r>a.r)?b:a);(names[e.name]=names[e.name]||[]).push(top)}}));
 h+='<details><summary>Progression (top set per session)</summary><div>'+Object.entries(names).map(([n,a])=>{const l=a.slice(-6),L=l[l.length-1],P=l[l.length-2];const dl=P?(L.w>P.w||(L.w===P.w&&L.r>P.r)?'<span class="up">▲</span>':L.w<P.w||(L.w===P.w&&L.r<P.r)?'<span class="dn">▼</span>':'='):'';return `<div class="ex"><div><b>${esc(n)}</b> ${dl}<div class="sm mu">${l.map(s=>s.w+'×'+s.r).join(' → ')}</div></div></div>`}).join('')+'</div></details>';
 return h+D.history.map((r,i)=>`<details><summary>${esc(r.day)} · ${new Date(r.start).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})} <span class="mu sm">${dur(r.end-r.start)}</span></summary><div>${statHTML(r)}${exRows(r,i)}<button class="btn dng full" style="margin-top:10px" data-a="delsess" data-v="${r.id}">Delete this session</button></div></details>`).join('');
}
const sw=(k,l,sub)=>`<label class="sw" style="font-size:16px;color:var(--tx);margin:0"><span>${l}${sub?`<br><span class="mu sm">${sub}</span>`:''}</span><input type="checkbox" data-f="set" data-k="${k}" ${D.set[k]?'checked':''}></label>`;
function vSet(){
 let h='<h1>Settings</h1><p style="margin-bottom:10px">Plan changes apply to the next workout you start, not to one already running.</p>';
 h+=D.days.map(d=>`<details><summary>${esc(d.name)} <span class="mu sm">${d.ex.length} exercises</span></summary><div>
 <label>Day name</label><input data-f="dname" data-d="${d.id}" value="${esc(d.name)}" style="margin-bottom:10px">
 ${d.ex.map((x,i)=>`<div class="exc"><label>Exercise</label><input data-f="name" data-d="${d.id}" data-e="${x.id}" value="${esc(x.name)}">
 <div class="g3" style="margin-top:8px"><div><label>Sets</label><input type="number" inputmode="numeric" data-f="sets" data-d="${d.id}" data-e="${x.id}" value="${x.sets}"></div><div><label>Reps</label><input data-f="reps" data-d="${d.id}" data-e="${x.id}" value="${esc(x.reps)}"></div><div><label>Rest (s)</label><input type="number" inputmode="numeric" data-f="rest" data-d="${d.id}" data-e="${x.id}" value="${x.rest}"></div></div>
 ${x.warm.map((w,j)=>`<div class="g3" style="margin-top:8px;align-items:end"><div><label>Warm-up ${j+1} kg</label><input type="number" inputmode="decimal" data-f="w" data-w="${j}" data-d="${d.id}" data-e="${x.id}" value="${w.w}"></div><div><label>Reps</label><input type="number" inputmode="numeric" data-f="r" data-w="${j}" data-d="${d.id}" data-e="${x.id}" value="${w.r}"></div><div class="row"><div><label>Rest (s)</label><input type="number" inputmode="numeric" data-f="rest" data-w="${j}" data-d="${d.id}" data-e="${x.id}" value="${w.rest}"></div><button class="btn dng" style="flex:0 0 48px" data-a="delwarm" data-d="${d.id}" data-e="${x.id}" data-v="${j}">✕</button></div></div>`).join('')}
 <div class="row" style="margin-top:8px"><button class="btn" data-a="addwarm" data-d="${d.id}" data-e="${x.id}">+ Warm-up</button>${i<d.ex.length-1?`<button class="btn" data-a="pair" data-d="${d.id}" data-v="${i}">${x.ss&&d.ex[i+1].ss===x.ss?'Unpair ↓':'⇄ Pair ↓'}</button>`:''}<button class="btn" data-a="up" data-d="${d.id}" data-v="${i}">↑</button><button class="btn" data-a="down" data-d="${d.id}" data-v="${i}">↓</button><button class="btn dng" data-a="delex" data-d="${d.id}" data-v="${i}">Remove</button></div></div>`).join('')}
 <div class="row"><button class="btn" data-a="addex" data-d="${d.id}">+ Add exercise</button><button class="btn" data-a="savetpl" data-d="${d.id}">Save as template</button></div>
 <button class="btn dng full" style="margin-top:8px" data-a="delday" data-d="${d.id}">Delete this day</button></div></details>`).join('');
 h+='<button class="btn full" style="margin-bottom:12px" data-a="addday">+ Add workout day</button>';
 h+=`<div class="card"><h2>Preferences</h2><label>Exercise transition (seconds)</label><input type="number" inputmode="numeric" data-f="set" data-k="trans" value="${D.set.trans}"><label style="margin-top:10px">Superset switch time (seconds, 0 = straight away)</label><input type="number" inputmode="numeric" data-f="set" data-k="ss" value="${D.set.ss}">${sw('sound','Alarm sound')}${sw('vib','Vibration')}${sw('notify','Notifications','Shown only if the page is still running in the background')}</div>`;
 h+=`<div class="card"><h2>Templates</h2>${D.templates.length?D.templates.map((t,i)=>`<div class="ex"><b>${esc(t.name)}</b><span class="row" style="flex:0 0 auto"><button class="btn" data-a="loadtpl" data-v="${i}">Load</button><button class="btn dng" data-a="deltpl" data-v="${i}">✕</button></span></div>`).join(''):'<p>Save a day as a template from its section above.</p>'}</div>`;
 h+=`<div class="card"><h2>Data</h2><p style="margin-bottom:10px">Everything stays on this phone.</p><div class="g2"><button class="btn" data-a="export">Export JSON</button><button class="btn" data-a="import">Import JSON</button></div><button class="btn dng full" style="margin-top:8px" data-a="resethist">Reset workout history</button>${inst?'<button class="btn pri full" style="margin-top:8px" data-a="install">Install app</button>':''}</div>`;
 return h;
}
function render(){const v=$('#v'),y=v.scrollTop;v.innerHTML=({workout:vWork,timer:vTimer,history:vHist,settings:vSet})[tab]();v.scrollTop=y;$$('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));tick()}

/* ---------- actions ---------- */
const dayOf=el=>D.days.find(x=>x.id===el.dataset.d);
const A={
 tab:el=>{tab=el.dataset.v;render();$('#v').scrollTop=0},
 day:el=>{wd=el.dataset.v;render()},
 start:el=>start(el.dataset.v),
 complete:()=>complete(),
 pause:()=>{const t=S.timer;if(t&&t.paused==null){t.paused=Math.max(0,t.end-Date.now());saveS();render()}},
 resume:()=>{const t=S.timer;if(t&&t.paused!=null){t.end=Date.now()+t.paused;t.paused=null;saveS();render()}},
 add:el=>addTime(+el.dataset.v),
 skip:()=>{const t=S.timer;if(t){t.end=Date.now();t.paused=null;t.fired=true;S.hint=null;saveS();render()}},
 reset:()=>{const t=S.timer;if(t){t.total=t.base;t.end=Date.now()+t.base;t.paused=null;t.fired=false;saveS();render()}},
 adj:el=>{const k=el.dataset.k;S.cur[k]=Math.max(0,Math.round(((+S.cur[k]||0)+ +el.dataset.d)*100)/100);$(k==='w'?'#iw':'#ir').value=S.cur[k];saveS()},
 rir:el=>{S.cur.rir=+el.dataset.v;saveS();render()},
 fat:el=>{S.cur.fat=el.dataset.v;saveS();render()},
 hint:()=>{const a=S.hint.add;S.hint=null;addTime(a)},
 nohint:()=>{S.hint=null;saveS();render()},
 end:()=>{if(confirm('End this workout now? Logged sets will be saved.'))finish()},
 sumdone:()=>{sum=null;tab='workout';render()},
 delsess:el=>{if(confirm('Delete this session?')){D.history=D.history.filter(h=>h.id!==el.dataset.v);save();render()}},
 addday:()=>{const n=prompt('Name of the new workout day?');if(n){D.days.push({id:uid(),name:n.trim(),ex:[]});save();render()}},
 delday:el=>{if(confirm('Delete this day and its exercises?')){D.days=D.days.filter(d=>d.id!==el.dataset.d);wd=D.days[0]?.id;save();render()}},
 addex:el=>{dayOf(el).ex.push(E('New exercise',3,'6–9',120));save();render()},
 delex:el=>{if(confirm('Remove this exercise?')){dayOf(el).ex.splice(+el.dataset.v,1);save();render()}},
 pair:el=>{const a=dayOf(el).ex,i=+el.dataset.v,x=a[i],y=a[i+1];if(!y)return;if(x.ss&&y.ss===x.ss){delete x.ss;delete y.ss}else{const k=x.ss&&a[i-1]?.ss===x.ss?x.ss:uid();x.ss=k;y.ss=k}save();render()},
 up:el=>{const a=dayOf(el).ex,i=+el.dataset.v;if(i>0){[a[i-1],a[i]]=[a[i],a[i-1]];save();render()}},
 down:el=>{const a=dayOf(el).ex,i=+el.dataset.v;if(i<a.length-1){[a[i+1],a[i]]=[a[i],a[i+1]];save();render()}},
 addwarm:el=>{dayOf(el).ex.find(x=>x.id===el.dataset.e).warm.push({w:0,r:8,rest:60});save();render()},
 delwarm:el=>{dayOf(el).ex.find(x=>x.id===el.dataset.e).warm.splice(+el.dataset.v,1);save();render()},
 savetpl:el=>{const d=dayOf(el),n=prompt('Template name?',d.name);if(n){D.templates.push({name:n.trim(),ex:JSON.parse(JSON.stringify(d.ex))});save();render();toast('Template saved')}},
 loadtpl:el=>{const t=D.templates[+el.dataset.v];D.days.push({id:uid(),name:t.name,ex:t.ex.map(x=>({...JSON.parse(JSON.stringify(x)),id:uid()}))});save();render();toast('Added as a new day')},
 deltpl:el=>{D.templates.splice(+el.dataset.v,1);save();render()},
 export:()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(D,null,2)],{type:'application/json'}));a.download='gym-rest-timer-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},
 import:()=>$('#imp').click(),
 resethist:()=>{if(confirm('Delete ALL workout history? This cannot be undone.')){D.history=[];save();render()}},
 install:async()=>{if(inst){inst.prompt();await inst.userChoice;inst=null;render()}}
};
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(el&&A[el.dataset.a])A[el.dataset.a](el)});
document.addEventListener('input',e=>{const el=e.target;if(!S||!S.cur)return;if(el.id==='iw')S.cur.w=el.value;else if(el.id==='ir')S.cur.r=el.value;else if(el.id==='inote')S.cur.note=el.value;else return;saveS()});
document.addEventListener('change',e=>{
 const el=e.target,f=el.dataset.f;if(!f)return;
 if(f==='set'){const k=el.dataset.k;D.set[k]=el.type==='checkbox'?el.checked:Math.max(0,+el.value||0);if(k==='notify'&&el.checked){if(!window.Notification){toast('Notifications not supported here');D.set.notify=false;render()}else Notification.requestPermission().then(p=>{if(p!=='granted'){D.set.notify=false;toast('Notification permission denied');render()}})}save();return}
 const d=dayOf(el);if(!d)return;
 if(f==='dname'){d.name=el.value.trim()||d.name;save();return}
 const x=d.ex.find(x=>x.id===el.dataset.e);if(!x)return;
 if(el.dataset.w!=null){x.warm[+el.dataset.w][f]=Math.max(0,+el.value||0)}
 else x[f]=(f==='name'||f==='reps')?(el.value.trim()||x[f]):Math.max(f==='sets'?1:0,Math.round(+el.value)||1);
 save();
});
$('#imp').addEventListener('change',async e=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;
 try{const j=JSON.parse(await f.text());if(!Array.isArray(j.days)||!Array.isArray(j.history))throw 0;
  if(!confirm('Replace current plan and history with the imported file?'))return;
  D={...defaults(),...j,set:{...defaults().set,...j.set},templates:j.templates||[]};wd=D.days[0]?.id;save();render();toast('Import complete')}
 catch{toast('That file is not a valid export')}
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();inst=e;if(tab==='settings')render()});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));
if(S&&!S.plan){S.plan=buildPlan(S.ex);S.p=Math.max(0,S.plan.findIndex(x=>x.ei===S.i&&(x.warm?x.n:S.ex[x.ei].warm.length+x.n)===S.k));S.i=S.plan[S.p].ei;saveS()}
if(S){wake();tab='timer'}
render();

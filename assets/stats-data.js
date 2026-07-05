/* ---------- deterministic dummy data (Mockup only) — shared across all stats-*.html pages ---------- */
function seededRandom(seed){let s=seed;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;};}
const rnd=seededRandom(42);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gauss=(mean,sd)=>{let u=0,v=0;while(u===0)u=rnd();while(v===0)v=rnd();return mean+sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};

const BILDUNG_GRUPPEN=['Pflichtschule / Ausbildung','Abitur','Bachelor','Master / Promotion'];
const EINKOMMEN_GRUPPEN=['< 1.000 €','1.000–2.499 €','2.500–4.999 €','5.000 €+'];
const VERMOEGEN_GRUPPEN=['Kein Vermögen','Immobilien oder Vermögen','Beides'];
const STAAT_GRUPPEN=['1 Staatsangehörigkeit','2 oder mehr'];
const ALTER_GRUPPEN=['unter 25','25–34','35–49','50+'];
const AUFGEWACHSEN_GRUPPEN=['Dorf','Mittelstadt','Großstadt'];
const GESCHLECHT_GRUPPEN=['Männlich','Weiblich','Divers / Sonstiges'];

function generateDummyData(n){
  const rows=[];
  for(let i=0;i<n;i++){
    const bildung=Math.floor(rnd()*4);
    const einkommen=Math.floor(rnd()*4);
    const vermoegen=Math.floor(rnd()*3);
    const staat=Math.floor(rnd()*2);
    const alter=Math.floor(rnd()*4);
    const aufgewachsen=Math.floor(rnd()*3);
    const geschlecht=Math.floor(rnd()*3);

    const Z=clamp(gauss(6.4+staat*0.5,1.3),0,10); // Zugehörigkeit: bewusst kaum SES-abhängig, leichter Mehrstaatler-Effekt
    const M=clamp(gauss(2.8+einkommen*1.55+aufgewachsen*0.3,1.1),0,10); // Möglichkeiten: stark einkommensabhängig
    const V=clamp(gauss(3.2+vermoegen*2.0+bildung*0.4,1.1),0,10); // Vernetzung: stark vermögensabhängig
    const Twissen=clamp(gauss(3.0+bildung*1.7,1.2),0,10);
    const Twollen=clamp(gauss(6.2,1.6),0,10); // Teilhabewunsch: kaum bildungsabhängig
    const Tgeschl=clamp(gauss(0,0.8)+(geschlecht===1?-0.6:0),-2,2);
    const T=clamp((Twissen+Twollen)/2+Tgeschl,0,10);

    rows.push({bildung,einkommen,vermoegen,staat,alter,aufgewachsen,geschlecht,Z,M,V,T,Twissen,Twollen});
  }
  return rows;
}
const DATA=generateDummyData(148);

function mean(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;}
function fmt(n){return n.toFixed(1).replace('.',',');}

/* SES-Terzile aus Einkommen + Vermögen */
DATA.forEach(r=>{r.ses=r.einkommen+r.vermoegen*1.3;});
const sesSorted=[...DATA].sort((a,b)=>a.ses-b.ses);
const t1=sesSorted[Math.floor(sesSorted.length/3)].ses, t2=sesSorted[Math.floor(sesSorted.length*2/3)].ses;
DATA.forEach(r=>{r.sesGroup=r.ses<=t1?0:(r.ses<=t2?1:2);});

/* ---------- render helpers ---------- */
function barRow(label,val,cls){
  const pct=clamp(val/10*100,0,100);
  return '<div class="row"><div class="rlabel">'+label+'</div><div class="track"><div class="fill '+cls+'" style="width:'+pct+'%"></div></div><div class="val">'+fmt(val)+'</div></div>';
}
function groupChart(groups,getSub,dimKey,cls){
  let html='';
  groups.forEach((name,i)=>{
    const sub=getSub(i);
    html+=barRow(name,mean(sub.map(r=>r[dimKey])),cls);
  });
  return '<div class="group">'+html+'</div>';
}

/* ---------- key-facts row (Teilnehmende + Gesamt-Index) ---------- */
function renderFacts(elId){
  const facts=[
    {n:DATA.length,l:'Teilnehmende'},
    {n:fmt(mean(DATA.map(r=>(r.Z+r.M+r.V+r.T)/4))),l:'Ø Gesamt-Index'}
  ];
  document.getElementById(elId).innerHTML=facts.map(k=>'<div class="kpi"><div class="n">'+k.n+'</div><div class="l">'+k.l+'</div></div>').join('');
}

/* ---------- dimension breakdown row (Z/M/V/T averages) ---------- */
function renderDims(elId){
  const dims=[
    {n:fmt(mean(DATA.map(r=>r.Z))),l:'Zugehörigkeit'},
    {n:fmt(mean(DATA.map(r=>r.M))),l:'Möglichkeiten'},
    {n:fmt(mean(DATA.map(r=>r.V))),l:'Vernetzung'},
    {n:fmt(mean(DATA.map(r=>r.T))),l:'Teilhabe'}
  ];
  document.getElementById(elId).innerHTML=dims.map(k=>'<div class="kpi"><div class="n">'+k.n+'</div><div class="l">'+k.l+'</div></div>').join('');
}

/* ---------- profile-type distribution, filterable by SES (used on the landing page) ---------- */
const TYPEN=['Europa-Stern','Kennzeichen','Europahymne','Der Euro','EC-Zug','Europalette','Eurostecker','Europa-Park','Euro-Trance','EU-Bio-Siegel','Euroloch','Euro-Kiste'];
const TYPE_BASE=TYPEN.map(()=>Math.floor(rnd()*20)+2);

function initTypeGrid(gridId,toggleId){
  let typeFilter='alle';
  function render(){
    let counts;
    if(typeFilter==='alle')counts=TYPE_BASE;
    else if(typeFilter==='niedrig')counts=TYPE_BASE.map((c,i)=>Math.max(1,Math.round(c*(i<6?1.3:0.6))));
    else counts=TYPE_BASE.map((c,i)=>Math.max(1,Math.round(c*(i<6?0.6:1.3))));
    const max=Math.max(...counts);
    document.getElementById(gridId).innerHTML=TYPEN.map((t,i)=>
      '<div class="typecard"><div class="tn">'+t+'</div><div class="tv">'+counts[i]+'</div><div class="tbar"><i style="width:'+(counts[i]/max*100)+'%"></i></div></div>').join('');
  }
  document.getElementById(toggleId).innerHTML=
    '<button data-f="alle" class="on">Alle</button><button data-f="niedrig">Geringerer Wohlstand</button><button data-f="hoch">Höherer Wohlstand</button>';
  document.getElementById(toggleId).addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    typeFilter=b.dataset.f;
    document.querySelectorAll('#'+toggleId+' button').forEach(x=>x.classList.toggle('on',x===b));
    render();
  });
  render();
}

/* ---------- the 10 individual questions — each has its own q-*.html detail page ---------- */
const QUESTIONS=[
  {href:'q-ses.html',cat:'Hauptfrage',title:'Kann sich jede*r Europa leisten?'},
  {href:'q-staatsangehoerigkeit.html',cat:'Zugehörigkeit',title:'Fühlen sich Menschen mit mehreren Staatsangehörigkeiten europäischer als Menschen mit nur einer?'},
  {href:'q-alter-zugehoerigkeit.html',cat:'Zugehörigkeit',title:'Fühlen sich jüngere oder ältere Menschen stärker europäisch zugehörig?'},
  {href:'q-einkommen.html',cat:'Möglichkeiten',title:'Können sich Menschen mit höherem Einkommen mehr von Europa leisten, zum Beispiel Reisen?'},
  {href:'q-aufgewachsen.html',cat:'Möglichkeiten',title:'Haben Menschen, die in der Stadt aufgewachsen sind, mehr europäische Möglichkeiten als Menschen vom Land?'},
  {href:'q-vermoegen.html',cat:'Vernetzung',title:'Sorgt Vermögen aus der Familie für mehr internationale Kontakte, auch ohne eigenes Einkommen?'},
  {href:'q-bildung-vernetzung.html',cat:'Vernetzung',title:'Sprechen höher gebildete Menschen mehr europäische Sprachen und haben mehr internationale Kontakte?'},
  {href:'q-bildung-teilhabe.html',cat:'Teilhabe',title:'Wissen höher gebildete Menschen mehr über die EU, und wollen sie deshalb auch mehr mitbestimmen?'},
  {href:'q-geschlecht.html',cat:'Teilhabe',title:'Unterscheidet sich der Wunsch nach politischer Mitbestimmung je nach Geschlecht?'},
  {href:'q-profiltypen.html',cat:'Profiltypen',title:'Welcher von 12 möglichen Europa-Typen kommt am häufigsten vor?'}
];

/* plain numbered list of all questions, linking to their detail pages */
function renderQuestionList(elId){
  document.getElementById(elId).innerHTML=QUESTIONS.map((q,idx)=>
    '<a href="'+q.href+'"><span class="qi-no">'+String(idx+1).padStart(2,'0')+'</span><span class="qi-title">'+q.title+'</span></a>'
  ).join('');
}

/* ---------- stub for later: real data ---------- */
// async function fetchLiveData(){
//   const SHEETS_URL = 'https://script.google.com/macros/s/…/exec?mode=stats';
//   const res = await fetch(SHEETS_URL);
//   return await res.json(); // erwartet: [{teilnehmernummer, aufgaben:{...}, grunddaten:{...}}, ...]
// }

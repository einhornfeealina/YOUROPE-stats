/* ---------- live data source ---------- */
/* Dieselbe Web-App-Adresse wie SHEETS_URL in index.html, ?action=stats ruft den neuen doGet-Zweig auf. */
const SHEETS_URL='https://script.google.com/macros/s/AKfycbyHAYgII0yP0igRNgflyHGbdNR0J1EE67iiHLzNRk5LFL87iOOwwUqvqqvTvl6FUzqy/exec';
const USE_LIVE_DATA=true; // auf false setzen, um immer mit Beispieldaten zu arbeiten

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function mean(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;}
function fmt(n){return n.toFixed(1).replace('.',',');}
/* Streuung (Stichproben-Standardabweichung) — zeigt, wie weit die Werte einer Gruppe auseinanderliegen.
   Ab 2 Werten berechenbar; bei weniger gibt's keine sinnvolle Streuung. */
function std(arr){
  if(arr.length<2)return 0;
  const m=mean(arr);
  const variance=arr.reduce((a,b)=>a+(b-m)*(b-m),0)/(arr.length-1);
  return Math.sqrt(variance);
}

/* ---------- Gruppen-Beschriftungen für die Charts ---------- */
const BILDUNG_GRUPPEN=['Pflichtschule / Ausbildung','Abitur','Bachelor','Master / Promotion'];
const EINKOMMEN_GRUPPEN=['< 1.000 €','1.000–2.499 €','2.500–4.999 €','5.000 €+'];
const VERMOEGEN_GRUPPEN=['Kein Vermögen','Immobilien oder Vermögen','Beides'];
const STAAT_GRUPPEN=['1 Staatsangehörigkeit','2 oder mehr'];
const ALTER_GRUPPEN=['unter 25','25–34','35–49','50+'];
const AUFGEWACHSEN_GRUPPEN=['Dorf','Kleinstadt','Mittelstadt','Großstadt'];
const GESCHLECHT_GRUPPEN=['Männlich','Weiblich','Divers','Sonstiges'];

/* ---------- deterministic dummy data — Fallback, falls die Live-Daten nicht erreichbar sind ---------- */
function seededRandom(seed){let s=seed;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;};}
const rnd=seededRandom(42);
const gauss=(mean,sd)=>{let u=0,v=0;while(u===0)u=rnd();while(v===0)v=rnd();return mean+sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};

function generateDummyData(n){
  const rows=[];
  for(let i=0;i<n;i++){
    const bildung=Math.floor(rnd()*4);
    const einkommen=Math.floor(rnd()*4);
    const vermoegen=Math.floor(rnd()*3);
    const staat=Math.floor(rnd()*2);
    const alter=Math.floor(rnd()*4);
    const aufgewachsen=Math.floor(rnd()*4);
    const geschlecht=Math.floor(rnd()*4);

    const Z=clamp(gauss(6.4+staat*0.5,1.3),0,10);
    const M=clamp(gauss(2.8+einkommen*1.55+aufgewachsen*0.3,1.1),0,10);
    const V=clamp(gauss(3.2+vermoegen*2.0+bildung*0.4,1.1),0,10);
    const Twissen=clamp(gauss(3.0+bildung*1.7,1.2),0,10);
    const Twollen=clamp(gauss(6.2,1.6),0,10);
    const Tgeschl=clamp(gauss(0,0.8)+(geschlecht===1?-0.6:0),-2,2);
    const T=clamp((Twissen+Twollen)/2+Tgeschl,0,10);
    const Tdarf=clamp(gauss(5.5+staat*1.5,1.8),0,10);
    const Tgrundgesetz=clamp(gauss(8-((bildung+einkommen)/2)*1.5,1.8),0,10);

    rows.push({bildung,einkommen,vermoegen,staat,alter,aufgewachsen,geschlecht,Z,M,V,T,Twissen,Twollen,Tdarf,Tgrundgesetz});
  }
  return rows;
}

/* ---------- Punktrechnung — angelehnt an taskScore()/results() in index.html ----------
   Unterschied zu index.html: eine leere/fehlende Antwort ergibt hier `null` statt 0 und wird
   aus dem Dimensions-Schnitt herausgenommen (meanSkipNull), statt die Dimension künstlich zu
   drücken. Das betrifft z. B. Aufgabe M02, die bei manchen Teilnehmenden nicht ausgefüllt wurde. */
function scoreNum(raw,max,invert){
  if(raw===''||raw===undefined||raw===null||isNaN(Number(raw)))return null;
  const v=Math.max(0,Math.min(Number(raw),max));
  return (invert?(max-v):v)/max*10;
}
function scoreCoordX(xVal,labels){
  if(xVal===''||xVal===undefined||xVal===null)return null;
  const idx=labels.indexOf(xVal);
  if(idx<0)return null;
  const v=labels.length-idx;
  return v/labels.length*10;
}
function scoreCoordSum(xVal,yVal,maxX,maxY){
  if(xVal===''||xVal===undefined||xVal===null||yVal===''||yVal===undefined||yVal===null)return null;
  const x=Math.max(0,Math.min(Number(xVal),maxX));
  const y=Math.max(0,Math.min(Number(yVal),maxY));
  return (x+y)/(maxX+maxY)*10;
}
function meanSkipNull(arr){
  const v=arr.filter(x=>x!==null&&x!==undefined&&!isNaN(x));
  return v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
}
function computeParticipantScores(row){
  const Z=meanSkipNull([scoreNum(row.Z01,12,false),scoreNum(row.Z02,12,false),scoreNum(row.Z03,7,true)]);
  const M01=scoreNum(row.M01,7,false);
  const M02=(row.M02_score!==undefined&&row.M02_score!=='')?Number(row.M02_score):null;
  const M03=scoreNum(row.M03,28,false);
  const M=meanSkipNull([M01,M02,M03]);
  const V=meanSkipNull([scoreNum(row.V01,90,true),scoreCoordX(row.V02_x,['A','B','C','D','E','F','G','H']),scoreNum(row.V03,24,false)]);
  const T01=scoreNum(row.T01,27,false);
  const T02=scoreNum(row.T02,50,true);
  const T03=scoreCoordSum(row.T03_x,row.T03_y,5,5);
  const T=meanSkipNull([T01,T02,T03]);
  const Twissen=meanSkipNull([T01,T02]);
  const Twollen=(row.T03_y!==undefined&&row.T03_y!=='')?clamp(Number(row.T03_y),0,5)/5*10:0;
  const Tdarf=(row.T03_x!==undefined&&row.T03_x!=='')?clamp(Number(row.T03_x),0,5)/5*10:null;
  const Tgrundgesetz=T02;
  return {Z,M,V,T,Twissen,Twollen,Tdarf,Tgrundgesetz};
}

/* ---------- Grunddaten-Antworten → Gruppen-Index (muss zu QUESTIONS in index.html passen) ---------- */
function mapBildung(v){
  const m={'Kein Abschluss':0,'Hauptschulabschluss':0,'Mittlere Reife / Realschulabschluss':0,'Berufsausbildung / Lehre':0,'Meister / Techniker / Fachwirt':0,
    'Fachabitur / Fachhochschulreife':1,'Abitur':1,'Bachelor':2,
    'Master / Diplom / Magister / Staatsexamen':3,'Promotion / Doktor':3};
  return m.hasOwnProperty(v)?m[v]:null;
}
function mapEinkommen(v){
  const m={'0 € / kein Einkommen':0,'1–499 €':0,'500–999 €':0,
    '1.000–1.499 €':1,'1.500–1.999 €':1,'2.000–2.499 €':1,
    '2.500–2.999 €':2,'3.000–3.999 €':2,'4.000–4.999 €':2,
    '5.000 € oder mehr':3};
  return m.hasOwnProperty(v)?m[v]:null;
}
function mapVermoegen(v){
  const m={'Nein':0,'Ja, Immobilien':1,'Ja, anderes Vermögen (Aktien, etc.)':1,'Ja, beides':2};
  return m.hasOwnProperty(v)?m[v]:null;
}
function mapAlter(v){
  const m={'unter 18':0,'18–24':0,'25–29':1,'30–34':1,'35–39':2,'40–49':2,'50+':3};
  return m.hasOwnProperty(v)?m[v]:null;
}
function mapAufgewachsen(v){
  const m={'Dorf (unter 5.000)':0,'Kleinstadt (5.000–20.000)':1,'Mittelstadt (20.000–100.000)':2,'Großstadt (über 100.000)':3};
  return m.hasOwnProperty(v)?m[v]:null;
}
function mapGeschlecht(v){
  const m={'Männlich':0,'Weiblich':1,'Divers':2,'Sonstiges / eigene Bezeichnung':3};
  return m.hasOwnProperty(v)?m[v]:null;
}
function mapStaat(v){
  const n=(v||'').toString().split(',').map(s=>s.trim()).filter(Boolean).length;
  return n<=1?0:1;
}

/* ---------- Live-Daten laden + mit Grunddaten verknüpfen ---------- */
async function loadRealData(){
  const res=await fetch(SHEETS_URL+'?action=stats',{cache:'no-store'});
  if(!res.ok)throw new Error('HTTP '+res.status);
  const json=await res.json();
  const aufgaben=json.aufgaben||[];
  const grunddaten=json.grunddaten||[];
  const gByNr={};
  grunddaten.forEach(g=>{gByNr[g.teilnehmernummer]=g;});
  const rows=[];
  aufgaben.forEach(a=>{
    const g=gByNr[a.teilnehmernummer];
    if(!g)return; // nur Teilnehmende mit beiden Teilen zählen
    const scores=computeParticipantScores(a);
    rows.push(Object.assign({
      bildung:mapBildung(g.bildung),
      einkommen:mapEinkommen(g.einkommen),
      vermoegen:mapVermoegen(g.eigentum_familie),
      alter:mapAlter(g.alter),
      aufgewachsen:mapAufgewachsen(g.aufgewachsen),
      geschlecht:mapGeschlecht(g.geschlecht),
      staat:mapStaat(g.staatsangehoerigkeit)
    },scores));
  });
  return rows;
}

/* ---------- Einstiegspunkt: von jeder Seite per initData().then(...) aufgerufen ---------- */
let DATA=[];
async function initData(){
  let rows=null;
  if(USE_LIVE_DATA){
    try{
      rows=await loadRealData();
      if(!rows||rows.length===0)rows=null;
    }catch(err){
      console.warn('Live-Daten konnten nicht geladen werden, zeige Beispieldaten:',err);
    }
  }
  DATA=rows||generateDummyData(148);
  DATA.forEach(r=>{r.ses=(r.einkommen||0)+(r.vermoegen||0)*1.3;});
  const sesSorted=[...DATA].sort((a,b)=>a.ses-b.ses);
  const t1=sesSorted[Math.floor(sesSorted.length/3)].ses, t2=sesSorted[Math.floor(sesSorted.length*2/3)].ses;
  DATA.forEach(r=>{r.sesGroup=r.ses<=t1?0:(r.ses<=t2?1:2);});
  return DATA;
}

/* ---------- render helpers ----------
   n  = wie viele Personen in dieser Gruppe stecken. Wird immer mit angezeigt, weil ein
        Balken aus z. B. nur einer Person sonst wie ein verlässlicher Durchschnitt aussieht,
        obwohl er das bei so kleinen Gruppen nicht ist.
   sd = Streuung (Standardabweichung) innerhalb der Gruppe. Wird als kleine Klammer
        [Ø−sd … Ø+sd] über dem Balken eingezeichnet, damit man sieht, wie weit die
        einzelnen Antworten tatsächlich auseinanderliegen — ein Durchschnitt allein
        verschweigt das. Ab 2 Werten sinnvoll, sonst kein Klammer-Overlay. */
function barRow(label,val,cls,n,sd){
  const hasN=n!==undefined&&n!==null;
  const lowN=hasN&&n>0&&n<3;
  const noData=hasN&&n===0;
  const pct=noData?0:clamp(val/10*100,0,100);
  const nSuffix=hasN?'<span class="rn">n='+n+'</span>':'';
  const valOut=noData?'–':fmt(val);
  let errbar='';
  if(!noData&&sd&&sd>0&&n>=2){
    const lo=clamp(val-sd,0,10),hi=clamp(val+sd,0,10);
    if(hi>lo)errbar='<div class="errbar" style="left:'+(lo/10*100)+'%;width:'+((hi-lo)/10*100)+'%"></div>';
  }
  return '<div class="row'+(lowN?' low-n':'')+'"><div class="rlabel">'+label+nSuffix+'</div><div class="track"><div class="fill '+cls+'" style="width:'+pct+'%"></div>'+errbar+'</div><div class="val">'+valOut+'</div></div>';
}
function groupChart(groups,getSub,dimKey,cls){
  let html='';
  groups.forEach((name,i)=>{
    const vals=getSub(i).map(r=>r[dimKey]).filter(v=>v!==null&&v!==undefined&&!isNaN(v));
    html+=barRow(name,mean(vals),cls,vals.length,std(vals));
  });
  return '<div class="group">'+html+'</div>';
}

/* ---------- Filter-Panel: Checkboxen statt Umschalt-Buttons ----------
   Mehrere Facetten (z. B. Geschlecht, Aufgewachsen) lassen sich gleichzeitig
   und unabhängig voneinander anhaken. Innerhalb einer Facette gilt ODER
   (nichts angehakt = alle durchgelassen), zwischen Facetten gilt UND. */
const FACET_GESCHLECHT={key:'geschlecht',label:'Geschlecht',options:[{v:0,l:'Männlich'},{v:1,l:'Weiblich'},{v:2,l:'Divers'},{v:3,l:'Sonstiges'}]};
const FACET_AUFGEWACHSEN={key:'aufgewachsen',label:'Aufgewachsen',options:[{v:0,l:'Dorf'},{v:1,l:'Kleinstadt'},{v:2,l:'Mittelstadt'},{v:3,l:'Großstadt'}]};
const FACET_WOHLSTAND={key:'sesGroup',label:'Wohlstand',options:[{v:0,l:'Geringer'},{v:1,l:'Mittlerer'},{v:2,l:'Höherer'}]};
const FACET_BILDUNG={key:'bildung',label:'Bildung',options:[{v:0,l:'Pflicht/Ausbildung'},{v:1,l:'Abitur'},{v:2,l:'Bachelor'},{v:3,l:'Master/Promotion'}]};
const FACET_EINKOMMEN={key:'einkommen',label:'Einkommen',options:[{v:0,l:'< 1.000 €'},{v:1,l:'1.000–2.499 €'},{v:2,l:'2.500–4.999 €'},{v:3,l:'5.000 €+'}]};
const FACET_VERMOEGEN={key:'vermoegen',label:'Vermögen (Familie)',options:[{v:0,l:'Kein Vermögen'},{v:1,l:'Immobilien/Vermögen'},{v:2,l:'Beides'}]};
const FACET_ALTER={key:'alter',label:'Alter',options:[{v:0,l:'unter 25'},{v:1,l:'25–34'},{v:2,l:'35–49'},{v:3,l:'50+'}]};
const FACET_STAAT={key:'staat',label:'Staatsangehörigkeit',options:[{v:0,l:'1 Staat'},{v:1,l:'2 oder mehr'}]};

function renderFilterPanelHTML(facets){
  if(!facets||!facets.length)return '';
  return '<details class="filterpanel"><summary>Filter</summary><div class="filter-body">'+
    facets.map(f=>
      '<div class="filtergroup"><span class="fl">'+f.label+'</span>'+
      f.options.map(o=>'<label class="fchk"><input type="checkbox" data-k="'+f.key+'" data-v="'+o.v+'"> '+o.l+'</label>').join('')+
      '</div>'
    ).join('')+
    '</div></details>';
}
function wireFilterPanel(panelId,state,onChange){
  document.getElementById(panelId).addEventListener('change',e=>{
    const cb=e.target;
    if(cb.tagName!=='INPUT')return;
    const k=cb.dataset.k, v=Number(cb.dataset.v);
    if(cb.checked)state[k].add(v);else state[k].delete(v);
    onChange();
  });
}
function facetPasses(state,facets,r){
  return facets.every(f=>{
    const sel=state[f.key];
    return sel.size===0||sel.has(r[f.key]);
  });
}

/* ---------- Filter-Panel über einem Gruppen-Chart ----------
   getSubBase(i) liefert wie gewohnt die Grunddaten je Gruppen-Index,
   ungefiltert; die hier angehakten Facetten schränken sie zusätzlich ein. */
function initGroupFilter(panelId,chartId,groups,getSubBase,dimKey,cls,facets){
  const state={};
  facets.forEach(f=>state[f.key]=new Set());
  function render(){
    document.getElementById(chartId).innerHTML=groupChart(groups,i=>getSubBase(i).filter(r=>facetPasses(state,facets,r)),dimKey,cls);
  }
  document.getElementById(panelId).innerHTML=renderFilterPanelHTML(facets);
  wireFilterPanel(panelId,state,render);
  render();
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

/* ---------- Profiltypen — Top-2-Dimensionen je Teilnehmer*in, wie getTypus() in index.html ---------- */
const TYPEN=['Europa-Stern','Kennzeichen','Europahymne','Der Euro','EC-Zug','Europalette','Eurostecker','Europa-Park','Euro-Trance','EU-Bio-Siegel','Euroloch','Euro-Kiste'];
const TYPEN_KEYS=['ZM','ZV','ZT','MZ','MV','MT','VM','VZ','VT','TM','TZ','TV'];
function typeKeyFor(r){
  const dims=[{k:'Z',v:r.Z},{k:'M',v:r.M},{k:'V',v:r.V},{k:'T',v:r.T}];
  const sorted=dims.map((d,i)=>Object.assign({},d,{i})).sort((a,b)=>(b.v-a.v)||(a.i-b.i));
  return sorted[0].k+sorted[1].k;
}
function initTypeGrid(gridId,panelId){
  const facets=[FACET_WOHLSTAND,FACET_GESCHLECHT,FACET_AUFGEWACHSEN,FACET_BILDUNG];
  const state={};
  facets.forEach(f=>state[f.key]=new Set());
  function countsFor(filterFn){
    const c={};TYPEN_KEYS.forEach(k=>c[k]=0);
    DATA.filter(filterFn).forEach(r=>{const k=typeKeyFor(r);c[k]=(c[k]||0)+1;});
    return TYPEN_KEYS.map(k=>c[k]);
  }
  function render(){
    const counts=countsFor(r=>facetPasses(state,facets,r));
    const max=Math.max(...counts,1);
    document.getElementById(gridId).innerHTML=TYPEN.map((t,i)=>
      '<div class="typecard"><div class="tn">'+t+'</div><div class="tv">'+counts[i]+'</div><div class="tbar"><i style="width:'+(counts[i]/max*100)+'%"></i></div></div>').join('');
  }
  document.getElementById(panelId).innerHTML=renderFilterPanelHTML(facets);
  wireFilterPanel(panelId,state,render);
  render();
}

/* ---------- die 10 einzelnen Fragen — jede hat ihre eigene q-*.html-Detailseite ---------- */
const QUESTIONS=[
  {href:'q-ses.html',cat:'Hauptfrage',title:'Kann sich jede*r Europa leisten?'},
  {href:'q-staat-wahlrecht.html',cat:'Teilhabe',title:'Fühlen sich Menschen mit mehreren Staatsangehörigkeiten auch politisch stärker berechtigt?'},
  {href:'q-einkommen-ressource.html',cat:'Teilhabe',title:'Fühlen sich Menschen mit höherem Einkommen sicherer, dass ihre Grundrechte bereits gelten?'},
  {href:'q-staatsangehoerigkeit.html',cat:'Zugehörigkeit',title:'Fühlen sich Menschen mit mehreren Staatsangehörigkeiten europäischer als Menschen mit nur einer?'},
  {href:'q-alter-zugehoerigkeit.html',cat:'Zugehörigkeit',title:'Fühlen sich jüngere oder ältere Menschen stärker europäisch zugehörig?'},
  {href:'q-einkommen.html',cat:'Möglichkeiten',title:'Leisten sich Menschen mit höherem Einkommen mehr von Europa?'},
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

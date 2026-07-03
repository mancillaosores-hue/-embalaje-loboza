/**
 * ui.js
 * ─────────────────────────────────────────────────────────────
 * Componentes de interfaz: toast notifications, bottom nav,
 * navegación entre pantallas (setScreen/bnavGo), ripple effect,
 * Cyber Day banner, grid responsive (_gridCols).
 *
 * Dependencias : config.js, helpers.js
 * Exporta (global): toast, setScreen, bnavGo, hookBottomNav,
 *   addRipple, esCyberDay, actualizarCyber, _gridCols
 * ─────────────────────────────────────────────────────────────
 */

// ============================================================
// UTILS
// ============================================================
function toast(m,d=2400){
  const t=document.getElementById('toast');
  t.textContent=m;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),d);
}
function setScreen(id){
  document.querySelectorAll('.sc').forEach(s=>s.classList.remove('on'));
  document.getElementById('sc-'+id).classList.add('on');
}
function fmtN(n){return Math.round(n).toLocaleString('es-CL')}
function _gridCols(mobileCols, desktopMult){
  // En pantallas anchas (PC), escala las columnas proporcionalmente
  if(window.innerWidth >= 900){
    return mobileCols.split(' ').map(c=>{
      const m = c.match(/^(\d+)px$/);
      if(!m) return c;
      return Math.round(parseInt(m[1])*(desktopMult||1.3))+'px';
    }).join(' ');
  }
  return mobileCols;
}
function fmtFecha(f){
  if(!f)return'—';
  const [y,mo,d]=f.split('-');
  const ms=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return d+' '+ms[+mo-1]+' '+y;
}
function today(){ return fechaLocalStr(new Date()) }
function fechaLocalStr(d){
  // Retorna YYYY-MM-DD de un objeto Date en hora local (evita desfase UTC)
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function currentWeek(){
  const n=new Date(),y=n.getFullYear();
  const s=new Date(y,0,4),day=s.getDay()||7;
  s.setDate(s.getDate()-day+1);
  const w=Math.ceil(((n-s)/86400000+1)/7);
  return y+'-W'+(w<10?'0':'')+w;
}
function currentMonth(){
  const n=new Date();
  return n.getFullYear()+'-'+(n.getMonth()<9?'0':'')+(n.getMonth()+1);
}
function weekRange(ws){
  const [y,w]=ws.split('-W');
  const jan4=new Date(+y,0,4),day=jan4.getDay()||7;
  const start=new Date(jan4);
  start.setDate(jan4.getDate()-day+1+(+w-1)*7);
  const end=new Date(start);end.setDate(start.getDate()+6);
  return[start.toISOString().slice(0,10),end.toISOString().slice(0,10)];
}
function monthRange(ms){
  const [y,m]=ms.split('-');
  const last=new Date(+y,+m,0).getDate();
  return[ms+'-01',ms+'-'+last];
}
function groupByTipo(rows){
  const g={maleta:0,linea:0,insumo:0,otro:0,total:0,totalConInsumo:0};
  rows.forEach(r=>{
    const t=r.tipo||'otro';
    if(t in g) g[t]+=r.cantidad; else g.otro+=r.cantidad;
    g.totalConInsumo+=r.cantidad;
    if(t!=='insumo') g.total+=r.cantidad;
  });
  return g;
}
function groupByFecha(rows){
  const g={};
  rows.forEach(r=>{
    if(!g[r.fecha])g[r.fecha]={maleta:0,linea:0,insumo:0,otro:0,total:0,totalConInsumo:0};
    const t=r.tipo||'otro';
    if(t in g[r.fecha]) g[r.fecha][t]+=r.cantidad; else g[r.fecha].otro+=r.cantidad;
    g[r.fecha].totalConInsumo+=r.cantidad;
    if(t!=='insumo') g[r.fecha].total+=r.cantidad;
  });
  return g;
}
function nombreCorto(n){
  const p=n.trim().split(/\s+/);
  return p.length>=2?p[0]+' '+p[p.length-1]:n;
}




// ── Bottom Nav ──
const BNAV_TITULOS={
  carga:'Carga de datos',
  equipo:'Ranking del día',
  semana:'Vista semanal',
  mes:'Vista mensual',
  plan:'Plan semanal',
};

function bnavGo(tab, btn){
  // Ripple
  addRipple(btn);
  // Actualizar íconos activos
  document.querySelectorAll('.bnav-item').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  // Subtítulo header
  const tituloEl=document.getElementById('sup-tab-titulo');
  if(tituloEl) tituloEl.textContent=BNAV_TITULOS[tab]||'';
  // Llamar showSupTab con un btn dummy para no romper la lógica existente
  showSupTab(tab, {classList:{add:()=>{},remove:()=>{}}});
  // Animar el contenido activo
  setTimeout(()=>{
    const tabs=['carga','equipo','mes','alertas','plan'];
    tabs.forEach(t=>{
      const el=document.getElementById('st-'+t);
      if(el && el.style.display!=='none') el.classList.add('anim-in');
    });
    const sw=document.getElementById('st-semana-wrapper');
    if(sw && sw.style.display!=='none') sw.classList.add('anim-in');
  },10);
}

function addRipple(btn){
  const r=document.createElement('span');
  r.className='ripple';
  const size=Math.max(btn.offsetWidth,btn.offsetHeight);
  r.style.cssText=`width:${size}px;height:${size}px;left:${btn.offsetWidth/2-size/2}px;top:${btn.offsetHeight/2-size/2}px`;
  btn.appendChild(r);
  setTimeout(()=>r.remove(),450);
}

// Mostrar/ocultar bottom nav con la pantalla del supervisor
const _origDoLogin=window.doLogin;
function hookBottomNav(){
  const scSup=document.getElementById('sc-sup');
  const nav=document.getElementById('bottom-nav-sup');
  if(!scSup||!nav) return;
  const obs=new MutationObserver(()=>{
    const visible=scSup.style.display!=='none';
    nav.classList.toggle('hidden',!visible);
  });
  obs.observe(scSup,{attributes:true,attributeFilter:['style']});
  // Check inicial
  if(scSup.style.display!=='none') nav.classList.remove('hidden');
}
document.addEventListener('DOMContentLoaded', hookBottomNav);
setTimeout(hookBottomNav, 500);

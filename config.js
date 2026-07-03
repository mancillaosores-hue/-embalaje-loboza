/**
 * helpers.js
 * ─────────────────────────────────────────────────────────────
 * Funciones utilitarias puras: formateo de fechas y números,
 * cálculos de semanas ISO, agrupaciones de datos, clasificación
 * de tipo de producto y cálculo de capacidad de equipo.
 * No tiene efectos secundarios ni accede al DOM.
 *
 * Dependencias : config.js
 * Exporta (global): fmtN, fmtFecha, fmtFechaCL, fmtMes, today,
 *   fechaLocalStr, currentWeek, currentMonth, weekRange,
 *   monthRange, groupByTipo, groupByFecha, normFecha,
 *   getISOWeek, getMondayOfISOWeek, isoWeekActual,
 *   isoSemanaAFechas, normalizarRow, filtrarUsuariosValidos,
 *   classifyTipo, semColor, nombreCorto, iniciales, primerNombre,
 *   calcularCapacidadEquipo
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



// ============================================================
// CLASSIFY PRODUCT
// ============================================================
function classifyTipo(tipoRaw, desc){
  // Usar Tipo_Producto si existe
  if(tipoRaw){
    const t=tipoRaw.toString().trim().toLowerCase();
    if(t==='maleta') return 'maleta';
    if(t==='no maleta') return 'linea';
    if(t==='insumo') return 'insumo';
  }
  // Fallback por descripción
  if(!desc) return 'otro';
  const d=desc.toString().toUpperCase();
  if(/SPINNER|TROLLEY|CARRY.?ON|SUITCASE|UPRIGHT|HARDSIDE/.test(d)) return 'maleta';
  if(/BACKPACK|BAG|CLUTCH|TOTE|SHOULDER|CROSS|LAPTOP|BRIEFCASE|DUFFLE|WALLET|PURSE|HANDBAG/.test(d)) return 'linea';
  return 'otro';
}



// ============================================================
// CAPACIDAD EQUIPO — cálculo dinámico basado en META
// ============================================================
// Retorna la suma de META solo para operarias activas con producción ese día
function calcularCapacidadEquipo(usuariosActivos){
  if(!usuariosActivos||!usuariosActivos.length) return 0;
  return usuariosActivos.reduce((sum, uid)=>sum+(META[uid]||0), 0);
}

// Retorna el color del semáforo según % cumplimiento

// Calcula KPIs gerenciales a partir de rawData de un día
function calcularKpisGerenciales(rowsDia){
  const usuariosActivos=[...new Set(rowsDia.map(r=>r.usuario).filter(u=>DB[u]))];
  const produccionTotal=rowsDia.filter(r=>r.canal!=='Anulada'&&r.tipo!=='insumo').reduce((s,r)=>s+r.cantidad,0);
  const capacidadTotal=calcularCapacidadEquipo(usuariosActivos);
  const dotacion=usuariosActivos.length;
  const cumplimiento=capacidadTotal>0?Math.round((produccionTotal/capacidadTotal)*100):0;
  const brecha=produccionTotal-capacidadTotal;
  return {usuariosActivos,produccionTotal,capacidadTotal,dotacion,cumplimiento,brecha};
}

const TIPO_COLORS = {maleta:'#378ADD', linea:'#639922', insumo:'#7F77DD', otro:'#BA7517'};
const TIPO_NAMES  = {maleta:'Maleta', linea:'No maleta', insumo:'Insumo', otro:'Otro'};

let cUser = null, cIsSup = false, cIsGer = false;
let eqCache = [];
// clearCaches — resetea todos los caches antes de cada consulta nueva
function clearCaches(){ eqCache=[]; supSemCache=[]; supMesCache=[]; mesMiCache=null; }

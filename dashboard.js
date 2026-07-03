/**
 * gerente.js
 * ─────────────────────────────────────────────────────────────
 * Dashboard gerencial: KPIs ejecutivos, tendencias semanales,
 * navegación de semana, vista de plan resumida y detalle de
 * arrastre pendiente (modal con doble clic).
 *
 * Dependencias : config.js, supabase.js, helpers.js, ui.js,
 *   plan.js
 * Exporta (global): loadGerente, cargarTendenciasGerente,
 *   navegarGerSemana, showGerTab, calcularKpisGerenciales,
 *   abrirPlanDesdeGerente, abrirDetalleArrastre,
 *   cerrarDetalleArrastre
 * ─────────────────────────────────────────────────────────────
 */

// ══════════════════════════════════════════════════════════════
async function loadGerente(){
  const el = document.getElementById('ger-content');
  if(!el) return;
  el.innerHTML = '<div class="loading"><span class="spinner"></span>Cargando datos...</div>';
  try {
    // Semana seleccionada (o actual por defecto)
    if(!gerSemActual) gerSemActual = isoWeekActual();
    const semNum  = gerSemActual;
    const anio    = new Date().getFullYear();
    const {lun, vie} = isoSemanaAFechas(anio, semNum);
    function fechaStr(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
    const fLun   = fechaStr(lun);
    const fDom   = fechaStr(vie);
    const esActual = semNum === isoWeekActual();

    // Actualizar header selector
    const tituloEl = document.getElementById('ger-sem-titulo');
    const rangoEl  = document.getElementById('ger-sem-rango');
    const btnNext  = document.getElementById('ger-btn-next');
    if(tituloEl) tituloEl.textContent = `Semana ${semNum}${esActual?' (actual)':''}`;
    if(rangoEl)  rangoEl.textContent  = `${fmtFecha(fLun)} al ${fmtFecha(fDom)} (L-D)`;
    if(btnNext)  btnNext.disabled = semNum >= isoWeekActual();

    // ── Función lineChart SVG ──
    function lineChart(points, color, h, w){
      if(points.every(p=>p===0)) return '<text x="'+(w/2)+'" y="'+(h/2)+'" fill="rgba(255,255,255,.2)" text-anchor="middle" font-size="10">Sin datos</text>';
      const max = Math.max(...points, 1);
      const step = w / Math.max(points.length - 1, 1);
      const pts = points.map((v,i) => (i*step)+','+(h - (v/max)*(h-4))).join(' ');
      const area = pts+' '+((points.length-1)*step)+','+h+' 0,'+h;
      const gid  = 'lg'+color.replace('#','');
      return '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1">'
        +'<stop offset="0%" stop-color="'+color+'" stop-opacity=".35"/>'
        +'<stop offset="100%" stop-color="'+color+'" stop-opacity="0"/>'
        +'</linearGradient></defs>'
        +'<polygon points="'+area+'" fill="url(#'+gid+')" />'
        +'<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        +points.map((v,i)=>'<circle cx="'+(i*step)+'" cy="'+(h-(v/max)*(h-4))+'" r="3" fill="'+color+'" stroke="var(--card)" stroke-width="1.5"/>').join('');
    }

    // Mostrar solo el placeholder — tendencias cargan después
    el.innerHTML =
      '<div id="ger-tendencias" style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-top:8px">'
      +'<div style="font-size:10px;font-weight:800;color:var(--txt3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">&#128200; Tendencias &middot; &#218;ltimas 6 semanas</div>'
      +'<div style="display:flex;align-items:center;gap:8px;color:var(--txt3);font-size:11px">'
      +'<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> Cargando...</div></div>';

    // Cargar tendencias en segundo plano
    setTimeout(() => cargarTendenciasGerente(semNum, anio, lineChart), 80);

  } catch(e) {
    el.innerHTML = '<div class="empty" style="color:#EF4444;padding:20px;text-align:center">Error al cargar datos:<br><b>'+e.message+'</b></div>';
    console.error('loadGerente error:', e);
  }
}

async function cargarTendenciasGerente(semHoy, anio, lineChart){
  const el = document.getElementById('ger-tendencias');
  if(!el) return;
  const CANALES_OFF = ['Locales','Concesiones','Grandes Tiendas','Distribuidor'];
  const CANALES_ON  = ['Ecommerce','Marketplace','Venta en Verde'];
  function fStr(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return y+'-'+m+'-'+dd; }
  const hoy = fStr(new Date());
  try {
    const nSems = 6;
    // Construir rango de cada semana
    const rangos = [];
    for(let i=nSems-1;i>=0;i--){
      const sn = Math.max(semHoy-i,1);
      const {lun,vie} = isoSemanaAFechas(anio,sn);
      const fLun = fStr(lun);
      const fVie = fStr(vie) < hoy ? fStr(vie) : hoy;
      rangos.push({sn, fLun, fVie, esActual: sn===semHoy});
    }

    // Fetch paralelo — una query pequeña por semana (solo fecha,canal,cantidad,usuario)
    const resultados = await Promise.all(rangos.map(r=>
      sbFetchAll(
        'produccion?select=fecha,usuario,canal,cantidad'
        +'&fecha=gte.'+r.fLun+'&fecha=lte.'+r.fVie
        +'&tipo=neq.insumo'
        +'&usuario=neq.000014&usuario=neq.000196'
        +'&order=fecha.asc'
      ).then(rows=>({...r, rows}))
    ));

    // Calcular KPIs por semana
    const semsTend = resultados.map(({sn,fLun,fVie,esActual,rows})=>{
      const tot  = rows.reduce((s,r)=>s+r.cantidad,0);
      const dias = new Set(rows.map(r=>r.fecha)).size;
      const off  = rows.filter(r=>CANALES_OFF.includes(r.canal)).reduce((s,r)=>s+r.cantidad,0);
      const on   = rows.filter(r=>CANALES_ON.includes(r.canal)).reduce((s,r)=>s+r.cantidad,0);
      const gu   = rows.reduce((m,r)=>{m[r.usuario]=(m[r.usuario]||0)+r.cantidad;return m;},{});
      const lider= Object.entries(gu).sort((a,b)=>b[1]-a[1])[0]||null;
      return {sn,tot,dias,off,on,lider,esActual};
    });

    const maxTot = Math.max(...semsTend.map(s=>s.tot),1);

    el.innerHTML =
      '<div style="font-size:10px;font-weight:800;color:var(--txt3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">&#128200; Tendencias &middot; &#218;ltimas 6 semanas</div>'
    +'<div style="font-size:9px;color:var(--txt3);margin-bottom:12px">Semanas '+rangos[0].sn+' &rarr; '+semHoy+'</div>'

    // 1. Producción semanal
    +'<div style="margin-bottom:16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        +'<span style="font-size:9px;font-weight:700;color:#2ECC8A;text-transform:uppercase;letter-spacing:.05em">Producci&#243;n semanal</span>'
        +'<span style="font-size:9px;color:var(--txt3)">uds totales</span>'
      +'</div>'
      +'<svg width="100%" height="70" viewBox="0 0 280 70" preserveAspectRatio="none" style="overflow:visible">'
        +lineChart(semsTend.map(s=>s.tot),'#2ECC8A',60,280)
      +'</svg>'
      +'<div style="display:flex;justify-content:space-between;margin-top:4px">'
        +semsTend.map(s=>'<div style="flex:1;text-align:center">'
          +'<div style="font-size:7px;color:'+(s.esActual?'#2ECC8A':'var(--txt3)')+';font-weight:'+(s.esActual?800:400)+'">S'+s.sn+'</div>'
          +'<div style="font-size:8px;font-weight:700;color:'+(s.esActual?'#2ECC8A':s.tot>0?'var(--txt)':'var(--txt3)')+'">'+( s.tot>0?fmtN(s.tot):'&#8212;')+'</div>'
        +'</div>').join('')
      +'</div>'
    +'</div>'

    // 2. Promedio diario
    +'<div style="margin-bottom:16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
        +'<span style="font-size:9px;font-weight:700;color:#3B8FFF;text-transform:uppercase;letter-spacing:.05em">Promedio diario</span>'
        +'<span style="font-size:9px;color:var(--txt3)">uds/d&#237;a</span>'
      +'</div>'
      +'<svg width="100%" height="70" viewBox="0 0 280 70" preserveAspectRatio="none" style="overflow:visible">'
        +lineChart(semsTend.map(s=>s.dias>0?Math.round(s.tot/s.dias):0),'#3B8FFF',60,280)
      +'</svg>'
      +'<div style="display:flex;justify-content:space-between;margin-top:4px">'
        +semsTend.map(s=>{const p=s.dias>0?Math.round(s.tot/s.dias):0; return '<div style="flex:1;text-align:center">'
          +'<div style="font-size:7px;color:'+(s.esActual?'#3B8FFF':'var(--txt3)')+';font-weight:'+(s.esActual?800:400)+'">S'+s.sn+'</div>'
          +'<div style="font-size:8px;font-weight:700;color:'+(s.esActual?'#3B8FFF':p>0?'var(--txt)':'var(--txt3)')+'">'+( p>0?fmtN(p):'&#8212;')+'</div>'
        +'</div>';}).join('')
      +'</div>'
    +'</div>'

    // 3. Mix Offline/Online barras apiladas
    +'<div style="margin-bottom:16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
        +'<span style="font-size:9px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.05em">Mix Offline / Online</span>'
        +'<div style="display:flex;gap:8px"><span style="font-size:8px;color:#3B8FFF">&#9632; Offline</span><span style="font-size:8px;color:#2ECC8A">&#9632; Online</span></div>'
      +'</div>'
      +'<div style="display:flex;align-items:flex-end;gap:4px;height:60px">'
        +semsTend.map(s=>{
          const hOff=s.tot>0?Math.round((s.off/maxTot)*56):0;
          const hOn =s.tot>0?Math.round((s.on/maxTot)*56):0;
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;justify-content:flex-end">'
            +'<div style="width:100%;border-radius:2px 2px 0 0;background:#2ECC8A;height:'+hOn+'px;opacity:'+(s.esActual?1:.65)+'"></div>'
            +'<div style="width:100%;background:#3B8FFF;height:'+hOff+'px;opacity:'+(s.esActual?1:.65)+'"></div>'
          +'</div>';
        }).join('')
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;margin-top:4px">'
        +semsTend.map(s=>'<div style="flex:1;text-align:center;font-size:7px;color:'+(s.esActual?'var(--txt)':'var(--txt3)')+';font-weight:'+(s.esActual?800:400)+'">S'+s.sn+'</div>').join('')
      +'</div>'
    +'</div>'

    // 4. Liderazgo semanal
    +'<div>'
      +'<div style="font-size:9px;font-weight:700;color:#FFBA4D;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">&#128081; Liderazgo semanal</div>'
      +'<div style="display:flex;flex-direction:column;gap:5px">'
        +semsTend.filter(s=>s.lider).reverse().map(s=>{
          const nombre=DB[s.lider[0]]?DB[s.lider[0]].trim().split(/\s+/).slice(0,2).join(' '):s.lider[0];
          const pctBar=Math.round(s.lider[1]/maxTot*100);
          return '<div style="display:flex;align-items:center;gap:8px">'
            +'<div style="font-size:8px;color:var(--txt3);min-width:18px;text-align:right">S'+s.sn+'</div>'
            +'<div style="font-size:10px;font-weight:600;color:'+(s.esActual?'#FFBA4D':'var(--txt)')+';min-width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+nombre+'</div>'
            +'<div style="flex:1;height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden">'
              +'<div style="height:100%;width:'+pctBar+'%;background:'+(s.esActual?'#FFBA4D':'#9A88FF')+';border-radius:3px"></div>'
            +'</div>'
            +'<div style="font-size:9px;font-weight:700;color:'+(s.esActual?'#FFBA4D':'var(--txt2)')+';min-width:38px;text-align:right">'+fmtN(s.lider[1])+'</div>'
          +'</div>';
        }).join('')
      +'</div>'
    +'</div>';

  } catch(e){
    if(el) el.innerHTML='<div style="font-size:10px;color:#EF4444;padding:8px">Error: '+e.message+'</div>';
    console.error('tendencias error:',e);
  }
}

let gerSemActual = null; // número de semana ISO para el dashboard gerente

function navegarGerSemana(delta){
  if(!gerSemActual) gerSemActual = isoWeekActual();
  gerSemActual = gerSemActual + delta;
  if(gerSemActual < 1)  gerSemActual = 1;
  if(gerSemActual > 52) gerSemActual = 52;
  loadGerente();
}

function showGerTab(tab, btn){
  // Tabs UI
  ['dash','plan'].forEach(t=>{
    const b = document.getElementById('gtab-'+t);
    const d = document.getElementById('gt-'+t);
    if(b && d){
      if(t===tab){
        b.style.borderBottom='2px solid #3B8FFF';
        b.style.background='rgba(59,143,255,.08)';
        b.style.color='#3B8FFF';
        b.style.fontWeight='800';
        d.style.display='block';
      } else {
        b.style.borderBottom='2px solid transparent';
        b.style.background='none';
        b.style.color='var(--txt3)';
        b.style.fontWeight='600';
        d.style.display='none';
      }
    }
  });
  // Si abre Plan, cargar plan
  if(tab==='plan'){
    document.getElementById('ger-sub').textContent='Plan semanal';
    const semAhora  = isoWeekActual();
    const anioAhora = new Date().getFullYear();
    const mismoCache = _planCache.sem===semAhora && _planCache.anio===anioAhora && _planCache.data;
    planSemActual = semAhora;
    if(!mismoCache) cargarPlanSemanal();
  } else {
    document.getElementById('ger-sub').textContent='Dashboard ejecutivo';
    if(!gerSemActual) gerSemActual = isoWeekActual();
    loadGerente();
  }
}

// ── Detalle Arrastre Pendiente (doble click en tarjeta Pendiente) ──────────
function abrirDetalleArrastre(){
  var tabla = (_planCache.tablaAuditoria || []).filter(function(r){ return r.pendiente > 0; });
  if(!tabla.length){
    alert('No hay unidades pendientes de arrastre.');
    return;
  }
  // Ordenar por fecha_creada ASC (más antigua primero), luego canal
  tabla.sort(function(a,b){
    if(a.fecha_creada < b.fecha_creada) return -1;
    if(a.fecha_creada > b.fecha_creada) return 1;
    return (a.canal||'').localeCompare(b.canal||'');
  });

  var totalPend = tabla.reduce(function(s,r){ return s + r.pendiente; }, 0);
  var totalEnt  = tabla.length;

  document.getElementById('arrastre-det-resumen').textContent =
    totalEnt + ' entrega' + (totalEnt!==1?'s':'') + ' · ' + totalPend.toLocaleString('es-CL') + ' unidades pendientes';

  var canalColors = {
    'Locales':'#3B8FFF','Concesiones':'#9A88FF','Grandes Tiendas':'#2ECC8A',
    'Distribuidor':'#FFBA4D','Ecommerce':'#FF6B6B','Marketplace':'#4DCFFF','Venta en Verde':'#A8FF78'
  };

  var rows = tabla.map(function(r, i){
    var col = canalColors[r.canal] || '#8AAED4';
    var bg  = i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent';
    return '<tr style="background:' + bg + ';border-bottom:1px solid rgba(255,255,255,.04)">'
      + '<td style="padding:7px 10px;color:#E8F1FF;white-space:nowrap">' + (r.fecha_creada||'—') + '</td>'
      + '<td style="padding:7px 10px"><span style="background:' + col + '22;color:' + col + ';border-radius:4px;padding:2px 6px;font-size:10px;font-weight:600">' + (r.canal||'—') + '</span></td>'
      + '<td style="padding:7px 10px;color:#8AAED4;font-size:10px">' + (r.id_entrega||'—') + '</td>'
      + '<td style="padding:7px 10px;color:#8AAED4;font-size:10px">' + (r.clientenombre||'—') + '</td>'
      + '<td style="padding:7px 10px;text-align:right;font-weight:700;color:#FFBA4D">' + r.pendiente.toLocaleString('es-CL') + '</td>'
      + '</tr>';
  }).join('');

  document.getElementById('arrastre-det-body').innerHTML = rows;
  document.getElementById('arrastre-det-foot').innerHTML =
    '<tr style="background:rgba(239,68,68,.08);border-top:1px solid rgba(239,68,68,.2)">'
    + '<td colspan="4" style="padding:8px 10px;font-weight:700;color:#EF4444;font-size:11px">TOTAL PENDIENTE</td>'
    + '<td style="padding:8px 10px;text-align:right;font-weight:900;color:#FFBA4D;font-size:13px">' + totalPend.toLocaleString('es-CL') + '</td>'
    + '</tr>';

  var el = document.getElementById('modal-arrastre-det');
  el.style.display = 'flex';
}

function cerrarDetalleArrastre(){
  var el = document.getElementById('modal-arrastre-det');
  if(el) el.style.display = 'none';
}


function abrirPlanDesdeGerente(){
  showGerTab('plan', document.getElementById('gtab-plan'));
}

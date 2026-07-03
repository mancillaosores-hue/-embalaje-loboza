/**
 * supervisor.js
 * ─────────────────────────────────────────────────────────────
 * Vista supervisor: ranking de equipo diario, métricas de mes
 * y semana, exportación PDF del ranking, tabla de canales,
 * indicadores de cumplimiento y gráficos de evolución.
 *
 * Dependencias : config.js, supabase.js, helpers.js, ui.js
 * Exporta (global): showSupTab, loadEquipo, exportEquipo,
 *   calcularCapacidadEquipo, loadSupMes, loadSupSemana
 * ─────────────────────────────────────────────────────────────
 */

// SUPERVISOR — EQUIPO
// ============================================================

// ============================================================
// CYBER DAY — detección y carga de datos
// ============================================================
// Días cyber configurados (YYYY-MM-DD) — agregar según corresponda
const CYBER_DAYS = ['2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05','2026-06-06'];

function esCyberDay(fecha){
  return CYBER_DAYS.includes(fecha);
}

async function actualizarCyber(){
  const fecha = document.getElementById('eq-fecha').value;
  if(!fecha) return;

  const btn = document.getElementById('cyber-btn-act');
  const sub = document.getElementById('cyber-subtitulo');
  if(btn){ btn.disabled=true; btn.textContent='...'; }

  try{
    const ONLINE_CANALES = ['Ecommerce','Marketplace','Venta en verde'];
    const canalesParam = 'Ecommerce,Marketplace,Venta%20en%20verde';

    let rowsOnline;
    // Siempre modo día
    rowsOnline = await sbFetchAll('produccion?select=canal,tipo,cantidad,entrega,ruta,clientenombre&fecha=eq.'+fecha
      +'&canal=in.('+canalesParam+')&order=id.asc').catch(()=>
      sbFetchAll('produccion?select=canal,tipo,cantidad,entrega,ruta&fecha=eq.'+fecha
        +'&canal=in.('+canalesParam+')&order=id.asc'));
    if(sub) sub.textContent = 'Ecommerce · Marketplace · Venta en verde';

    // ── KPIs del día ──
    const uds      = rowsOnline.reduce((s,r)=>s+Number(r.cantidad),0);
    const rutas    = new Set(rowsOnline.map(r=>r.ruta).filter(Boolean)).size;
    const rowsConE = rowsOnline.filter(r=>r.entrega&&r.entrega!=='');
    const entregas = new Set(rowsConE.map(r=>r.entrega)).size;

    document.getElementById('cyber-uds').textContent      = fmtN(uds);
    document.getElementById('cyber-entregas').textContent = entregas ? fmtN(entregas) : '—';
    document.getElementById('cyber-rutas').textContent    = rutas ? fmtN(rutas) : '—';
    const ticketProm = entregas>0 ? (uds/entregas).toFixed(1) : null;
    document.getElementById('cyber-ticket').textContent   = ticketProm ? ticketProm+' uds' : '—';

    // ── Desglose maleta vs línea/otro (todos los canales online) ──
    const udsMaleta = rowsOnline.filter(r=>r.tipo==='maleta').reduce((s,r)=>s+Number(r.cantidad),0);
    const udsLinea  = uds - udsMaleta;
    document.getElementById('cyber-uds-maleta').textContent = fmtN(udsMaleta);
    document.getElementById('cyber-uds-linea').textContent  = fmtN(udsLinea);
    document.getElementById('cyber-uds-maleta-pct').textContent = uds>0 ? Math.round(udsMaleta/uds*100)+'%' : '';
    document.getElementById('cyber-uds-linea-pct').textContent  = uds>0 ? Math.round(udsLinea/uds*100)+'%' : '';

    // ── PTW / Unitario / Unitario Mixto ──
    // Aplica a TODOS los canales online (Ecommerce, Marketplace, Venta en Verde)
    // PTW          = entrega con SOLO línea
    // Unitario     = entrega con SOLO maleta
    // Unitario Mixto = entrega con maleta Y línea
    const eMap = {};
    rowsConE.forEach(r=>{
      if(!eMap[r.entrega]) eMap[r.entrega]={maleta:0,linea:0};
      if(r.tipo==='maleta') eMap[r.entrega].maleta+=Number(r.cantidad);
      else eMap[r.entrega].linea+=Number(r.cantidad);
    });

    let ptw=0,udsPtw=0, uni=0,udsUni=0, mix=0,udsMix=0;
    Object.values(eMap).forEach(e=>{
      const tieneM = e.maleta>0, tieneL = e.linea>0;
      if(tieneM && tieneL){ mix++;  udsMix+=e.maleta+e.linea; }
      else if(tieneM)     { uni++;  udsUni+=e.maleta; }
      else                { ptw++;  udsPtw+=e.linea; }
    });

    const totEnt = ptw+uni+mix;
    const totUds = udsPtw+udsUni+udsMix;

    const pct = (n,d) => d>0 ? Math.round(n/d*100)+'%' : '—';

    document.getElementById('cyber-ptw').textContent        = fmtN(ptw);
    document.getElementById('cyber-ptw-uds').textContent   = fmtN(udsPtw);
    document.getElementById('cyber-ptw-pct-e').textContent = pct(ptw,totEnt);
    document.getElementById('cyber-ptw-pct-u').textContent = pct(udsPtw,totUds);

    document.getElementById('cyber-uni').textContent        = fmtN(uni);
    document.getElementById('cyber-uni-uds').textContent   = fmtN(udsUni);
    document.getElementById('cyber-uni-pct-e').textContent = pct(uni,totEnt);
    document.getElementById('cyber-uni-pct-u').textContent = pct(udsUni,totUds);

    document.getElementById('cyber-mix').textContent        = fmtN(mix);
    document.getElementById('cyber-mix-uds').textContent   = fmtN(udsMix);
    document.getElementById('cyber-mix-pct-e').textContent = pct(mix,totEnt);
    document.getElementById('cyber-mix-pct-u').textContent = pct(udsMix,totUds);

    // ── Por cliente dentro de Ecommerce / Marketplace / Venta en Verde ──
    const canalEl = document.getElementById('cyber-canales');
    const CANAL_DEF = [
      { key:'Ecommerce',      label:'Ecommerce',      color:'#0891b2', icon:'🛒' },
      { key:'Marketplace',    label:'Marketplace',    color:'#db2777', icon:'🏪' },
      { key:'Venta en verde', label:'Venta en Verde', color:'#65a30d', icon:'🟢' },
    ];
    let cHtml = '';
    CANAL_DEF.forEach(({key, label, color, icon})=>{
      const rowsCn = rowsOnline.filter(r=>r.canal===key);
      if(!rowsCn.length) return;
      const totalUds = rowsCn.reduce((s,r)=>s+Number(r.cantidad),0);
      const totalEnt = new Set(rowsCn.filter(r=>r.entrega&&r.entrega!=='').map(r=>r.entrega)).size;

      // Agrupar por clientenombre
      const clientMap = {};
      rowsCn.forEach(r=>{
        const cn = (r.clientenombre||r.canal||'Sin nombre').toString().trim();
        if(!clientMap[cn]) clientMap[cn]={uds:0,entregas:new Set()};
        clientMap[cn].uds += Number(r.cantidad);
        if(r.entrega&&r.entrega!=='') clientMap[cn].entregas.add(r.entrega);
      });
      const clientes = Object.entries(clientMap).sort((a,b)=>b[1].uds-a[1].uds);

      cHtml += `<div style="background:rgba(0,0,0,.25);border:1px solid ${color}44;border-radius:10px;padding:10px 12px;margin-bottom:8px">`;
      // Header del canal
      cHtml += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:6px">`;
      cHtml += `<div style="font-size:12px;font-weight:800;color:${color};white-space:nowrap">${icon} ${label}</div>`;
      cHtml += `<div style="text-align:right;flex-shrink:0"><span style="font-size:14px;font-weight:800;color:#fff">${fmtN(totalUds)}</span><span style="font-size:9px;color:rgba(255,255,255,.4);margin-left:4px">uds</span>`;
      if(totalEnt) cHtml += `<span style="font-size:11px;font-weight:700;color:${color};margin-left:8px">${fmtN(totalEnt)} ent.</span>`;
      cHtml += `</div></div>`;

      // Barra separadora
      cHtml += `<div style="border-top:1px solid ${color}22;margin-bottom:7px"></div>`;

      // Header columnas
      cHtml += `<div style="display:grid;grid-template-columns:1fr 72px 72px;gap:4px;margin-bottom:4px">`;
      cHtml += `<div style="font-size:8px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase">Cliente</div>`;
      cHtml += `<div style="font-size:8px;font-weight:700;color:rgba(255,255,255,.35);text-align:right;text-transform:uppercase">Uds</div>`;
      cHtml += `<div style="font-size:8px;font-weight:700;color:rgba(255,255,255,.35);text-align:right;text-transform:uppercase">Entregas</div>`;
      cHtml += `</div>`;

      // Filas por cliente
      clientes.forEach(([nombre, d])=>{
        const pct = totalUds>0 ? Math.round(d.uds/totalUds*100) : 0;
        const ent = d.entregas.size;
        cHtml += `<div style="display:grid;grid-template-columns:1fr 72px 72px;gap:4px;align-items:center;padding:5px 0;border-top:1px solid rgba(255,255,255,.05)">`;
        // nombre + barra de % 
        cHtml += `<div>`;
        cHtml += `<div style="font-size:10px;font-weight:600;color:rgba(255,255,255,.85);margin-bottom:3px">${nombre}</div>`;
        cHtml += `<div style="height:3px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden">`;
        cHtml += `<div style="height:3px;width:${pct}%;background:${color};border-radius:2px"></div></div>`;
        cHtml += `</div>`;
        cHtml += `<div style="font-size:12px;font-weight:800;color:#fff;text-align:right">${fmtN(d.uds)}</div>`;
        cHtml += `<div style="font-size:12px;font-weight:700;color:${color};text-align:right">${ent ? fmtN(ent) : '—'}</div>`;
        cHtml += `</div>`;
      });
      cHtml += `</div>`;
    });
    canalEl.innerHTML = cHtml || '<div style="font-size:12px;color:rgba(255,255,255,.4);text-align:center;padding:8px">Sin datos online</div>';

  } catch(e){
    console.error('actualizarCyber:',e);
    if(sub) sub.textContent = '⚠️ Error al cargar';
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='↺'; }
  }
}

async function loadEquipo(){
  const fecha=document.getElementById('eq-fecha').value;
  if(!fecha){toast('Selecciona una fecha');return}
  clearCaches();
  const el=document.getElementById('eq-ranking');
  el.innerHTML='<div class="loading"><span class="spinner"></span>Cargando...</div>';
  try{
    const rows=await fetchProdAll(fecha,fecha);
    eqCache=rows;

    // ── Agrupar por usuario ──
    const g={};
    rows.forEach(r=>{
      if(!g[r.usuario])g[r.usuario]={total:0,maleta:0,linea:0,insumo:0,otro:0};
      if(r.tipo!=='insumo') g[r.usuario].total+=r.cantidad;
      g[r.usuario][r.tipo]=(g[r.usuario][r.tipo]||0)+r.cantidad;
    });
    const sorted=Object.entries(g).filter(([,d])=>d.total>0).sort((a,b)=>b[1].total-a[1].total);
    const soloInsumos=Object.entries(g).filter(([,d])=>d.total===0&&d.insumo>0);
    const DOTACION_ESPERADA      = 12;
    const DOTACION_ESPERADA_HERO = 12;
    const n=sorted.length;
    const tot=rows.filter(r=>r.tipo!=='insumo').reduce((s,r)=>s+r.cantidad,0);
    document.getElementById('eq-n').textContent=n;
    document.getElementById('eq-tot').textContent=fmtN(tot);
    document.getElementById('eq-prom').textContent=n>0?fmtN(Math.round(tot/n)):'—';
    // Hero Plan-style
    document.getElementById('eq-kpis').style.display='block';
    const eqFechaEl=document.getElementById('eq-hero-fecha');
    if(eqFechaEl){ const fd=document.getElementById('eq-fecha').value; eqFechaEl.textContent='Equipo · '+fmtFecha(fd); }
    document.getElementById('eq-n-sub').textContent='de '+DOTACION_ESPERADA_HERO;

    // ── Desglose por CANAL ──
    const canal={};
    rows.forEach(r=>{
      if(r.tipo==='insumo') return; // excluir insumos del total canal
      const c=(r.canal||'Sin canal').toString().trim()||'Sin canal';
      canal[c]=(canal[c]||0)+r.cantidad;
    });
    // ── CANAL OFFLINE — banner rediseñado estilo Online ──
    const CANALES_OFFLINE_EQ = ['Locales','Concesiones','Grandes Tiendas','Distribuidor'];
    const canalCard=document.getElementById('eq-canales-card');
    const canalEl=document.getElementById('eq-canales');
    const totOffline = CANALES_OFFLINE_EQ.reduce((s,c)=>s+(canal[c]||0),0);
    const offEntries = CANALES_OFFLINE_EQ
      .map(c=>([c, canal[c]||0]))
      .filter(([,v])=>v>0)
      .sort((a,b)=>b[1]-a[1]);
    const rowsOffline = rows.filter(r=>CANALES_OFFLINE_EQ.includes(r.canal));
    const offMaleta = rowsOffline.reduce((s,r)=>s+(r.tipo==='maleta'?r.cantidad:0),0);
    const offLinea  = rowsOffline.reduce((s,r)=>s+(r.tipo==='linea'?r.cantidad:0),0);
    const offMaletaPct = totOffline>0?Math.round(offMaleta/totOffline*100):0;
    const offLineaPct  = totOffline>0?Math.round(offLinea/totOffline*100):0;
    if(offEntries.length||totOffline>0){
      const tilesMix = (offMaleta>0||offLinea>0) ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
          <div style="background:rgba(96,176,255,.07);border:1px solid rgba(96,176,255,.2);border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:8px;font-weight:700;color:#60B0FF;text-transform:uppercase;margin-bottom:3px">No Maleta</div>
            <div style="font-size:20px;font-weight:900;color:#60B0FF;line-height:1">${fmtN(offLinea)}</div>
            <div style="font-size:8px;color:rgba(96,176,255,.45);margin-top:2px">${offLineaPct}%</div>
            <div style="height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden;margin-top:5px">
              <div style="height:100%;width:${offLineaPct}%;background:#60B0FF;border-radius:2px"></div>
            </div>
          </div>
          <div style="background:rgba(167,139,250,.07);border:1px solid rgba(167,139,250,.2);border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:8px;font-weight:700;color:#a78bfa;text-transform:uppercase;margin-bottom:3px">Maleta</div>
            <div style="font-size:20px;font-weight:900;color:#a78bfa;line-height:1">${fmtN(offMaleta)}</div>
            <div style="font-size:8px;color:rgba(167,139,250,.45);margin-top:2px">${offMaletaPct}%</div>
            <div style="height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden;margin-top:5px">
              <div style="height:100%;width:${offMaletaPct}%;background:#a78bfa;border-radius:2px"></div>
            </div>
          </div>
        </div>` : '';
      const canalesHtml = offEntries.map(([nombre,uds])=>{
        const pct=totOffline>0?Math.round(uds/totOffline*100):0;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,.04);border-radius:10px;border:1px solid rgba(255,255,255,.06)">`
          +`<span style="font-size:12px;font-weight:600;min-width:110px">${nombre}</span>`
          +`<div style="flex:1;margin:0 10px"><div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden">`
          +`<div style="height:100%;width:${pct}%;background:#60B0FF;border-radius:3px"></div></div></div>`
          +`<span style="font-size:13px;font-weight:700;color:#60B0FF;min-width:42px;text-align:right">${fmtN(uds)}</span>`
          +`<span style="font-size:10px;color:rgba(255,255,255,.3);min-width:32px;text-align:right">${pct}%</span></div>`;
      }).join('');
      canalEl.innerHTML =
        `<div style="background:linear-gradient(135deg,#060e1a 0%,#0a1628 50%,#060e1a 100%);border:1px solid rgba(59,143,255,.35);border-radius:16px;overflow:hidden">`
        +`<div style="background:linear-gradient(90deg,#0f3070,#1e3a8a);padding:12px 16px;display:flex;align-items:center;justify-content:space-between">`
        +`<div style="display:flex;align-items:center;gap:8px"><span style="font-size:22px">&#127970;</span>`
        +`<div><div style="font-size:14px;font-weight:800;color:#fff;letter-spacing:.04em">CANAL OFFLINE</div>`
        +`<div style="font-size:10px;color:rgba(255,255,255,.6)">Locales &middot; Concesiones &middot; Gdes. Tiendas &middot; Distribuidor</div></div></div>`
        +`<div style="text-align:right"><div style="font-size:26px;font-weight:800;color:#60B0FF;line-height:1">${fmtN(totOffline)}</div>`
        +`<div style="font-size:9px;color:rgba(96,176,255,.5)">uds totales</div></div></div>`
        +`<div style="padding:14px 16px">${tilesMix}`
        +`<div style="font-size:8px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Por canal</div>`
        +`<div style="display:flex;flex-direction:column;gap:7px">${canalesHtml}</div></div></div>`;
      canalCard.style.display='block';
    } else { canalCard.style.display='none'; }
    // tipos integrados en banner offline
    document.getElementById('eq-tipos-card').style.display='none';

    // ── Canal Online — Rutas, Entregas, PTW/Unitario ──
    const CANALES_ON=['Ecommerce','Marketplace','Venta en verde'];
    const rowsOnline=rows.filter(r=>CANALES_ON.includes(r.canal));

    // ── Dotación vs Ausencia ──
    const presentes = n; // operarias con producción ese día
    const ausentes  = Math.max(DOTACION_ESPERADA - presentes, 0);

    // Capacidad perdida: ausentes × META promedio de las activas
    const metaActivas = sorted.map(([uid])=>META[uid]||0).filter(m=>m>0);
    const metaProm    = metaActivas.length ? Math.round(metaActivas.reduce((a,b)=>a+b,0)/metaActivas.length) : 1215;
    const capPerdida  = ausentes * metaProm;

    // Capacidad disponible: suma META de presentes
    const capDisponible = sorted.reduce((s,[uid])=>s+(META[uid]||0),0);

    // Producción sin insumos para cumplimiento real
    const totSinInsumo = rows.filter(r=>r.tipo!=='insumo'&&r.canal!=='Anulada').reduce((s,r)=>s+r.cantidad,0);
    const cumplAjustado = capDisponible>0 ? Math.round(totSinInsumo/capDisponible*100) : 0;
    const cumplTotal    = (capDisponible+capPerdida)>0 ? Math.round(totSinInsumo/(capDisponible+capPerdida)*100) : 0;

    const dotCard = document.getElementById('eq-dotacion-card');
    const dotEl   = document.getElementById('eq-dotacion-contenido');
    if(dotCard && dotEl){
      dotCard.style.display = 'block';

      // Actualizar barra hero con cumplimiento
      const heroBarraWrap = document.getElementById('eq-hero-barra-wrap');
      const heroBarraFill = document.getElementById('eq-hero-barra-fill');
      const heroBarraLabel = document.getElementById('eq-hero-barra-label');
      if(heroBarraWrap && capDisponible>0){
        const heroBarCol = cumplAjustado>=100?'#2ECC8A':cumplAjustado>=80?'#FFBA4D':'#EF4444';
        heroBarraWrap.style.display='block';
        heroBarraFill.style.width=Math.min(cumplAjustado,100)+'%';
        heroBarraFill.style.background=`linear-gradient(90deg,${heroBarCol}88,${heroBarCol})`;
        if(heroBarraLabel) heroBarraLabel.textContent=fmtN(totSinInsumo)+' / '+fmtN(capDisponible)+' uds';
        if(heroBarraLabel) heroBarraLabel.style.color=heroBarCol;
      }

      // Iconos presentes/ausentes
      let iconos = '';
      for(let i=0;i<presentes;i++) iconos+=`<span style="font-size:22px">👩‍🏭</span>`;
      for(let i=0;i<ausentes;i++)  iconos+=`<span style="font-size:22px;opacity:.2;filter:grayscale(1)">👩‍🏭</span>`;

      const semCol = cumplAjustado>=95?'#2ECC8A':cumplAjustado>=80?'#FFBA4D':'#EF4444';
      const pillBg = cumplAjustado>=95?'rgba(46,204,138,.12)':cumplAjustado>=80?'rgba(255,186,77,.12)':'rgba(239,68,68,.12)';
      const pillBd = cumplAjustado>=95?'rgba(46,204,138,.3)':cumplAjustado>=80?'rgba(255,186,77,.3)':'rgba(239,68,68,.3)';

      dotEl.innerHTML = `
        <!-- Iconos operarias -->
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">${iconos}</div>

        <!-- 4 KPIs compactos -->
        <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px;margin-bottom:10px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px">
            <div style="text-align:center">
              <div style="font-size:7.5px;font-weight:700;color:#2ECC8A;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;line-height:1.3">Presentes</div>
              <div style="font-size:16px;font-weight:900;color:#2ECC8A;line-height:1">${presentes}</div>
              <div style="font-size:8px;color:rgba(46,204,138,.45);margin-top:1px">operarias</div>
            </div>
            <div style="text-align:center;border-left:1px solid rgba(255,255,255,.07)">
              <div style="font-size:7.5px;font-weight:700;color:${ausentes>0?'#EF4444':'var(--txt3)'};text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;line-height:1.3">Ausentes</div>
              <div style="font-size:16px;font-weight:900;color:${ausentes>0?'#EF4444':'var(--txt2)'};line-height:1">${ausentes}</div>
              <div style="font-size:8px;color:rgba(255,255,255,.3);margin-top:1px">operarias</div>
            </div>
            <div style="text-align:center;border-left:1px solid rgba(255,255,255,.07)">
              <div style="font-size:7.5px;font-weight:700;color:#3B8FFF;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;line-height:1.3">Cap.<br>Disponible</div>
              <div style="font-size:16px;font-weight:900;color:#3B8FFF;line-height:1">${fmtN(capDisponible)}</div>
              <div style="font-size:8px;color:rgba(59,143,255,.45);margin-top:1px">uds posibles</div>
            </div>
            <div style="text-align:center;border-left:1px solid rgba(255,255,255,.07)">
              <div style="font-size:7.5px;font-weight:700;color:${capPerdida>0?'#EF4444':'var(--txt3)'};text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;line-height:1.3">Cap.<br>Perdida</div>
              <div style="font-size:16px;font-weight:900;color:${capPerdida>0?'#EF4444':'var(--txt2)'};line-height:1">${capPerdida>0?'−'+fmtN(capPerdida):'0'}</div>
              <div style="font-size:8px;color:rgba(255,255,255,.3);margin-top:1px">uds perdidas</div>
            </div>
          </div>
        </div>

        <!-- Banner cumplimiento -->
        <div style="background:${pillBg};border:1px solid ${pillBd};border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center${ausentes>0?';margin-bottom:8px':''}">
          <div>
            <div style="font-size:11px;color:${semCol};font-weight:600">Cumplimiento real del equipo presente</div>
            <div style="font-size:9px;color:${semCol};opacity:.7;margin-top:2px">${fmtN(totSinInsumo)} producidas ÷ ${fmtN(capDisponible)} posibles</div>
          </div>
          <span style="font-size:9px;font-weight:700;color:${semCol};background:${pillBg};border:1px solid ${pillBd};padding:3px 10px;border-radius:20px">${cumplAjustado}%</span>
        </div>

        <!-- Alerta ausentes -->
        ${ausentes>0?`
        <div style="background:rgba(255,186,77,.07);border:1px solid rgba(255,186,77,.25);border-radius:8px;padding:10px 14px;font-size:11px;line-height:1.55;color:#FFBA4D">
          ⚠ El <b>${cumplTotal}% de cumplimiento total</b> incluye el impacto de ${ausentes} ausente${ausentes>1?'s':''} (−${fmtN(capPerdida)} uds).<br>
          El equipo <b>presente</b> trabajó al <b>${cumplAjustado}%</b> de su capacidad real.
        </div>`:''}
      `;
    }

    // ── Ranking rediseñado ──
    const maxV=sorted[0]?.[1].total||1;

    // Podio top 3
    const podioMedallas=['🥇','🥈','🥉'];
    const podioColores=['#FFB84D','#8AAED4','#CD7C54'];
    const podioBg=['rgba(255,184,77,.12)','rgba(138,174,212,.08)','rgba(205,124,84,.08)'];
    const podioBorder=['#FFB84D40','#8AAED440','#CD7C5440'];

    let podioHtml='';
    if(sorted.length>=2){
      const top=sorted.slice(0,Math.min(3,sorted.length));
      // Orden visual: 2º izq - 1º centro - 3º der
      const orden=top.length===1?[0]:top.length===2?[1,0]:[1,0,2];

      // Alturas según POSICIÓN VISUAL (0=izq/2º, 1=centro/1º, 2=der/3º)
      const alturasVisual=[72, 110, 54];
      const gradientes=[
        'linear-gradient(180deg,#C8C8C8 0%,#8A8A8A 100%)',
        'linear-gradient(180deg,#FFD700 0%,#E6A800 100%)',
        'linear-gradient(180deg,#CD8E5A 0%,#8B5A2B 100%)',
      ];
      const colTexto=['#E0E0E0','#FFE566','#E8A870'];
      const glows=[
        '0 0 18px rgba(192,192,192,.3)',
        '0 0 24px rgba(255,215,0,.35)',
        '0 0 14px rgba(205,127,50,.25)',
      ];

      // Tamaños según RANKING REAL (idx: 0=1°,1=2°,2=3°) — el 1° siempre es el más grande
      const fontMedalla=['26','21','18'];
      const fontNombre=['12','11','10'];
      const fontNum=['24','19','16'];
      const fontPct=['10','9','8'];

      podioHtml=`<div style="display:flex;align-items:flex-end;justify-content:center;gap:6px;margin-bottom:18px;padding:0 2px">
        ${orden.map((idx, posVisual)=>{
          if(!top[idx]) return '';
          const [uid,d]=top[idx];
          const nombre=DB[uid]?nombreCorto(DB[uid]):uid;
          const meta=META[uid]||0;
          const pct=meta>0?Math.round(d.total/meta*100):null;
          const semCol=pct===null?'#8AAED4':pct>=100?'#2ECC8A':pct>=70?'#FFBA4D':'#FF6B6B';
          const barH=alturasVisual[posVisual];
          const grad=gradientes[idx];
          const colTxt=colTexto[idx];
          const glow=glows[idx];
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px">
            <div style="font-size:${fontMedalla[idx]}px;line-height:1">${podioMedallas[idx]}</div>
            <div style="font-size:${fontNombre[idx]}px;font-weight:700;color:var(--txt);text-align:center;line-height:1.25;padding:0 2px">${nombre}</div>
            <div style="font-size:${fontNum[idx]}px;font-weight:900;color:${colTxt};letter-spacing:-.02em;text-shadow:${glow}">${fmtN(d.total)}</div>
            ${pct!==null?`<div style="font-size:${fontPct[idx]}px;font-weight:700;color:${semCol};background:${semCol}18;border:1px solid ${semCol}40;padding:2px 8px;border-radius:20px;white-space:nowrap">${pct}% meta</div>`:'<div style="height:18px"></div>'}
            <div style="width:100%;height:${barH}px;background:${grad};border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;box-shadow:${glow};position:relative;overflow:hidden">
              <div style="position:absolute;top:0;left:0;right:0;height:30%;background:linear-gradient(180deg,rgba(255,255,255,.18),transparent);border-radius:8px 8px 0 0;pointer-events:none"></div>
              <span style="font-size:28px;font-weight:900;color:rgba(0,0,0,.3);position:relative;z-index:1">${idx+1}</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }

    // Lista resto (4º en adelante) con barra hacia meta
    const restoHtml=sorted.slice(3).map(([uid,d],i)=>{
      const nombre=DB[uid]?nombreCorto(DB[uid]):uid;
      const meta=META[uid]||0;
      const pct=meta>0?Math.round(d.total/meta*100):null;
      const barW=meta>0?Math.min(pct,100):Math.round(d.total/maxV*100);
      const barCol=pct===null?'#3B8FFF':pct>=100?'#2ECC8A':pct>=70?'#FFBA4D':'#EF4444';
      const semCol=pct===null?'#8AAED4':pct>=100?'#2ECC8A':pct>=70?'#FFBA4D':'#EF4444';
      const pillBg=pct===null?'rgba(138,174,212,.12)':pct>=100?'rgba(46,204,138,.12)':pct>=70?'rgba(255,186,77,.12)':'rgba(239,68,68,.12)';
      const pillBd=pct===null?'rgba(138,174,212,.3)':pct>=100?'rgba(46,204,138,.3)':pct>=70?'rgba(255,186,77,.3)':'rgba(239,68,68,.3)';
      return`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">`
        +`<div style="width:22px;height:22px;border-radius:50%;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--txt3);flex-shrink:0">${i+4}</div>`
        +`<div style="flex:1;min-width:0">`
        +`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">`
        +`<span style="font-size:12px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nombre}</span>`
        +`<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">`
        +`<span style="font-size:12px;font-weight:700;color:var(--txt)">${fmtN(d.total)}</span>`
        +(pct!==null?`<span style="font-size:9px;font-weight:700;color:${semCol};background:${pillBg};border:1px solid ${pillBd};padding:1px 6px;border-radius:10px">${pct}%</span>`:'')
        +`</div></div>`
        +`<div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden">`
        +`<div style="height:100%;width:${barW}%;background:${barCol};border-radius:3px;transition:width .5s ease"></div></div>`
        +`</div></div>`;
    }).join('');

    const soloInsumoHtml = soloInsumos.length
      ? '<div style="margin-top:14px;padding:10px 12px;background:rgba(165,148,255,.07);border:1px solid rgba(165,148,255,.2);border-radius:10px">'
        +'<div style="font-size:10px;font-weight:700;color:#A594FF;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">📦 Insumos embalados</div>'
        +soloInsumos.map(([uid,d])=>'<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(165,148,255,.1)">'
          +'<span style="font-size:12px;color:var(--txt2)">'+(DB[uid]||uid)+'</span>'
          +'<span style="font-size:12px;font-weight:700;color:#A594FF">'+fmtN(d.insumo)+' uds</span></div>').join('')
        +'</div>' : '';
    el.innerHTML = sorted.length
      ? `${podioHtml}${restoHtml?`<div style="margin-top:4px">${restoHtml}</div>`:''}${soloInsumoHtml}`
      : soloInsumoHtml || '<div class="empty">Sin datos para esta fecha</div>';

    // ── Canal Online banner — siempre visible ──
    const cyberBanner=document.getElementById('cyber-banner');
    if(cyberBanner){
      cyberBanner.style.display='block';
      CYBER_MODO = 'dia';
      actualizarCyber();
    }
  }catch(e){el.innerHTML='<div class="empty">Error: '+e.message+'</div>'}
}

function exportEquipo(){
  if(!eqCache.length){toast('Sin datos para exportar');return}
  const header='Fecha,Código,Nombre,Tipo,Canal,Ruta,Mesa,Cantidad,Hora\n';
  const body=eqCache.map(r=>`${r.fecha},${r.usuario},"${DB[r.usuario]||r.nombre||''}",${r.tipo},${r.canal||''},${r.ruta||''},${r.mesa||''},${r.cantidad},${r.hora||''}`).join('\n');
  const blob=new Blob(['\uFEFF'+header+body],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='produccion_'+document.getElementById('eq-fecha').value+'.csv';
  a.click();
}

// ── Caché de Plan supervisor ──
const _planCache = { sem:null, anio:null, planRaw:null, prodRawSemana:null, entregasRawSemana:null, backlogPorCanal:null, semAntLabel:'', diasSem:null, lunObj:null, vieObj:null, domObj:null, idEntregasSAnt:new Set(), embalBackPorFecha:{}, arrastreInicial:null };
let planDiaActual = null; // null = semana completa; 'YYYY-MM-DD' = día específico filtrado
function invalidarPlanCache(){ _planCache.sem=null; _planCache.planRaw=null; _planCache.idEntregasSAnt=new Set(); _planCache.embalBackPorFecha={}; _planCache.arrastreInicial=null; }

let _tabActual = null; // tab actualmente visible

function showSupTab(tab, btn){
  // Tabs fijos dentro de sc-sup
  ['carga','equipo','mes','alertas','plan'].forEach(t=>{
    const el=document.getElementById('st-'+t);
    if(el) el.style.display=t===tab?'block':'none';
  });
  // Tab semana: está en wrapper externo
  const semWrap=document.getElementById('st-semana-wrapper');
  const scSup=document.getElementById('sc-sup');
  if(tab==='semana'){
    if(!scSup.contains(semWrap)) scSup.appendChild(semWrap);
    semWrap.style.display='block';
  } else {
    semWrap.style.display='none';
  }
  document.querySelectorAll('#sc-sup .tab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  if(tab==='semana' && !document.getElementById('sup-semana').value) document.getElementById('sup-semana').value=currentWeek();
  if(tab==='mes' && !document.getElementById('sup-mes').value) document.getElementById('sup-mes').value=currentMonth();

  // Plan: solo recargar si cambió de semana o no hay caché
  if(tab==='plan'){
    const semAhora = isoWeekActual();
    const anioAhora = new Date().getFullYear();
    const mismaVista = _tabActual === 'plan';
    const mismoCache = _planCache.sem === semAhora && _planCache.anio === anioAhora && _planCache.data;
    planSemActual = semAhora;
    if(!mismaVista || !mismoCache){
      cargarPlanSemanal();
    }
  }
  _tabActual = tab;
}

let supMesCache=[];
async function loadSupMes(){
  const ms=document.getElementById('sup-mes').value;
  if(!ms){toast('Selecciona un mes');return}
  clearCaches();
  const [desde,hasta]=monthRange(ms);
  const rows=await fetchProdAll(desde,hasta);
  supMesCache=rows;

  const gf=groupByFecha(rows);
  const dias=Object.keys(gf).length;
  const tot=rows.filter(r=>r.tipo!=='insumo').reduce((s,r)=>s+r.cantidad,0);
  const gu0m={}; rows.forEach(r=>{if(r.tipo!=='insumo')gu0m[r.usuario]=(gu0m[r.usuario]||0)+r.cantidad;});
  const nopMes=Object.keys(gu0m).length;
  const promOpMes=nopMes>0?Math.round(tot/nopMes):0;
  const diasValsMes=Object.values(gf).map(d=>d.total);
  const mejorDiaMes=diasValsMes.length?Math.max(...diasValsMes):0;
  const mejorFechaMes=Object.entries(gf).find(([,d])=>d.total===mejorDiaMes)?.[0]||'';
  // Hero
  document.getElementById('sup-mes-dias').textContent=dias||'—';
  document.getElementById('sup-mes-tot').textContent=fmtN(tot);
  document.getElementById('sup-mes-prom').textContent=dias>0?fmtN(Math.round(tot/dias)):'—';
  const mesHeroEl=document.getElementById('sup-mes-hero');
  if(mesHeroEl){ mesHeroEl.style.display='block'; }
  const mesLblEl=document.getElementById('sup-mes-hero-label');
  if(mesLblEl){ mesLblEl.textContent='Mes · '+fmtMes(ms); }
  // Fila indicadores
  const mesIndEl=document.getElementById('sup-mes-indicadores');
  if(mesIndEl && dias>0){
    mesIndEl.style.display='block';
    document.getElementById('sup-mes-mejor-val').textContent=fmtN(mejorDiaMes);
    document.getElementById('sup-mes-mejor-lbl').textContent=mejorFechaMes?fmtFecha(mejorFechaMes).slice(0,5):'';
    document.getElementById('sup-mes-nop').textContent=nopMes;
    document.getElementById('sup-mes-promop').textContent=fmtN(promOpMes);
    document.getElementById('sup-mes-promdia2').textContent=dias>0?fmtN(Math.round(tot/dias)):'—';
  }

  if(!rows.length){toast('Sin datos para este mes');return}

  // Canal
  const canal={};
  rows.forEach(r=>{if(r.tipo!=='insumo'){const c=(r.canal||'Sin canal').toString().trim();canal[c]=(canal[c]||0)+r.cantidad;}});
  const CANAL_COLORS={'OFFLINE':'#3B8FFF','ONLINE':'#3EC97E','Sin canal':'#4D7AAA'};
  document.getElementById('sup-mes-canales').innerHTML=Object.entries(canal).sort((a,b)=>b[1]-a[1]).map(([nombre,uds])=>{
    const pct=tot>0?Math.round(uds/tot*100):0;
    const color=CANAL_COLORS[nombre.toUpperCase()]||CANAL_COLORS['Sin canal'];
    return`<div class="kpi" style="border-color:${color}22;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;width:${pct}%;height:3px;background:${color}"></div>
      <div class="lbl" style="color:${color}">${nombre}</div>
      <div class="val">${fmtN(uds)}</div>
      <div class="sub">${pct}% del total</div>
    </div>`;
  }).join('');
  document.getElementById('sup-mes-canales-card').style.display='block';

  // Tipos
  const g=groupByTipo(rows);
  document.getElementById('sup-mes-tipos').innerHTML=renderTipoBars(g);
  document.getElementById('sup-mes-tipos-card').style.display='block';

  // Evolución del mes (barras por día)
  const entries=Object.entries(gf).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxDay=Math.max(...entries.map(([,d])=>d.total))||1;
  document.getElementById('sup-mes-evol').innerHTML=entries.map(([f,d])=>{
    const pct=Math.round(d.total/maxDay*100);
    const dd=f.slice(8,10);
    return`<div class="week-row">
      <div class="week-day">${dd}</div>
      <div class="week-bar-wrap"><div class="week-bar-fill" style="width:${pct}%"></div></div>
      <div class="week-val">${fmtN(d.total)}</div>
    </div>`;
  }).join('');
  document.getElementById('sup-mes-evol-card').style.display='block';

  // Ranking acumulado mes
  const gu={};
  rows.forEach(r=>{
    if(!gu[r.usuario])gu[r.usuario]={total:0,maleta:0,linea:0,insumo:0};
    gu[r.usuario].total+=r.cantidad;
    gu[r.usuario][r.tipo]=(gu[r.usuario][r.tipo]||0)+r.cantidad;
  });
  const sortedU=Object.entries(gu).sort((a,b)=>b[1].total-a[1].total);
  const maxU=sortedU[0]?.[1].total||1;
  document.getElementById('sup-mes-ranking').innerHTML=sortedU.map(([uid,d],i)=>{
    const nombre=DB[uid]?nombreCorto(DB[uid]):uid;
    const metaMes=(META[uid]||0)*dias;
    const pct=metaMes>0?Math.round(d.total/metaMes*100):null;
    const barCol=pct===null?'#3B8FFF':pct>=100?'#2ECC8A':pct>=70?'#FFBA4D':'#EF4444';
    const semCol=pct===null?'#8AAED4':pct>=100?'#2ECC8A':pct>=70?'#FFBA4D':'#EF4444';
    const pillBg=pct===null?'rgba(138,174,212,.12)':pct>=100?'rgba(46,204,138,.12)':pct>=70?'rgba(255,186,77,.12)':'rgba(239,68,68,.12)';
    const pillBd=pct===null?'rgba(138,174,212,.3)':pct>=100?'rgba(46,204,138,.3)':pct>=70?'rgba(255,186,77,.3)':'rgba(239,68,68,.3)';
    return`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">`
      +`<div style="width:22px;height:22px;border-radius:50%;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--txt3);flex-shrink:0">${i+1}</div>`
      +`<div style="flex:1;min-width:0">`
      +`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">`
      +`<span style="font-size:12px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nombre}</span>`
      +`<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">`
      +`<span style="font-size:12px;font-weight:700;color:var(--txt)">${fmtN(d.total)}</span>`
      +(pct!==null?`<span style="font-size:9px;font-weight:700;color:${semCol};background:${pillBg};border:1px solid ${pillBd};padding:1px 6px;border-radius:10px">${pct}%</span>`:'')
      +`</div></div>`
      +`<div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden">`
      +`<div style="height:100%;width:${Math.round(d.total/maxU*100)}%;background:${barCol};border-radius:3px;transition:width .5s ease"></div></div>`
      +`</div></div>`;
  }).join('');
  document.getElementById('sup-mes-ranking-card').style.display='block';
}

function exportRankingMesPDF(){
  if(!supMesCache.length){toast('Sin datos para exportar');return}
  const ms=document.getElementById('sup-mes').value;
  const [desde,hasta]=monthRange(ms);
  const gf=groupByFecha(supMesCache);
  const dias=Object.keys(gf).length;
  const gu={};
  supMesCache.forEach(r=>{
    if(!gu[r.usuario])gu[r.usuario]={total:0,maleta:0,linea:0,insumo:0};
    gu[r.usuario].total+=r.cantidad;
    gu[r.usuario][r.tipo]=(gu[r.usuario][r.tipo]||0)+r.cantidad;
  });
  const sortedU=Object.entries(gu).sort((a,b)=>b[1].total-a[1].total);
  const totGeneral=sortedU.reduce((s,[,d])=>s+d.total,0);
  const tableData=sortedU.map(([uid,d],i)=>{
    const nombre=DB[uid]||uid;
    const metaMes=(META[uid]||0)*dias;
    const pct=metaMes>0?Math.round(d.total/metaMes*100)+'%':'—';
    return[i+1, nombre, fmtN(d.total), pct, fmtN(d.maleta), fmtN(d.linea), fmtN(d.insumo)];
  });
  tableData.push(['','TOTAL EQUIPO',fmtN(totGeneral),'',
    fmtN(sortedU.reduce((s,[,d])=>s+d.maleta,0)),
    fmtN(sortedU.reduce((s,[,d])=>s+d.linea,0)),
    fmtN(sortedU.reduce((s,[,d])=>s+d.insumo,0))
  ]);
  const mesLabel=fmtMes(ms);
  const doc=buildRankingPDF(
    'Ranking Mensual · '+mesLabel,
    sortedU.length+' operarias · '+dias+' días · '+fmtN(totGeneral)+' unidades',
    tableData
  );
  doc.save('ranking_mes_'+ms+'.pdf');
  toast('✓ PDF mensual generado');
}

// PDF personal de la embaladora (tab Mes)
let mesMiCache=[];
async function loadMes(){
  const ms=document.getElementById('fil-mes').value;
  if(!ms) return;
  const [desde,hasta]=monthRange(ms);
  const el=document.getElementById('mes-content');
  el.innerHTML='<div class="loading"><span class="spinner"></span>Cargando...</div>';
  try{
    // Usar caché para el mes actual
    const hoy=today();
    let rows;
    if(ms===hoy.slice(0,7) && _cache.rows){
      rows=_cache.rows.filter(r=>r.fecha>=desde&&r.fecha<=hasta);
    } else {
      rows=await fetchProd(cUser,desde,hasta);
    }
    mesMiCache={rows,ms};
    if(!rows.length){el.innerHTML='<div class="empty">Sin datos para este mes</div>';return}

    const g=groupByTipo(rows);
    const gf=groupByFecha(rows);
    const dias=Object.keys(gf).length;
    const prom=dias>0?Math.round(g.total/dias):0;
    const meta=META[cUser]||0;
    const metaMes=meta*20;
    const pctMes=metaMes>0?Math.min(100,Math.round(g.total/metaMes*100)):0;
    const pctCol=pctMes>=100?'#2ECC8A':pctMes>=70?'#FFBA4D':'#3B8FFF';
    const vals=Object.values(gf).map(d=>d.total);
    const maxDia=Math.max(...vals);
    const mejorFecha=Object.entries(gf).find(([,d])=>d.total===maxDia)?.[0]||'';

    // Mes anterior desde caché
    const [anioN,mesN]=ms.split('-').map(Number);
    const mesAntKey=mesN===1?`${anioN-1}-12`:`${anioN}-${String(mesN-1).padStart(2,'0')}`;
    let promAnt=0, totalAnt=0;
    if(_cache.rows){
      const rowsAnt=_cache.rows.filter(r=>r.fecha.startsWith(mesAntKey));
      const diasAnt=new Set(rowsAnt.map(r=>r.fecha)).size;
      totalAnt=rowsAnt.reduce((s,r)=>s+r.cantidad,0);
      promAnt=diasAnt>0?Math.round(totalAnt/diasAnt):0;
    }
    const varPct=promAnt>0?Math.round((prom-promAnt)/promAnt*100):null;
    const varCol=varPct===null?'var(--txt3)':varPct>=0?'#2ECC8A':'#FF6B6B';
    const varTxt=varPct===null?'—':varPct>=0?`↑ +${varPct}%`:`↓ ${varPct}%`;

    el.innerHTML=`
    <!-- Hero mes -->
    <div style="background:linear-gradient(135deg,#0A1E3D,#061228);border:1px solid #1A3354;border-radius:var(--r);padding:16px;margin-bottom:8px">
      <div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${fmtMes(ms)}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px">
        <div>
          <div style="font-size:40px;font-weight:900;color:${pctCol};line-height:1;letter-spacing:-.03em">${fmtN(g.total)}</div>
          <div style="font-size:11px;color:var(--txt3);margin-top:3px">${dias} días trabajados · ${fmtN(prom)} uds/día</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:36px;font-weight:900;color:${pctCol};line-height:1">${pctMes}%</div>
          <div style="font-size:10px;color:var(--txt3)">meta ${fmtN(metaMes)}</div>
        </div>
      </div>
      <div style="height:10px;background:rgba(255,255,255,.07);border-radius:5px;overflow:hidden;margin-bottom:10px">
        <div style="height:100%;width:${pctMes}%;background:linear-gradient(90deg,${pctCol}88,${pctCol});border-radius:5px;transition:width .7s ease"></div>
      </div>
      <!-- Comparativa vs mes anterior -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:rgba(255,255,255,.04);border-radius:8px">
        <div style="font-size:11px;color:var(--txt3)">vs ${fmtMes(mesAntKey)}</div>
        <div style="display:flex;align-items:center;gap:8px">
          ${promAnt>0?`<span style="font-size:10px;color:var(--txt3)">${fmtN(promAnt)} uds/día</span><span style="font-size:13px;font-weight:800;color:${varCol}">${varTxt}</span>`:'<span style="font-size:10px;color:var(--txt3)">Sin datos anteriores</span>'}
        </div>
      </div>
      ${pctMes>=100?'<div style="margin-top:10px;text-align:center;font-size:12px;color:#2ECC8A;font-weight:700">🏆 ¡Meta mensual completada!</div>':''}
    </div>

    <!-- KPIs 3 columnas -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
      <div style="background:var(--card);border:1px solid #3B8FFF33;border-radius:var(--r);padding:11px 12px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:#60B0FF;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Maletas</div>
        <div style="font-size:20px;font-weight:800;color:var(--txt)">${fmtN(g.maleta)}</div>
        <div style="font-size:9px;color:var(--txt3)">${g.total>0?Math.round(g.maleta/g.total*100):0}%</div>
      </div>
      <div style="background:var(--card);border:1px solid #2ECC8A33;border-radius:var(--r);padding:11px 12px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:#2ECC8A;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">No maleta</div>
        <div style="font-size:20px;font-weight:800;color:var(--txt)">${fmtN(g.linea)}</div>
        <div style="font-size:9px;color:var(--txt3)">${g.total>0?Math.round(g.linea/g.total*100):0}%</div>
      </div>
      <div style="background:var(--card);border:1px solid #9A88FF33;border-radius:var(--r);padding:11px 12px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:#9A88FF;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Insumos</div>
        <div style="font-size:20px;font-weight:800;color:var(--txt)">${fmtN(g.insumo)}</div>
        <div style="font-size:9px;color:var(--txt3)">${g.total>0?Math.round(g.insumo/g.total*100):0}%</div>
      </div>
    </div>

    <!-- Mejor día destacado -->
    ${maxDia>0?`<div style="background:linear-gradient(135deg,#1A1000,#0F1E35);border:1px solid #FFBA4D44;border-radius:var(--r);padding:14px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:10px;font-weight:700;color:#FFBA4D;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">🏆 Mejor día del mes</div>
        <div style="font-size:13px;color:var(--txt2)">${fmtFecha(mejorFecha)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:32px;font-weight:900;color:#FFBA4D;line-height:1">${fmtN(maxDia)}</div>
        <div style="font-size:10px;color:var(--txt3)">unidades</div>
      </div>
    </div>`:''}

    <!-- Evolución del mes -->
    <div class="card">
      <div class="card-title" style="margin-bottom:.85rem">Evolución del mes</div>
      ${renderBarChart(gf,true)}
    </div>`;

  }catch(e){el.innerHTML='<div class="empty">Error: '+e.message+'</div>'}
}

function exportMiMesPDF(){
  if(!mesMiCache || !mesMiCache.rows || !mesMiCache.rows.length){toast('Primero selecciona un mes');return}
  const {rows,ms}=mesMiCache;
  const g=groupByTipo(rows);
  const gf=groupByFecha(rows);
  const dias=Object.keys(gf).length;
  const meta=META[cUser]||0;
  const prom=dias>0?Math.round(g.total/dias):0;
  const metaMes=meta*dias;
  const pct=metaMes>0?Math.round(g.total/metaMes*100)+'%':'—';
  const nombre=DB[cUser]||cUser;
  const mesLabel=fmtMes(ms);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W=210;

  // Fondo navy
  doc.setFillColor(13,27,46); doc.rect(0,0,W,297,'F');
  doc.setFillColor(21,37,66); doc.rect(0,0,W,42,'F');
  doc.setDrawColor(59,143,255); doc.setLineWidth(0.5); doc.line(0,42,W,42);

  // Header
  doc.setFont('helvetica','bold'); doc.setFontSize(18);
  doc.setTextColor(255,255,255); doc.text('SAMSONITE', 14, 16);
  doc.setFontSize(9); doc.setTextColor(138,174,212);
  doc.text('CD Lo Boza · Mi Productividad', 14, 23);
  doc.setFontSize(13); doc.setTextColor(59,143,255);
  doc.text('Resumen Personal · '+mesLabel, 14, 33);
  const ahora=new Date().toLocaleString('es-CL',{day:'2-digit',month:'short',year:'numeric'});
  doc.setFontSize(8); doc.setTextColor(77,122,170);
  doc.text('Generado: '+ahora, W-14, 16, {align:'right'});
  doc.setFontSize(11); doc.setTextColor(255,255,255);
  doc.text(nombre, W-14, 25, {align:'right'});
  doc.setFontSize(9); doc.setTextColor(138,174,212);
  doc.text(dias+' días trabajados', W-14, 33, {align:'right'});

  // KPIs resumen
  let y=52;
  const kpis=[
    ['Total mes', fmtN(g.total)+' uds', [59,143,255]],
    ['% Cumplimiento', pct, pct!=='—'&&parseInt(pct)>=100?[62,201,126]:parseInt(pct)>=70?[255,184,77]:[255,90,90]],
    ['Promedio diario', fmtN(prom)+' uds', [138,174,212]],
    ['Maletas', fmtN(g.maleta)+' uds', [59,143,255]],
    ['No maleta', fmtN(g.linea)+' uds', [62,201,126]],
    ['Insumo', fmtN(g.insumo)+' uds', [165,148,255]],
  ];
  const colW=59, cols=3;
  kpis.forEach(([lbl,val,color],i)=>{
    const col=i%cols, row=Math.floor(i/cols);
    const x=14+col*colW, ky=y+row*22;
    doc.setFillColor(21,37,66); doc.setDrawColor(...color);
    doc.setLineWidth(0.3); doc.roundedRect(x,ky,colW-4,18,2,2,'FD');
    doc.setFontSize(7.5); doc.setTextColor(138,174,212);
    doc.text(lbl.toUpperCase(), x+4, ky+6);
    doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.setTextColor(...color); doc.text(val, x+4, ky+14);
    doc.setFont('helvetica','normal');
  });

  // Tabla días
  y+=52;
  const diasEntries=Object.entries(gf).sort((a,b)=>a[0].localeCompare(b[0]));
  doc.autoTable({
    startY: y,
    head:[['Fecha','Total','Maletas','No Maleta','Insumo','vs Meta']],
    body: diasEntries.map(([f,d])=>{
      const pctDia=meta>0?Math.round(d.total/meta*100)+'%':'—';
      return[fmtFecha(f), fmtN(d.total), fmtN(d.maleta||0), fmtN(d.linea||0), fmtN(d.insumo||0), pctDia];
    }),
    theme:'plain',
    styles:{font:'helvetica',fontSize:8.5,cellPadding:2.5,textColor:[232,241,255],fillColor:[21,37,66],lineColor:[30,58,95],lineWidth:0.3},
    headStyles:{fillColor:[13,27,46],textColor:[59,143,255],fontStyle:'bold',fontSize:8},
    alternateRowStyles:{fillColor:[14,30,52]},
    columnStyles:{
      0:{cellWidth:28},1:{cellWidth:22,halign:'right',fontStyle:'bold'},
      2:{cellWidth:22,halign:'right'},3:{cellWidth:25,halign:'right'},
      4:{cellWidth:20,halign:'right'},5:{cellWidth:20,halign:'right'}
    },
    didParseCell(data){
      if(data.section==='body'&&data.column.index===5){
        const v=parseInt(data.cell.raw)||0;
        if(v>=100) data.cell.styles.textColor=[62,201,126];
        else if(v>=70) data.cell.styles.textColor=[255,184,77];
        else if(v>0) data.cell.styles.textColor=[255,90,90];
      }
    },
    margin:{left:14,right:14}
  });

  const finalY=doc.lastAutoTable.finalY+8;
  doc.setDrawColor(30,58,95); doc.setLineWidth(0.4);
  doc.line(14,finalY,W-14,finalY);
  doc.setFontSize(7.5); doc.setTextColor(77,122,170);
  doc.text('Samsonite Chile · CD Lo Boza · Mi Productividad', W/2, finalY+6, {align:'center'});

  doc.save('mi_productividad_'+nombre.split(' ')[0]+'_'+ms+'.pdf');
  toast('✓ Tu resumen PDF generado');
}

let supSemCache=[];
async function loadSupSemana(){
  const ws=document.getElementById('sup-semana').value;
  if(!ws){toast('Selecciona una semana');return}
  const supSemWs=ws;
  clearCaches();
  const [desde,hasta]=weekRange(ws);
  const rows=await fetchProdAll(desde,hasta);
  supSemCache=rows;

  // KPIs generales
  const gf=groupByFecha(rows);
  const dias=Object.keys(gf).length;
  const tot=rows.filter(r=>r.tipo!=='insumo').reduce((s,r)=>s+r.cantidad,0);
  const gu0={}; rows.forEach(r=>{if(r.tipo!=='insumo')gu0[r.usuario]=(gu0[r.usuario]||0)+r.cantidad;});
  const nopSem=Object.keys(gu0).length;
  const promOpSem=nopSem>0?Math.round(tot/nopSem):0;
  const diasVals=Object.values(gf).map(d=>d.total);
  const mejorDiaSem=diasVals.length?Math.max(...diasVals):0;
  const menorDiaSem=diasVals.length?Math.min(...diasVals):0;
  const mejorFechaSem=Object.entries(gf).find(([,d])=>d.total===mejorDiaSem)?.[0]||'';
  const menorFechaSem=Object.entries(gf).find(([,d])=>d.total===menorDiaSem)?.[0]||'';
  // Hero
  document.getElementById('sup-sem-dias').textContent=dias||'—';
  document.getElementById('sup-sem-tot').textContent=fmtN(tot);
  document.getElementById('sup-sem-prom').textContent=dias>0?fmtN(Math.round(tot/dias)):'—';
  const semHeroEl=document.getElementById('sup-sem-hero');
  if(semHeroEl){ semHeroEl.style.display='block'; }
  const semLblEl=document.getElementById('sup-sem-hero-label');
  if(semLblEl){ semLblEl.textContent='Semana '+supSemWs.replace('-W',' · W'); }
  // Fila ritmo
  const semRitmoEl=document.getElementById('sup-sem-ritmo');
  if(semRitmoEl && dias>0){
    semRitmoEl.style.display='block';
    document.getElementById('sup-sem-mejor-val').textContent=fmtN(mejorDiaSem);
    document.getElementById('sup-sem-mejor-lbl').textContent=mejorFechaSem?fmtFecha(mejorFechaSem).slice(0,5):'';
    document.getElementById('sup-sem-menor-val').textContent=fmtN(menorDiaSem);
    document.getElementById('sup-sem-menor-lbl').textContent=menorFechaSem?fmtFecha(menorFechaSem).slice(0,5):'';
    document.getElementById('sup-sem-nop').textContent=nopSem;
    document.getElementById('sup-sem-promop').textContent=fmtN(promOpSem);
  }

  if(!rows.length){toast('Sin datos para esta semana');return}

  // Canal
  const canal={};
  rows.forEach(r=>{if(r.tipo!=='insumo'){const c=(r.canal||'Sin canal').toString().trim();canal[c]=(canal[c]||0)+r.cantidad;}});
  const CANAL_COLORS={'OFFLINE':'#3B8FFF','ONLINE':'#3EC97E','Sin canal':'#4D7AAA'};
  const canalEntries=Object.entries(canal).sort((a,b)=>b[1]-a[1]);
  document.getElementById('sup-sem-canales').innerHTML=canalEntries.map(([nombre,uds])=>{
    const pct=tot>0?Math.round(uds/tot*100):0;
    const color=CANAL_COLORS[nombre.toUpperCase()]||CANAL_COLORS['Sin canal'];
    return`<div class="kpi" style="border-color:${color}22;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;width:${pct}%;height:3px;background:${color}"></div>
      <div class="lbl" style="color:${color}">${nombre}</div>
      <div class="val">${fmtN(uds)}</div>
      <div class="sub">${pct}% del total</div>
    </div>`;
  }).join('');
  document.getElementById('sup-sem-canales-card').style.display=canalEntries.length?'block':'none';

  // Tipo
  const g=groupByTipo(rows);
  const tipoEl=document.getElementById('sup-sem-tipos');
  tipoEl.innerHTML=renderTipoBars(g);
  document.getElementById('sup-sem-tipos-card').style.display='block';

  // Días chart
  const diasChart=document.getElementById('sup-sem-dias-chart');
  const DIAS_SEMANA=['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
  const entries=Object.entries(gf).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxDay=Math.max(...entries.map(([,d])=>d.total))||1;
  diasChart.innerHTML=entries.map(([f,d])=>{
    const wd=new Date(f+'T12:00:00').getDay();
    const dia=DIAS_SEMANA[(wd+6)%7];
    const pct=Math.round(d.total/maxDay*100);
    return`<div class="week-row">
      <div class="week-day">${dia}</div>
      <div class="week-bar-wrap"><div class="week-bar-fill" style="width:${pct}%"></div></div>
      <div class="week-val">${fmtN(d.total)}</div>
      <div class="week-prom">${fmtFecha(f).slice(0,5)}</div>
    </div>`;
  }).join('');
  document.getElementById('sup-sem-dias-card').style.display='block';

  // Ranking acumulado semana
  const gu={};
  rows.forEach(r=>{
    if(!gu[r.usuario])gu[r.usuario]={total:0};
    gu[r.usuario].total+=r.cantidad;
  });
  const sortedU=Object.entries(gu).sort((a,b)=>b[1].total-a[1].total);
  const maxU=sortedU[0]?.[1].total||1;
  const rnkEl=document.getElementById('sup-sem-ranking');
  rnkEl.innerHTML=sortedU.map(([uid,d],i)=>{
    const nombre=DB[uid]?nombreCorto(DB[uid]):uid;
    const metaSem=(META[uid]||0)*dias;
    const pct=metaSem>0?Math.round(d.total/metaSem*100):null;
    const barCol=pct===null?'#3B8FFF':pct>=100?'#2ECC8A':pct>=70?'#FFBA4D':'#EF4444';
    const semCol=pct===null?'#8AAED4':pct>=100?'#2ECC8A':pct>=70?'#FFBA4D':'#EF4444';
    const pillBg=pct===null?'rgba(138,174,212,.12)':pct>=100?'rgba(46,204,138,.12)':pct>=70?'rgba(255,186,77,.12)':'rgba(239,68,68,.12)';
    const pillBd=pct===null?'rgba(138,174,212,.3)':pct>=100?'rgba(46,204,138,.3)':pct>=70?'rgba(255,186,77,.3)':'rgba(239,68,68,.3)';
    return`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">`
      +`<div style="width:22px;height:22px;border-radius:50%;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--txt3);flex-shrink:0">${i+1}</div>`
      +`<div style="flex:1;min-width:0">`
      +`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">`
      +`<span style="font-size:12px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nombre}</span>`
      +`<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">`
      +`<span style="font-size:12px;font-weight:700;color:var(--txt)">${fmtN(d.total)}</span>`
      +(pct!==null?`<span style="font-size:9px;font-weight:700;color:${semCol};background:${pillBg};border:1px solid ${pillBd};padding:1px 6px;border-radius:10px">${pct}%</span>`:'')
      +`</div></div>`
      +`<div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden">`
      +`<div style="height:100%;width:${Math.round(d.total/maxU*100)}%;background:${barCol};border-radius:3px;transition:width .5s ease"></div></div>`
      +`</div></div>`;
  }).join('');
  document.getElementById('sup-sem-ranking-card').style.display='block';
}

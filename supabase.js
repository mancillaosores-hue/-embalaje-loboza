/**
 * plan.js
 * ─────────────────────────────────────────────────────────────
 * Plan semanal supervisor: carga y renderizado del backlog de
 * entregas, avance de arrastre S-1, cumplimiento por canal,
 * tipo de material, gráfico de tendencia diaria, selector de
 * día y exportación PDF del plan.
 *
 * Dependencias : config.js, supabase.js, helpers.js, ui.js
 * Exporta (global): cargarPlanSemanal, cargarPlanCompacto,
 *   _renderFromCache, invalidarPlanCache, renderResumenEjecutivo,
 *   renderEstadoOperacional, renderPlanTrendChart,
 *   renderSelectorDia, seleccionarDiaPlan, loadDia,
 *   navegarSemana, buildTipoDetalle, _getPlanEl, exportarPlanPDF
 * ─────────────────────────────────────────────────────────────
 */

// Usar el elemento cuya pantalla padre esté activa (.on)
  const scGer = document.getElementById('sc-ger');
  if(scGer && scGer.classList.contains('on')) return gerEl || supEl;
  return supEl || gerEl;
}

async function cargarPlanSemanal(){
  const CANALES_OFFLINE = ['Locales','Concesiones','Grandes Tiendas','Distribuidor'];
  const CANALES_ONLINE  = ['Ecommerce','Marketplace','Venta en verde'];

  // Actualizar estado del botón siguiente
  const btnNext = _getPlanEl('plan-btn-next');
  if(btnNext) btnNext.disabled = planSemActual >= isoWeekActual();

  const anio = new Date().getFullYear();

  // ── Usar caché si existe para esta semana ──
  if(_planCache.sem === planSemActual && _planCache.anio === anio && _planCache.planRaw){
    _renderFromCache();
    return;
  }

  const {lun, vie} = isoSemanaAFechas(anio, planSemActual);

  // Fecha local (evita desfase UTC en Chile UTC-4)
  function fechaLocalStr(d){
    const yy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
    return `${yy}-${mm}-${dd}`;
  }
  const hoyLocal = fechaLocalStr(new Date());
  const domLocal = fechaLocalStr(vie); // vie en isoSemanaAFechas = domingo
  const lunLocal = fechaLocalStr(lun);
  const fLun     = lunLocal;

  // viernes = lun + 4 días (para cálculos de producción y ritmo)
  const vieObj   = new Date(lun.getFullYear(), lun.getMonth(), lun.getDate()+4);
  const vieLocal = fechaLocalStr(vieObj);
  const fHasta         = hoyLocal <= vieLocal ? hoyLocal : vieLocal; // prod: máx viernes
  const fHastaEntregas = hoyLocal <= domLocal ? hoyLocal : domLocal; // entregas: máx domingo

  // Para comparar días hábiles
  const hoy      = new Date(hoyLocal+'T12:00:00');
  const hoyDate  = hoy;
  const vieDate  = vieObj;
  const hasta    = hoyDate < vieDate ? hoyDate : vieDate;

  const diasSem    = diasHabileSem(lun, vieObj, null);    // lun-vie para ritmo y gráfico
  const diasHasta  = diasHabileSem(lun, vieObj, hasta);

  // Limpiar contenedores antes de re-render (evita acumulación)
  ['plan-estado-operacional','plan-avance-diario','plan-tabla-canal','plan-tipo-material','plan-grafico-diario'].forEach(id=>{
    const el=_getPlanEl(id);
    if(el) el.innerHTML='<div class="loading"><span class="spinner"></span>Cargando...</div>';
  });

  // Actualizar header
  _getPlanEl('plan-sem-titulo').textContent = `Semana ${planSemActual}`;
  _getPlanEl('plan-sem-rango').textContent  =
    `${fmtFechaCL(lun)} al ${fmtFechaCL(vie)} (L-D)`;

  // ── Renderizar selector de día (L-M-M-J-V-S-D) ──
  renderSelectorDia(lun, hoyLocal);

  // ── Actualizar títulos de cards según filtro de día ──
  const sufijoTitulo = planDiaActual ? ' (acumulado al día)' : '';
  const elTC = _getPlanEl('titulo-cumplimiento-canal'); if(elTC) elTC.textContent = 'Cumplimiento por canal'+sufijoTitulo;
  const elPE = document.getElementById('titulo-pendiente-embalar'); if(elPE) elPE.textContent = (planDiaActual?'Pendiente por embalar (acumulado al día)':'Pendiente por embalar (de lo cargado)');
  const elTM = _getPlanEl('titulo-tipo-material'); if(elTM) elTM.textContent = 'Tipo de material'+sufijoTitulo;

  // ── Fetch plan + producción + entregas en paralelo ──
  try {
  const hdr = {headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}};
  const [resPlan, resProd0, resEntregas0] = await Promise.all([
    fetch(`${SUPA_URL}/rest/v1/plan_carga?select=canal,tipo,unidades_plan&semana_iso=eq.${planSemActual}&anio=eq.${anio}`, hdr),
    fetch(`${SUPA_URL}/rest/v1/produccion?select=usuario,canal,tipo,cantidad,fecha,entrega&fecha=gte.${fLun}&fecha=lte.${fHasta}&canal=neq.Anulada&canal=neq.BTS&canal=neq.Regula&tipo=neq.insumo&order=fecha.asc,id.asc&limit=1000&offset=0`, hdr),
    fetch(`${SUPA_URL}/rest/v1/entregas_carga?select=canal,tipo_producto,cantidad,fecha_carga&fecha_carga=gte.${fLun}&fecha_carga=lte.${fHastaEntregas}&limit=1000&offset=0`, hdr)
  ]);
  const planRaw = await resPlan.json();
  if(!resPlan.ok) throw new Error(`plan_carga HTTP ${resPlan.status}: ${JSON.stringify(planRaw)}`);
  const pg0     = await resProd0.json();
  if(!resProd0.ok) throw new Error(`produccion HTTP ${resProd0.status}: ${JSON.stringify(pg0)}`);
  // Paginar entregas igual que produccion
  let entregasRaw = resEntregas0.ok ? await resEntregas0.json() : [];
  if(Array.isArray(entregasRaw) && entregasRaw.length === 1000){
    let offE = 1000;
    while(true){
      const re = await fetch(`${SUPA_URL}/rest/v1/entregas_carga?select=canal,tipo_producto,cantidad,fecha_carga&fecha_carga=gte.${fLun}&fecha_carga=lte.${fHastaEntregas}&limit=1000&offset=${offE}`, hdr);
      const pe = re.ok ? await re.json() : [];
      if(!Array.isArray(pe)||!pe.length) break;
      entregasRaw = entregasRaw.concat(pe);
      if(pe.length < 1000) break;
      offE += 1000;
    }
  }

  // ── Guardar copia completa de la semana (para gráfico diario y entregasPorFecha) ──
  const entregasRawSemana = entregasRaw;
  // Si hay un día específico filtrado, usar el ACUMULADO desde el lunes hasta ese día (corte acumulado, no día aislado)
  const entregasRawCanal = planDiaActual
    ? entregasRaw.filter(r => ((r.fecha_carga||'').toString().trim().slice(0,10)) <= planDiaActual)
    : entregasRaw;

  // Agrupar entregas por canal y tipo (excluir insumos igual que produccion)
  const entregasPorCanal = {};
  const entregasPorTipo = {linea:0, maleta:0};
  const entregasPorFecha = {};
  let totalEntregas = 0;
  (Array.isArray(entregasRawCanal)?entregasRawCanal:[]).forEach(r=>{
    const tp = (r.tipo_producto||'').toString().trim().toLowerCase();
    if(tp === 'insumo') return; // excluir insumos de los KPIs
    const c = (r.canal||'').toString().trim();
    const cLow = c.toLowerCase();
    if(cLow === 'anulada' || cLow === 'regula' || cLow === 'bts') return; // excluir anuladas, regularizaciones y BTS
    const q = Number(r.cantidad)||0;
    entregasPorCanal[c] = (entregasPorCanal[c]||0) + q;
    totalEntregas += q;
    // Por tipo (maleta / no maleta → linea)
    if(tp === 'maleta') entregasPorTipo.maleta += q;
    else entregasPorTipo.linea += q;
  });
  // entregasPorFecha SIEMPRE usa la semana completa (para el gráfico de barras diario)
  (Array.isArray(entregasRawSemana)?entregasRawSemana:[]).forEach(r=>{
    const tp = (r.tipo_producto||'').toString().trim().toLowerCase();
    if(tp === 'insumo') return;
    const cLow = (r.canal||'').toString().trim().toLowerCase();
    if(cLow === 'anulada' || cLow === 'regula' || cLow === 'bts') return;
    const fc = (r.fecha_carga||'').toString().trim().slice(0,10);
    if(fc) entregasPorFecha[fc] = (entregasPorFecha[fc]||0) + (Number(r.cantidad)||0);
  });
  const totalCarg = totalEntregas; // alias temprano para uso en métricas

  // ── Backlog REAL por entrega individual ──
  // Definicion exacta: entrega cargada en semana N pero embalada en semana N+1 o posterior
  // Cruce: entregas_carga.identrega = produccion.entrega
  // Para cada entrega cargada ANTES de esta semana:
  //   - Si produccion.fecha >= fLun  →  se esta embalando como backlog esta semana (backlogConsumido)
  //   - Si no tiene registro en produccion aun  →  backlog pendiente sin embalar
  //   - Si produccion.fecha < fLun  →  embalada en su propia semana, no es backlog
  const FECHA_INICIO_CARGA = '2026-06-01';
  var backlogPorCanal = {};  // { canal: { pendiente, consumido, cargado } }
  var totalBacklog = 0;
  var semAntLabel  = '';
  var _idsSAnt     = new Set();
  try{
    if(fLun > FECHA_INICIO_CARGA){

      var _lunAnt = new Date(lun); _lunAnt.setDate(_lunAnt.getDate()-7);
      semAntLabel = fmtFechaCL(_lunAnt) + ' – ' + fmtFechaCL(new Date(lun.getTime()-86400000));

      var _lunAnt = new Date(lun); _lunAnt.setDate(_lunAnt.getDate()-7);
      var _domAnt = new Date(lun); _domAnt.setDate(_domAnt.getDate()-1);
      var fLunAnt = fechaLocalStr(_lunAnt);
      var fDomAnt = fechaLocalStr(_domAnt);
      semAntLabel = fmtFechaCL(_lunAnt) + ' – ' + fmtFechaCL(_domAnt);

      var _bkRes = await Promise.all([
        // Entregas S-1 — excluir insumos en el filtro de cantidad > 0
        sbFetchAll('entregas_carga?select=id_entrega,fecha_creada,cantidad,tipo_producto,canal,clientenombre,ruta&fecha_creada=gte.'+fLunAnt+'&fecha_creada=lte.'+fDomAnt+'&order=id_entrega.asc'),
        // Lo que se embaló EN S-1 (para descontar del arrastre inicial)
        sbFetchAll('produccion?select=entrega,cantidad,usuario&fecha=gte.'+fLunAnt+'&fecha=lte.'+fDomAnt+'&canal=neq.Anulada&canal=neq.BTS&canal=neq.Regula&tipo=neq.insumo&order=id.asc'),
        // Producción de esta semana
        sbFetchAll('produccion?select=entrega,cantidad,usuario,fecha,canal&fecha=gte.'+fLun+'&fecha=lte.'+vieLocal+'&canal=neq.Anulada&canal=neq.BTS&canal=neq.Regula&tipo=neq.insumo&order=id.asc')
      ]);

      var entregasAnt = _bkRes[0]||[];
      var prodSemAnt  = _bkRes[1]||[];  // embalado en S-1
      var prodEstaSem = _bkRes[2]||[];

      // PASO 1: Agrupar entregas_carga por id_entrega — excluir insumos, anuladas, regula, bts
      var _excCanal = {anulada:1, regula:1, bts:1};
      var mapEntregas = {};
      entregasAnt.forEach(function(r){
        var id  = (r.id_entrega||'').toString().trim();
        var qty = Number(r.cantidad)||0;
        if(!id || !qty) return;
        if((r.tipo_producto||'').toLowerCase().trim() === 'insumo') return;
        if(_excCanal[(r.canal||'').toLowerCase().trim()]) return;
        // Excluir rutas SSTT y REGULA
        var _rutaUp = (r.ruta||'').toUpperCase().trim();
        if(_rutaUp.includes('SSTT') || _rutaUp === 'REGULA') return;
        // Excluir clientes especiales de Venta en Verde que no pasan por flujo de embalaje
        var _cliExcVEV = ['COMERCIALIZADORA S.A. CD','LA POLAR NUEVO CD'];
        if(_cliExcVEV.indexOf((r.clientenombre||'').trim().toUpperCase()) !== -1 && (r.canal||'').toLowerCase().trim() === 'venta en verde') return;
        if(!mapEntregas[id]) mapEntregas[id] = { fecha_creada:(r.fecha_creada||'').slice(0,10), total_cargado:0, canal:'', clientenombre:'', ruta:'' };
        mapEntregas[id].total_cargado += qty;
        if(!mapEntregas[id].canal && r.canal) mapEntregas[id].canal = r.canal;
        if(!mapEntregas[id].clientenombre && r.clientenombre) mapEntregas[id].clientenombre = r.clientenombre;
        if(!mapEntregas[id].ruta && r.ruta) mapEntregas[id].ruta = r.ruta;
      });

      // Embalado EN S-1 por entrega (para calcular arrastre real)
      var embalEnSAnt = {};
      prodSemAnt.forEach(function(r){
        if(DB[r.usuario]===undefined) return;
        var id = (r.entrega||'').toString().trim();
        if(!id) return;
        embalEnSAnt[id] = (embalEnSAnt[id]||0) + (Number(r.cantidad)||0);
      });

      // PASO 2: Embalado esta semana por entrega + acumular por fecha
      var embalEstaSemXEnt = {};
      var embalBackXFecha  = {};
      var embalTotalXFecha = {};
      var canalXEntrega    = {};
      var embalBackXFechaXCanal = {}; // { fecha: { canal: qty } } — para filtro por día por canal

      prodEstaSem.forEach(function(r){
        if(DB[r.usuario]===undefined) return;
        var id  = (r.entrega||'').toString().trim();
        var qty = Number(r.cantidad)||0;
        var f   = (r.fecha||'').slice(0,10);
        if(!qty || !f) return;
        embalTotalXFecha[f] = (embalTotalXFecha[f]||0) + qty;
        if(!id) return;
        if(r.canal && !canalXEntrega[id]) canalXEntrega[id] = r.canal;
        embalEstaSemXEnt[id] = (embalEstaSemXEnt[id]||0) + qty;
        if(mapEntregas[id]){
          embalBackXFecha[f] = (embalBackXFecha[f]||0) + qty;
          var canal = r.canal || canalXEntrega[id] || 'Sin canal';
          if(!embalBackXFechaXCanal[f]) embalBackXFechaXCanal[f]={};
          embalBackXFechaXCanal[f][canal] = (embalBackXFechaXCanal[f][canal]||0) + qty;
        }
      });

      // PASO 3: pendiente_inicio = cargado - embalado_en_S1 (arrastre real al inicio de esta semana)
      // consumido = lo absorbido esta semana de ese arrastre
      var tablaAuditoria = [];
      Object.keys(mapEntregas).forEach(function(id){
        var ent        = mapEntregas[id];
        var carg       = ent.total_cargado;
        var embalSAnt  = Math.min(embalEnSAnt[id]||0, carg);
        var pendInicio = Math.max(carg - embalSAnt, 0);
        if(pendInicio <= 0) return; // completamente embalado en su propia semana

        _idsSAnt.add(id);
        var embalEsta  = Math.min(embalEstaSemXEnt[id]||0, pendInicio);
        var pendActual = Math.max(pendInicio - embalEsta, 0);
        var canal      = canalXEntrega[id] || (ent.canal||'') || 'Sin canal';

        if(!backlogPorCanal[canal]) backlogPorCanal[canal]={cargado:0,pendiente:0,consumido:0};
        backlogPorCanal[canal].cargado   += pendInicio;  // arrastre inicial real
        backlogPorCanal[canal].consumido += embalEsta;
        backlogPorCanal[canal].pendiente += pendActual;

        tablaAuditoria.push({ id_entrega:id, fecha_creada:ent.fecha_creada,
          total_cargado:carg, embal_en_s1:embalSAnt, pend_inicio:pendInicio,
          embal_esta_sem:embalEsta, pendiente:pendActual, canal:canal,
          clientenombre:ent.clientenombre||'', ruta:ent.ruta||'' });
      });

      Object.keys(backlogPorCanal).forEach(function(c){ totalBacklog += backlogPorCanal[c].pendiente; });

      // PASO 5: Ajuste de embalBackXFecha para que sume exactamente arrastreConsumido
      var _arrCons = Object.keys(backlogPorCanal).reduce(function(s,c){ return s+(backlogPorCanal[c].consumido||0); }, 0);
      var _sumBkF  = Object.keys(embalBackXFecha).reduce(function(s,f){ return s+embalBackXFecha[f]; }, 0);
      var _dif     = _arrCons - _sumBkF;
      if(Math.abs(_dif) > 0){
        var _totF = Object.keys(embalTotalXFecha).reduce(function(s,f){ return s+embalTotalXFecha[f]; }, 0);
        if(_totF > 0){
          var _acF=0, _fdsF=Object.keys(embalTotalXFecha).sort();
          _fdsF.forEach(function(f,i){
            var q=(i===_fdsF.length-1)?_dif-_acF:Math.round(_dif*embalTotalXFecha[f]/_totF);
            q=Math.max(q,-(embalBackXFecha[f]||0));
            q=Math.min(q, embalTotalXFecha[f]-(embalBackXFecha[f]||0));
            embalBackXFecha[f]=(embalBackXFecha[f]||0)+q; _acF+=q;
          });
        }
      }
      _planCache.embalBackPorFecha       = embalBackXFecha;
      _planCache.embalBackPorFechaCanal  = embalBackXFechaXCanal;
      _planCache._arrConsumidoParaBack   = _arrCons;
      _planCache.tablaAuditoria       = tablaAuditoria;
    }
  }catch(e){ console.warn('backlog error:',e.message); }
  let prodRaw   = Array.isArray(pg0) ? [...pg0] : [];
  if(prodRaw.length === 1000){
    let offset = 1000;
    while(true){
      const rp  = await fetch(`${SUPA_URL}/rest/v1/produccion?select=usuario,canal,tipo,cantidad,fecha,entrega&fecha=gte.${fLun}&fecha=lte.${fHasta}&canal=neq.Anulada&canal=neq.BTS&canal=neq.Regula&tipo=neq.insumo&order=fecha.asc,id.asc&limit=1000&offset=${offset}`, hdr);
      const pg  = await rp.json();
      if(!Array.isArray(pg)||!pg.length) break;
      prodRaw   = prodRaw.concat(pg);
      if(pg.length < 1000) break;
      offset   += 1000;
    }
  }

  // ── Guardar datos crudos en caché ──
  // arrastreInicial: calculado desde backlogPorCanal (ya completo con order=id.asc — determinista)
  var _lsKey = 'arr_ini_' + anio + '_s' + planSemActual;
  var _arrIniCalculado = Object.keys(backlogPorCanal).reduce(function(s,c){
    return s + (backlogPorCanal[c].pendiente||0) + (backlogPorCanal[c].consumido||0);
  }, 0);
  try { if(_arrIniCalculado > 0) localStorage.setItem(_lsKey, String(_arrIniCalculado)); } catch(e){}
  _planCache.arrastreInicial = _arrIniCalculado;

  _planCache.sem            = planSemActual;
  _planCache.anio           = anio;
  _planCache.planRaw        = planRaw;
  _planCache.prodRawSemana  = prodRaw;
  _planCache.entregasRawSemana = entregasRawSemana;
  _planCache.backlogPorCanal= backlogPorCanal;
  _planCache.semAntLabel    = semAntLabel;
  _planCache.diasSem        = diasSem;
  _planCache.lunObj         = lun;
  _planCache.vieObj         = vieObj;
  _planCache.domObj         = vie;
  _planCache.idEntregasSAnt = _idsSAnt;
  _renderFromCache();

  } catch(e) {
    // Diagnóstico visible en pantalla (sin consola)
    let debugInfo = '';
    try {
      debugInfo += 'SUPA_URL: ' + (typeof SUPA_URL !== 'undefined' ? SUPA_URL : 'UNDEFINED') + '\n';
      debugInfo += 'SUPA_KEY: ' + (typeof SUPA_KEY !== 'undefined' ? SUPA_KEY.slice(0,12)+'...' : 'UNDEFINED') + '\n';
      debugInfo += 'planSemActual: ' + planSemActual + '\n';
      debugInfo += 'semCalc (isoWeekActual): ' + isoWeekActual() + '\n';
      debugInfo += 'anio: ' + (typeof anio !== 'undefined' ? anio : new Date().getFullYear()) + '\n';
      debugInfo += 'hoyLocal: ' + (typeof hoyLocal !== 'undefined' ? hoyLocal : new Date().toLocaleDateString('sv')) + '\n';
      debugInfo += 'fLun: ' + (typeof fLun !== 'undefined' ? fLun : 'UNDEFINED') + '\n';
      debugInfo += 'fHasta: ' + (typeof fHasta !== 'undefined' ? fHasta : 'UNDEFINED') + '\n';
      debugInfo += 'vieLocal: ' + (typeof vieLocal !== 'undefined' ? vieLocal : 'UNDEFINED') + '\n';
    } catch(ex){ debugInfo += '(error al leer vars: '+ex.message+')'; }

    const errMsg = `<div style="background:#1A0A0A;border:1px solid #FF4444;border-radius:8px;padding:12px;font-size:11px;font-family:monospace;color:#FF8080;line-height:1.6">
      <div style="font-weight:700;font-size:13px;color:#FF4444;margin-bottom:8px">⚠️ Error en tab Plan</div>
      <div style="color:#FFB080;margin-bottom:6px"><strong>Mensaje:</strong> ${e.message||'(sin mensaje)'}</div>
      <div style="color:#FFB080;margin-bottom:6px"><strong>Tipo:</strong> ${e.name||'Error'}</div>
      <div style="color:#8AAED4;white-space:pre-wrap;margin-top:8px;border-top:1px solid #3A1A1A;padding-top:8px">${debugInfo}</div>
    </div>`;

    const el0 = _getPlanEl('plan-tabla-canal');
    if(el0) el0.innerHTML = errMsg;
    ['plan-tipo-material','plan-grafico-diario'].forEach(id=>{
      const el=_getPlanEl(id);
      if(el) el.innerHTML='<div style="font-size:11px;color:var(--txt3);padding:8px">Ver detalle arriba ↑</div>';
    });
  }
}

function dhW(a,b){let n=0,d=new Date(a+'T12:00:00'),f=new Date(b+'T12:00:00');while(d<=f){n++;d.setDate(d.getDate()+1);}return n;}

function diasHabileSem(lun, vie, hastaDate){
  // Solo días hábiles lun-vie (para ritmo, meta, cálculos de producción)
  const dias=[], nombres=['Lun','Mar','Mié','Jue','Vie'];
  const hastaStr = hastaDate ? fechaLocalStr(hastaDate) : null;
  for(let i=0;i<5;i++){
    const d=new Date(lun.getFullYear(), lun.getMonth(), lun.getDate()+i);
    const fStr=fechaLocalStr(d);
    if(!hastaStr || fStr<=hastaStr) dias.push({fecha:fStr, nombre:nombres[i]});
  }
  return dias;
}

async function exportarPlanPDF(){
  const CANALES_OFFLINE = ['Locales','Concesiones','Grandes Tiendas','Distribuidor'];
  const CANALES_ONLINE  = ['Ecommerce','Marketplace','Venta en verde'];
  try{
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
  const anio = new Date().getFullYear();
  const {lun, vie} = isoSemanaAFechas(anio, planSemActual);
  // → usar fechaLocalStr() global
  const hoyL  = fechaLocalStr(new Date());
  const vieL  = fechaLocalStr(vie);
  const fLun  = fechaLocalStr(lun);
  const fHasta= hoyL < vieL ? hoyL : vieL;
  const hasta  = new Date(fHasta+'T12:00:00');

  // Fetch datos
  const resPlan = await fetch(
    `${SUPA_URL}/rest/v1/plan_carga?select=canal,tipo,unidades_plan&semana_iso=eq.${planSemActual}&anio=eq.${anio}`,
    {headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}}
  );
  const planRaw = await resPlan.json();

  let prodRaw=[], offset=0;
  while(true){
    const rp=await fetch(
      `${SUPA_URL}/rest/v1/produccion?select=canal,tipo,cantidad&fecha=gte.${fLun}&fecha=lte.${fHasta}&canal=neq.Anulada&canal=neq.BTS&canal=neq.Regula&tipo=neq.insumo&limit=1000&offset=${offset}`,
      {headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}}
    );
    const pg=await rp.json();
    if(!Array.isArray(pg)||!pg.length) break;
    prodRaw=prodRaw.concat(pg);
    if(pg.length<1000) break;
    offset+=1000;
  }

  // Calcular
  const metaCM={}, prodCM={};
  if(Array.isArray(planRaw)) planRaw.forEach(r=>{ metaCM[r.canal]=(metaCM[r.canal]||0)+Number(r.unidades_plan); });
  prodRaw.forEach(r=>{ prodCM[r.canal]=(prodCM[r.canal]||0)+Number(r.cantidad); });
  const diasSem = diasHabileSem(lun, vie, null);
  const nDiasTransc = diasHabileSem(lun, vie, hasta).length;
  const nDiasRest = diasSem.length - nDiasTransc;
  const totalPlan = Object.values(metaCM).reduce((s,v)=>s+v,0);
  const totalProd = Object.values(prodCM).reduce((s,v)=>s+v,0);
  const pctG = totalPlan>0?Math.round(totalProd/totalPlan*100):0;
  const metaDia = nDiasRest>0?Math.max(Math.round((totalPlan-totalProd)/nDiasRest),0):0;
  const ritmo = nDiasTransc>0?Math.round(totalProd/nDiasTransc):0;

  const W=210, M=14;
  let y=M;

  // Header
  doc.setFillColor(13,27,46);
  doc.rect(0,0,W,22,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(16); doc.setFont('helvetica','bold');
  doc.text('SAMSONITE · CD Lo Boza',M,10);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.setTextColor(77,122,170);
  doc.text(`Reporte Plan Semana ${planSemActual} · ${fmtFechaCL(lun)} al ${fmtFechaCL(vie)}`,M,17);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CL')}`,W-M,17,{align:'right'});
  y=30;

  // KPIs en fila
  const kpis=[
    {l:'Plan Semanal',v:fmtN(totalPlan)+' uds'},
    {l:'Embalado',v:fmtN(totalProd)+' uds'},
    {l:'Cumplimiento',v:pctG+'%'},
    {l:'Gap restante',v:fmtN(Math.max(totalPlan-totalProd,0))+' uds'},
    {l:'Meta diaria req.',v:fmtN(metaDia)+' uds'},
  ];
  const kW=(W-M*2)/kpis.length;
  kpis.forEach((k,i)=>{
    const kx=M+i*kW;
    doc.setFillColor(241,245,249);
    doc.roundedRect(kx,y,kW-2,16,2,2,'F');
    doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.setTextColor(100,116,139);
    doc.text(k.l,kx+kW/2-1,y+5,{align:'center'});
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.setTextColor(15,23,42);
    doc.text(k.v,kx+kW/2-1,y+12,{align:'center'});
  });
  y+=22;

  // Tabla canales
  doc.setFontSize(10); doc.setFont('helvetica','bold');
  doc.setTextColor(15,23,42);
  doc.text('Cumplimiento por canal',M,y); y+=4;

  const cols=['Canal','Plan S'+planSemActual,'Embalado','Cumpl.%','Gap','Estado'];
  const cW=[52,30,30,22,22,18];
  ['OFFLINE','ONLINE'].forEach(grupo=>{
    const canalesG = grupo==='OFFLINE' ? CANALES_OFFLINE : CANALES_ONLINE;
    doc.setFillColor(59,143,255);
    doc.rect(M,y,W-M*2,5,'F');
    doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.setTextColor(255,255,255);
    doc.text(grupo,M+2,y+3.5);
    y+=5;

    let subP=0, subPr=0;
    canalesG.forEach(canal=>{
      const plan=metaCM[canal]||0, prod=prodCM[canal]||0;
      if(!plan&&!prod) return;
      const gap=plan-prod, pct=plan>0?Math.round(prod/plan*100):0;
      subP+=plan; subPr+=prod;
      doc.setFillColor(248,250,252);
      doc.rect(M,y,W-M*2,5,'F');
      doc.setFontSize(7); doc.setFont('helvetica','normal');
      doc.setTextColor(51,65,85);
      let cx=M+2;
      [canal,fmtN(plan),fmtN(prod),pct+'%',(gap>0?'-':'+')+(fmtN(Math.abs(gap))),pct>=95?'OK':pct>=75?'~':'X'].forEach((v,vi)=>{
        const clrArr=vi===3||vi===4?(gap>0&&vi===4?[220,38,38]:[22,163,74]):(vi===5?(pct>=95?[22,163,74]:pct>=75?[217,119,6]:[220,38,38]):[51,65,85]); doc.setTextColor(clrArr[0],clrArr[1],clrArr[2]);
        doc.text(String(v),cx+(vi>0?cW[vi]-2:0),y+3.5,{align:vi>0?'right':'left'});
        cx+=cW[vi];
      });
      y+=5;
    });

    // Subtotal
    const subPct=subP>0?Math.round(subPr/subP*100):0;
    const subGap=subP-subPr;
    doc.setFillColor(226,232,240);
    doc.rect(M,y,W-M*2,5,'F');
    doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.setTextColor(15,23,42);
    let cxSub=M+2;
    ['TOTAL '+grupo,fmtN(subP),fmtN(subPr),subPct+'%',(subGap>0?'-':'+')+fmtN(Math.abs(subGap)),''].forEach((v,vi)=>{
      doc.text(String(v),cxSub+(vi>0?cW[vi]-2:0),y+3.5,{align:vi>0?'right':'left'});
      cxSub+=cW[vi];
    });
    y+=6;
  });

  // Total general
  const totGap=totalPlan-totalProd;
  doc.setFillColor(13,27,46);
  doc.rect(M,y,W-M*2,6,'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.setTextColor(255,255,255);
  let cxTot=M+2;
  ['TOTAL GENERAL',fmtN(totalPlan),fmtN(totalProd),pctG+'%',(totGap>0?'-':'+')+fmtN(Math.abs(totGap)),''].forEach((v,vi)=>{
    doc.text(String(v),cxTot+(vi>0?cW[vi]-2:0),y+4,{align:vi>0?'right':'left'});
    cxTot+=cW[vi];
  });
  y+=10;

  // Ritmo y días
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.setTextColor(100,116,139);
  doc.text(`Ritmo actual: ${fmtN(ritmo)} uds/día · Días restantes semana: ${nDiasRest} · Meta diaria requerida: ${fmtN(metaDia)} uds/día`,M,y);

  // Footer
  doc.setFillColor(13,27,46);
  doc.rect(0,287,W,10,'F');
  doc.setFontSize(7); doc.setFont('helvetica','normal');
  doc.setTextColor(77,122,170);
  doc.text('Diego Mancilla · Supervisor de Operaciones Logísticas · Samsonite CD Lo Boza',W/2,293,{align:'center'});

  doc.save(`Plan_S${planSemActual}_${anio}.pdf`);
  toast('✓ PDF generado');
  }catch(e){ toast('Error PDF: '+e.message); console.error(e); }
}

async function fetchRecordYRacha(usuario, fechaActual, totalHoy){
  // Traer todo el historial del usuario
  const rows = await fetchProd(usuario, '2024-01-01', fechaActual);
  if(!rows.length) return { record:0, esNuevoRecord:false, racha:0 };

  // Agrupar por fecha
  const gf = groupByFecha(rows);
  const meta = META[usuario]||0;

  // Récord histórico (excluyendo hoy para comparar justo)
  const diasAnteriores = Object.entries(gf)
    .filter(([f])=>f<fechaActual)
    .map(([,d])=>d.total);
  const recordAnterior = diasAnteriores.length ? Math.max(...diasAnteriores) : 0;
  const esNuevoRecord = totalHoy > recordAnterior;
  const record = Math.max(totalHoy, recordAnterior);

  // Días consecutivos sobre meta (contando desde el día más reciente hacia atrás)
  let racha = 0;
  if(meta > 0){
    const fechasOrdenadas = Object.keys(gf).sort((a,b)=>b.localeCompare(a)); // desc
    for(const f of fechasOrdenadas){
      if(gf[f].total >= meta) racha++;
      else break;
    }
  }

  return { record, recordAnterior, esNuevoRecord, racha };
}

async function fetchRptDatos(fechaParam) {
  const hoy = fechaParam || fechaLocalStr(new Date());
  const hace14 = fechaLocalStr(new Date(new Date(hoy+'T12:00:00').getTime()-13*24*60*60*1000));
  // Usa fetchProdAll que ya maneja RLS y auth correctamente
  const [rC, rTend] = await Promise.all([
    fetchProdAll(hoy, hoy),
    fetchProdAll(hace14, hoy)
  ]);
  const toArr = v => Array.isArray(v) ? v : [];
  const aC = toArr(rC);
  const aTend = toArr(rTend);
  const porCanal={}, porTipo={}, porFecha={};
  // Insumos excluidos de KPIs y totales; se capturan aparte para referencia
  aC.forEach(r=>{
    if(r.canal&&r.canal!=='Anulada'&&r.tipo!=='insumo')
      porCanal[r.canal]=(porCanal[r.canal]||0)+r.cantidad;
  });
  aC.forEach(r=>{if(r.tipo)porTipo[r.tipo]=(porTipo[r.tipo]||0)+r.cantidad});
  const insumoHoy=porTipo['insumo']||0;
  aTend.forEach(r=>{
    if(r.fecha&&r.canal!=='Anulada'&&r.tipo!=='insumo')
      porFecha[r.fecha]=(porFecha[r.fecha]||0)+r.cantidad;
  });
  const totalHoy=Object.values(porCanal).reduce((a,b)=>a+b,0);
  const offline=['Locales','Concesiones','BTS','Grandes Tiendas','Distribuidor'].reduce((s,k)=>s+(porCanal[k]||0),0);
  const online=['Marketplace','Ecommerce','Venta en verde'].reduce((s,k)=>s+(porCanal[k]||0),0);
  const fechas=Object.keys(porFecha).sort();
  const valTend=fechas.map(f=>porFecha[f]);
  const prom=fechas.length?Math.round(valTend.reduce((a,b)=>a+b,0)/fechas.length):0;
  // KPIs gerenciales: capacidad dinámica según META de activas ese día
  const kpisGer=calcularKpisGerenciales(aC);

  // ── Plan de carga: datos para el email ──
  let planEmail = null;
  try{
    const dtRpt  = new Date(hoy+'T12:00:00');
    const anioRpt = dtRpt.getFullYear();
    // Calcular semana ISO — función robusta que evita edge cases
    function getISOWeek(d){
      const dt = new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
      const day = dt.getUTCDay()||7;
      dt.setUTCDate(dt.getUTCDate()+4-day);
      const y1 = new Date(Date.UTC(dt.getUTCFullYear(),0,1));
      return Math.ceil((((dt-y1)/86400000)+1)/7);
    }
    const semRpt = getISOWeek(dtRpt);

    // Traer plan SOLO de la semana del reporte
    const planRawW = await sbFetch(
      `plan_carga?select=canal,tipo,unidades_plan&semana_iso=eq.${semRpt}&anio=eq.${anioRpt}`
    );

    if(Array.isArray(planRawW) && planRawW.length){
      // Fechas de la semana usando semRpt calculada correctamente
      function getMondayOfISOWeek(week, year){
        const jan4 = new Date(year,0,4);
        const s0   = new Date(jan4);
        s0.setDate(jan4.getDate()-(jan4.getDay()||7)+1);
        const mon  = new Date(s0);
        mon.setDate(s0.getDate()+(week-1)*7);
        return mon;
      }
      const lunRpt = getMondayOfISOWeek(semRpt, anioRpt);
      const vieRpt = new Date(lunRpt); vieRpt.setDate(lunRpt.getDate()+4);
      const fIniW   = fechaLocalStr(lunRpt);
      const fFinW   = fechaLocalStr(vieRpt);
      const fHastaW = hoy <= fFinW ? hoy : fFinW;

      // Producción acumulada de ESA semana via sbFetchAll
      const prodPlan = await sbFetchAll(
        `produccion?select=usuario,canal,tipo,cantidad&fecha=gte.${fIniW}&fecha=lte.${fHastaW}&canal=neq.Anulada&canal=neq.BTS&canal=neq.Regula&tipo=neq.insumo&order=fecha.asc,id.asc`
      );

      // Días hábiles de la semana
      // dhW definida como función global abajo
      const dTW  = dhW(fIniW, fHastaW);
      const dTotW= dhW(fIniW, fFinW);
      const dRW  = dTotW - dTW;
      const pctEspW = dTotW>0?Math.round(dTW/dTotW*100):0;

      // Totales por canal
      const metaMapW={}, prodMapW={};
      planRawW.forEach(r=>{metaMapW[r.canal]=(metaMapW[r.canal]||0)+Number(r.unidades_plan);});
      prodPlan.filter(r=>DB[r.usuario]!==undefined).forEach(r=>{prodMapW[r.canal]=(prodMapW[r.canal]||0)+Number(r.cantidad);});
      const totalMetaW=Object.values(metaMapW).reduce((s,v)=>s+v,0);
      const totalProdW=Object.values(prodMapW).reduce((s,v)=>s+v,0);
      const pctAvW=totalMetaW>0?Math.round(totalProdW/totalMetaW*100):0;
      const ritmoW=dTW>0?Math.round(totalProdW/dTW):0;
      const metaDiaW=dRW>0?Math.max(Math.round((totalMetaW-totalProdW)/dRW),0):0;

      const ORDEN_EMAIL=['Locales','Concesiones','Grandes Tiendas','Distribuidor','Ecommerce','Marketplace','Venta en verde'];
      const canalesPlanW=ORDEN_EMAIL.filter(cn=>metaMapW[cn]).map(canal=>{
        const meta=Math.round(metaMapW[canal]||0), prod=Math.round(prodMapW[canal]||0);
        const pct=meta>0?Math.round(prod/meta*100):0;
        return {canal, meta, prod, pct, dR:dRW, pctEsp:pctEspW};
      });

      // Cargado acumulado de la semana desde entregas_carga
      let totalCargW = 0;
      try{
        const domCarg = new Date(lunRpt); domCarg.setDate(lunRpt.getDate()+6);
        const fDomCarg = fechaLocalStr(domCarg);
        const fHastaCarg = hoy <= fDomCarg ? hoy : fDomCarg; // igual que supervisor: hasta hoy o dom
        const cargRows = await sbFetchAll(
          'entregas_carga?select=canal,tipo_producto,cantidad&fecha_carga=gte.'+fIniW+'&fecha_carga=lte.'+fHastaCarg
        );
        totalCargW = (cargRows||[])
          .filter(r=>{
            const tp=(r.tipo_producto||'').toString().trim().toLowerCase();
            const cn=(r.canal||'').toString().trim().toLowerCase();
            return tp!=='insumo' && cn!=='anulada' && cn!=='regula' && cn!=='bts';
          })
          .reduce((s,r)=>s+Number(r.cantidad||0),0);
      }catch(e){ console.warn('cargado email error:',e.message); }

      planEmail={
                 pctAv:pctAvW, pctEsp:pctEspW,
                 totalMeta:Math.round(totalMetaW),
                 totalProd:Math.round(totalProdW),
                 totalCarg:totalCargW,
                 ritmo:ritmoW, metaDia:metaDiaW,
                 dT:dTW, dR:dRW, dTot:dTotW,
                 semMin:semRpt, semMax:semRpt,
                 canalesPlan:canalesPlanW};
    }
  }catch(e){ console.error('planEmail error:',e.message); planEmail=null; }

  // ── Dotación del día ──
  const DOTACION_ESP = 12;
  const dotPresentes = kpisGer.dotacion;
  const dotAusentes  = Math.max(DOTACION_ESP - dotPresentes, 0);
  const metaActivasArr = kpisGer.usuariosActivos.map(u=>META[u]||0).filter(m=>m>0);
  const metaPromDot  = metaActivasArr.length ? Math.round(metaActivasArr.reduce((a,b)=>a+b,0)/metaActivasArr.length) : 1215;
  const capPerdidaDot= dotAusentes * metaPromDot;
  const capDispDot   = metaActivasArr.reduce((a,b)=>a+b,0);
  const cumplAjDot   = capDispDot>0 ? Math.round(kpisGer.produccionTotal/capDispDot*100) : 0;
  const dotacionEmail = {presentes:dotPresentes, ausentes:dotAusentes, capPerdida:capPerdidaDot,
                         capDisponible:capDispDot, cumplAjustado:cumplAjDot, metaProm:metaPromDot};

  return {hoy,porCanal,porTipo,totalHoy,offline,online,insumoHoy,fechas,valTend,prom,rawData:aTend,kpisGer,planEmail,dotacionEmail};
}

  function filaCanal(cp){
    const sc  = cp.pct>=95?'#16A34A':cp.pct>=75?'#D97706':'#DC2626';
    const g   = Math.round(cp.meta - cp.prod);
    return `<tr>
      <td style="padding:5px 10px;font-size:10px;color:#E8F1FF">${cp.canal}</td>
      <td align="right" style="padding:5px 8px;font-size:10px;color:#8AAED4">${cp.meta.toLocaleString('es-CL')}</td>
      <td align="right" style="padding:5px 8px;font-size:10px;font-weight:700;color:${sc}">${cp.prod.toLocaleString('es-CL')}</td>
      <td align="right" style="padding:5px 8px;font-size:10px;color:${sc}">${cp.pct}%</td>
      <td align="right" style="padding:5px 10px;font-size:10px;color:${g>0?'#DC2626':'#16A34A'}">${g>0?'&minus;'+g.toLocaleString('es-CL'):'+'+Math.abs(g).toLocaleString('es-CL')}</td>
    </tr>`;
  }

function fmtFechaCL(d){
  return d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'});
}

      function getMondayOfISOWeek(week, year){
        const jan4 = new Date(year,0,4);
        const s0   = new Date(jan4);
        s0.setDate(jan4.getDate()-(jan4.getDay()||7)+1);
        const mon  = new Date(s0);
        mon.setDate(s0.getDate()+(week-1)*7);
        return mon;
      }

function handlePlanDrop(e){
  e.preventDefault();
  document.getElementById('plan-drop-zone').classList.remove('drag');
  const f=e.dataTransfer.files[0];
  if(f) handlePlanFile(f);
}

async function handlePlanFile(file){
  if(!file) return;
  const progEl=document.getElementById('plan-upload-progress');
  const lblEl=document.getElementById('plan-upload-lbl');
  const fillEl=document.getElementById('plan-upload-fill');
  const resEl=document.getElementById('plan-upload-result');
  progEl.style.display='block'; resEl.innerHTML='';
  const CANAL_MAP={'Locales':'Locales','Concesiones':'Concesiones','Venta a GGTT':'Grandes Tiendas',
    'Distribuidores':'Distribuidor','Modalidades Full (Meli u Otro)':'Marketplace',
    'Ecommerce Propio':'Ecommerce','Marketplace':'Marketplace',
    'Venta en Verde':'Venta en verde','Venta en verde':'Venta en verde'};
  const TIPO_MAP={'Línea':'linea','Linea':'linea','linea':'linea','Maleta':'maleta','maleta':'maleta'};
  const SKIP_ROWS=new Set(['Total Offline','Total Online','Total','Total Línea Offline',
    'Total Maleta Offline','Total Línea Online','Total Maleta Online','Total Línea',
    'Total Maleta','Unidades Offline','Unidades On Line']);
  try{
    lblEl.textContent='Leyendo...'; fillEl.style.width='15%';
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    lblEl.textContent='Parseando...'; fillEl.style.width='35%';
    const anioUp=new Date().getFullYear();
    const hoyUp=new Date();
    const janUp=new Date(anioUp,0,4), sUp=new Date(janUp);
    sUp.setDate(janUp.getDate()-(janUp.getDay()||7)+1);
    const semActualUp=Math.ceil(((hoyUp-sUp)/86400000+1)/7);
    const agg={};
    let mejorHoja=null, mejorMaxSem=-1;
    wb.SheetNames.forEach(sh=>{
      const ws=wb.Sheets[sh];
      const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
      data.forEach(row=>row.forEach(v=>{
        if(v&&/^S\d+$/.test(String(v).trim())){
          const s=parseInt(String(v).replace('S',''));
          if(s>=semActualUp&&s>mejorMaxSem){mejorMaxSem=s;mejorHoja=sh;}
        }
      }));
    });
    const hojas=mejorHoja?[mejorHoja]:wb.SheetNames.slice(-1);
    hojas.forEach(sh=>{
      const ws=wb.Sheets[sh];
      const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
      let hRow=-1; const sems=[];
      data.forEach((row,ri)=>{
        const ss=row.map((v,ci)=>({v,ci})).filter(({v})=>v&&/^S\d+$/.test(String(v).trim()));
        if(ss.length>=2&&hRow===-1){hRow=ri;ss.forEach(({v,ci})=>sems.push({ci,sem:parseInt(String(v).replace('S',''))}));}
      });
      if(hRow===-1) return;
      let cA=null;
      data.slice(hRow+1).forEach(row=>{
        const c0=row[0]?String(row[0]).trim():'';
        const c1=row[1]?String(row[1]).trim():'';
        if(SKIP_ROWS.has(c0)||!c0||c0==='nan') return;
        if(CANAL_MAP[c0]) cA=CANAL_MAP[c0];
        const tipo=TIPO_MAP[c1];
        if(!tipo||!cA||SKIP_ROWS.has(c0)) return;
        sems.forEach(({ci,sem})=>{
          const v=row[ci];
          if(v!==null&&v!==undefined&&!isNaN(Number(v))&&Number(v)>0){
            const k=sem+'|'+cA+'|'+tipo;
            agg[k]=(agg[k]||0)+Number(v);
          }
        });
      });
    });
    const registros=Object.entries(agg).map(([k,u])=>{
      const[sem,canal,tipo]=k.split('|');
      return{semana_iso:parseInt(sem),anio:anioUp,canal,tipo,unidades_plan:Math.round(u*100)/100};
    });
    if(!registros.length){resEl.innerHTML='<div class="empty">Sin datos en el archivo.</div>';progEl.style.display='none';return;}
    lblEl.textContent=`Subiendo ${registros.length} registros...`;fillEl.style.width='65%';
    const resDB=await fetch(`${SUPA_URL}/rest/v1/plan_carga`,{
      method:'POST',
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,
        'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
      body:JSON.stringify(registros)
    });
    fillEl.style.width='100%';lblEl.textContent='Completado';
    if(resDB.ok||resDB.status===201){
      const semsU=[...new Set(registros.map(r=>r.semana_iso))].sort((a,b)=>a-b);
      const canalesU=[...new Set(registros.map(r=>r.canal))];
      const totalUds=registros.reduce((s,r)=>s+r.unidades_plan,0);
      resEl.innerHTML=`<div style="margin-top:10px;padding:12px;background:#DCFCE7;border:1px solid #16A34A;border-radius:8px;font-size:12px;color:#166534">
        ✅ <strong>${registros.length} registros cargados</strong><br>
        <span style="font-size:11px">Semanas: ${semsU.map(s=>'S'+s).join(', ')} · ${canalesU.length} canales · ${fmtN(Math.round(totalUds))} uds</span>
      </div>`;
      setTimeout(()=>cargarPlanSemanal(),800);
    }else{
      const err=await resDB.text();
      resEl.innerHTML=`<div style="margin-top:10px;padding:10px;background:#FEE2E2;border-radius:8px;font-size:11px;color:#991B1B">Error: ${err}</div>`;
    }
  }catch(e){
    resEl.innerHTML=`<div style="margin-top:10px;padding:10px;background:#FEE2E2;border-radius:8px;font-size:11px;color:#991B1B">Error: ${e.message}</div>`;
  }finally{
    setTimeout(()=>{progEl.style.display='none';fillEl.style.width='0%';},1500);
  }
}

function isoSemanaAFechas(anio, sem){
  // Usar mediodía para evitar desfase UTC en timezones negativas (Chile UTC-4)
  const jan4=new Date(anio,0,4,12,0,0), s=new Date(jan4);
  s.setDate(jan4.getDate()-(jan4.getDay()||7)+1);
  const lun=new Date(s); lun.setDate(s.getDate()+(sem-1)*7);
  const vie=new Date(lun); vie.setDate(lun.getDate()+6); // semana lun-dom
  return {lun, vie};
}

function isoWeekActual(){
  // Usar fecha local del dispositivo (evita desfase UTC-4 en Chile)
  const now = new Date();
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const jan4 = new Date(hoy.getFullYear(),0,4);
  const s = new Date(jan4);
  s.setDate(jan4.getDate()-(jan4.getDay()||7)+1);
  return Math.ceil(((hoy-s)/86400000+1)/7);
}

async function loadDia(){
  const fecha=document.getElementById('fil-dia').value;
  if(!fecha || !cUser) return;
  const el=document.getElementById('dia-content');
  el.innerHTML='<div class="loading"><span class="spinner"></span>Cargando...</div>';

  // Resetear hero mientras carga
  const heroMeta=document.getElementById('dash-hero-meta');
  if(heroMeta) heroMeta.innerHTML='<div style="font-size:11px;color:rgba(255,255,255,.3);text-align:center;padding:6px">Cargando...</div>';

  try{
    // Un solo fetch del día — rápido
    const rows=await fetchProd(cUser,fecha,fecha);
    const g=groupByTipo(rows);
    const meta=META[cUser]||0;
    const pct=meta>0?Math.min(100,Math.round((g.total/meta)*100)):0;

    if(!rows.length){
      if(heroMeta) heroMeta.innerHTML='<div style="font-size:11px;color:rgba(255,255,255,.3);text-align:center;padding:4px">Sin datos para hoy</div>';
      el.innerHTML=`<div class="empty">Sin registros para ${fmtFecha(fecha)}<br><small style="font-size:11px;color:var(--txt3)">Los datos se actualizan al final del día</small></div>`;
      return;
    }

    // Ayer y tendencia: desde caché (no-blocking — inicia la carga en paralelo)
    const cachePromise=getHistorialCache();

    // Renderizar el día inmediatamente con los datos disponibles
    el.innerHTML=renderDiaHTML(g,meta,pct,fecha,rows,{},{});

    // Luego enriquecer con datos del caché cuando lleguen
    cachePromise.then(cache=>{
      if(!cache.gfAll) return;
      const gfAll=cache.gfAll;

      // Ayer desde caché
      const ayer=new Date(fecha+'T12:00:00');
      ayer.setDate(ayer.getDate()-1);
      const ayerStr=ayer.toISOString().slice(0,10);
      const gAyer=gfAll[ayerStr]?{total:gfAll[ayerStr].total,...gfAll[ayerStr]}:{total:0};

      // Racha desde caché
      let racha=0;
      let dCheck=new Date(fecha+'T12:00:00');
      for(let i=0;i<60;i++){
        const f=dCheck.toISOString().slice(0,10);
        if(gfAll[f]&&gfAll[f].total>0) racha++;
        else if(racha>0) break;
        dCheck.setDate(dCheck.getDate()-1);
      }

      // Récord desde caché
      const vals=Object.values(gfAll).map(d=>d.total);
      const record=vals.length?Math.max(...vals):0;
      const esNuevoRecord=g.total>0&&g.total>=record;

      // Banners extra
      let extra='';
      if(esNuevoRecord&&g.total>0){
        const recAnterior=vals.filter(v=>v<g.total).length?Math.max(...vals.filter(v=>v<g.total)):0;
        extra+=`<div class="meta-banner" style="background:linear-gradient(135deg,#1A1040,#2E1A6A);border-color:#9A88FF">
          <div class="mb-icon">🏅</div>
          <div class="mb-txt">
            <div class="mb-t" style="color:#9A88FF">¡Nuevo récord personal!</div>
            <div class="mb-s">Superaste tu marca anterior de ${fmtN(recAnterior)} uds.</div>
          </div></div>`;
      }
      if(racha>=2){
        const rc=racha>=5?'#FF8C42':racha>=3?'#FFBA4D':'#2ECC8A';
        extra+=`<div class="meta-banner" style="background:linear-gradient(135deg,#1A1200,#2A2000);border-color:${rc}">
          <div class="mb-icon">${racha>=5?'🔥':'⚡'}</div>
          <div class="mb-txt">
            <div class="mb-t" style="color:${rc}">${racha} días consecutivos activa</div>
            <div class="mb-s">${racha>=5?'¡Racha increíble!':racha>=3?'¡Excelente constancia!':'¡Vas muy bien!'}</div>
          </div></div>`;
      }
      if(extra) el.insertAdjacentHTML('afterbegin', extra);

      // Re-renderizar hero con comparativa ayer
      renderDiaHTML(g,meta,pct,fecha,rows,gAyer,{});

      // Badge racha en header
      const rachaBadgeEl=document.getElementById('dash-racha-badge');
      if(rachaBadgeEl&&racha>=3){ rachaBadgeEl.style.display='inline-flex'; rachaBadgeEl.textContent=`🔥 ${racha} días`; }
    });

  }catch(e){
    el.innerHTML='<div class="empty">Error: '+e.message+'</div>';
    if(heroMeta) heroMeta.innerHTML='';
  }
}

  function miniChart(vals, color, labels){
    if(!vals||!vals.length) return '';
    const max=Math.max(...vals,1), mH=26, n=vals.length, cw=Math.floor(100/n);
    let rv='',rb='',rl='';
    vals.forEach((v,i)=>{
      const isH=i===n-1;
      const txt=v>0?v.toLocaleString('es-CL'):'-';
      const fc=isH?'#111':'#999';
      const fw=isH?'bold':'normal';
      const h=v>0?Math.max(Math.round((v/max)*mH),2):2;
      const bg=isH?color:'#CCC';
      rv+='<td width="'+cw+'%" align="center" style="padding:0 1px;font-size:9px;font-weight:'+fw+';color:'+fc+'">'+txt+'</td>';
      rb+='<td width="'+cw+'%" align="center" valign="bottom" style="padding:0 1px"><table cellpadding="0" cellspacing="0" width="100%"><tr><td bgcolor="'+bg+'" height="'+h+'" style="background:'+bg+';height:'+h+'px;font-size:0;line-height:'+h+'px">&nbsp;</td></tr></table></td>';
      rl+='<td width="'+cw+'%" align="center" style="padding:1px 1px 0;font-size:8px;color:#999">'+(labels[i]||'')+'</td>';
    });
    return '<table cellpadding="0" cellspacing="0" width="100%"><tr valign="bottom">'+rv+'</tr><tr valign="bottom">'+rb+'</tr><tr>'+rl+'</tr></table>';
  }

function navegarSemana(delta){
  planSemActual = planSemActual + delta;
  if(planSemActual < 1) planSemActual = 1;
  if(planSemActual > 52) planSemActual = 52;
  planDiaActual = null; // al cambiar de semana, volver a vista semana completa
  const btnNext = _getPlanEl('plan-btn-next');
  if(btnNext) btnNext.disabled = planSemActual >= isoWeekActual();
  invalidarPlanCache(); // semana cambió, forzar recarga
  cargarPlanSemanal();
}

function renderRptBody(d){
  const {hoy,porCanal,porTipo,totalHoy,offline,online,fechas,valTend,prom}=d;
  const fd=new Date(hoy+'T12:00:00').toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  document.getElementById('rpt-fecha-sub').textContent=fd.charAt(0).toUpperCase()+fd.slice(1);
  const canalesOrdenados=Object.entries(porCanal).sort((a,b)=>b[1]-a[1]);
  const maxC=canalesOrdenados[0]?.[1]||1;
  const tipoEntries=Object.entries(porTipo);

  let html=`
    <div class="rpt-kpi-grid">
      <div class="rpt-kpi"><div class="rv">${totalHoy.toLocaleString('es-CL')}</div><div class="rl">Total uds.</div></div>
      <div class="rpt-kpi"><div class="rv">${prom.toLocaleString('es-CL')}</div><div class="rl">Prom. 14 días</div></div>
      <div class="rpt-kpi"><div class="rv">${offline.toLocaleString('es-CL')}</div><div class="rl">Offline</div></div>
      <div class="rpt-kpi"><div class="rv">${online.toLocaleString('es-CL')}</div><div class="rl">Online</div></div>
    </div>
    <div class="rpt-section">Unidades por canal</div>`;
  canalesOrdenados.forEach(([canal,uds])=>{
    const pct=Math.round(uds/maxC*100);
    const col=CANAL_COLORS_RPT[canal]||'#8AAED4';
    html+=`<div class="rpt-canal-row">
      <span class="rpt-canal-name">${canal}</span>
      <div class="rpt-canal-bar-wrap"><div class="rpt-canal-bar" style="width:${pct}%;background:${col}"></div></div>
      <span class="rpt-canal-val">${uds.toLocaleString('es-CL')}</span>
    </div>`;
  });
  const tipoCols={'linea':'#3B8FFF','insumo':'#3EC97E','maleta':'#FFB84D'};
  const tipoLbls={'linea':'Línea','insumo':'Insumo','maleta':'Maleta'};
  html+=`<div class="rpt-section">Tipo de material</div><div style="margin-bottom:4px">`;
  tipoEntries.forEach(([t,u])=>{
    html+=`<span class="rpt-tipo-pill"><span class="rpt-dot" style="background:${tipoCols[t]||'#8AAED4'}"></span>${tipoLbls[t]||t}: <strong>${u.toLocaleString('es-CL')}</strong></span>`;
  });
  // Gráfico de tendencia como barras HTML (sin dependencia de Chart.js)
  const maxTend = Math.max(...valTend, 1);
  const barrasHTML = fechas.map((f,i)=>{
    const pct = Math.round(valTend[i]/maxTend*100);
    const promPct = Math.round(prom/maxTend*100);
    const lbl = new Date(f+'T12:00:00').toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit'});
    const esProm = valTend[i] >= prom;
    const col = esProm ? '#3B8FFF' : '#1E3A5F';
    return `<div class="bar-col">
      <div class="bar-val" style="font-size:8px;color:#4D7AAA">${valTend[i].toLocaleString('es-CL')}</div>
      <div class="bar-fill" style="height:${pct}px;background:${col};width:100%;border-radius:3px 3px 0 0;min-height:2px;position:relative">
        ${i===0?'':''}
      </div>
      <div class="bar-lbl">${lbl}</div>
    </div>`;
  }).join('');

  const promLine = `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:10px;color:#FFB84D">
    <div style="width:16px;height:2px;background:#FFB84D;border-radius:1px"></div>
    Promedio: ${prom.toLocaleString('es-CL')} uds/día
  </div>`;

  html+=`</div><div class="rpt-section">Tendencia 14 días</div>
    <div class="chart-wrap" style="margin-bottom:4px">
      <div class="chart-bars" style="height:100px;align-items:flex-end">${barrasHTML}</div>
    </div>${promLine}`;
  document.getElementById('rpt-body-contenido').innerHTML=html;
}

function semColor(pct){
  if(pct>=95) return {c:'#16A34A',bg:'#DCFCE7',ico:'🟢'};
  if(pct>=75) return {c:'#D97706',bg:'#FEF3C7',ico:'🟡'};
  return             {c:'#DC2626',bg:'#FEE2E2',ico:'🔴'};
}

function toggleKeysPanel(){
  const p=document.getElementById('rpt-keys-panel');
  p.classList.toggle('open');
}

/**
 * pdf.js
 * ─────────────────────────────────────────────────────────────
 * Generación de PDFs: exportación del día, ranking semanal,
 * ranking mensual, PDF personal de la embaladora y plan
 * semanal. Usa jsPDF + AutoTable.
 *
 * Dependencias : config.js, helpers.js, supabase.js
 * Exporta (global): buildRankingPDF, exportDiaPDF,
 *   exportRankingPDF, exportRankingSemanaPDF,
 *   exportRankingMesPDF, exportMiMesPDF, exportarPlanPDF
 * ─────────────────────────────────────────────────────────────
 */

// ============================================================
// EXPORT RANKING PDF — diseño Samsonite
// ============================================================
function buildRankingPDF(titulo, subtitulo, tableData){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W=210, H=297;

  // Fondo navy
  doc.setFillColor(13,27,46);
  doc.rect(0,0,W,H,'F');

  // Header strip
  doc.setFillColor(21,37,66);
  doc.rect(0,0,W,38,'F');
  doc.setDrawColor(59,143,255);
  doc.setLineWidth(0.5);
  doc.line(0,38,W,38);

  // Logo texto
  doc.setFont('helvetica','bold');
  doc.setFontSize(18);
  doc.setTextColor(255,255,255);
  doc.text('SAMSONITE', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(138,174,212);
  doc.text('CD Lo Boza · Mi Productividad', 14, 23);

  // Título
  doc.setFontSize(14);
  doc.setTextColor(59,143,255);
  doc.text(titulo, 14, 32);

  // Fecha generación
  const ahora=new Date().toLocaleString('es-CL',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  doc.setFontSize(8);
  doc.setTextColor(77,122,170);
  doc.text('Generado: '+ahora, W-14, 16, {align:'right'});
  doc.setFontSize(9);
  doc.setTextColor(138,174,212);
  doc.text(subtitulo, W-14, 23, {align:'right'});

  // Leyenda semáforo
  doc.setFontSize(7.5);
  doc.setTextColor(62,201,126); doc.text('● ≥100% meta', W-14, 32, {align:'right'});
  doc.setTextColor(255,184,77);  doc.text('● 70–99%', W-46, 32, {align:'right'});
  doc.setTextColor(255,90,90);   doc.text('● <70%', W-74, 32, {align:'right'});

  // Tabla — columnas: # Operaria Total %Meta Maletas NoMaleta Insumo
  doc.autoTable({
    startY: 46,
    head: [['#','Operaria','Total','% Meta','Maletas','No Maleta','Insumo']],
    body: tableData,
    theme: 'plain',
    styles:{
      font:'helvetica', fontSize:9, cellPadding:3,
      textColor:[232,241,255], fillColor:[21,37,66],
      lineColor:[30,58,95], lineWidth:0.3
    },
    headStyles:{
      fillColor:[13,27,46], textColor:[59,143,255],
      fontStyle:'bold', fontSize:8, cellPadding:3
    },
    alternateRowStyles:{ fillColor:[14,30,52] },
    columnStyles:{
      0:{cellWidth:10, halign:'center', fontStyle:'bold'},
      1:{cellWidth:55},
      2:{cellWidth:22, halign:'right', fontStyle:'bold'},
      3:{cellWidth:18, halign:'right'},
      4:{cellWidth:22, halign:'right'},
      5:{cellWidth:22, halign:'right'},
      6:{cellWidth:18, halign:'right'},
    },
    didParseCell(data){
      if(data.section==='body' && data.column.index===3){
        const v=parseInt(data.cell.raw)||0;
        if(v>=100) data.cell.styles.textColor=[62,201,126];
        else if(v>=70) data.cell.styles.textColor=[255,184,77];
        else if(v>0)  data.cell.styles.textColor=[255,90,90];
      }
    },
    margin:{left:14, right:14}
  });

  // Footer
  const finalY=doc.lastAutoTable.finalY+8;
  doc.setDrawColor(30,58,95);
  doc.setLineWidth(0.4);
  doc.line(14, finalY, W-14, finalY);
  doc.setFontSize(7.5);
  doc.setTextColor(77,122,170);
  doc.text('Samsonite Chile · CD Lo Boza · Generado automáticamente desde Mi Productividad', W/2, finalY+6, {align:'center'});

  return doc;
}

function exportRankingPDF(){
  if(!eqCache.length){toast('Sin datos para exportar');return}
  const fecha=document.getElementById('eq-fecha').value;
  const g={};
  eqCache.forEach(r=>{
    if(!g[r.usuario])g[r.usuario]={total:0,maleta:0,linea:0,insumo:0,otro:0};
    g[r.usuario].total+=r.cantidad;
    g[r.usuario][r.tipo]=(g[r.usuario][r.tipo]||0)+r.cantidad;
  });
  const sorted=Object.entries(g).sort((a,b)=>b[1].total-a[1].total);
  const totGeneral=sorted.reduce((s,[,d])=>s+d.total,0);
  const tableData=sorted.map(([uid,d],i)=>{
    const nombre=DB[uid]||uid;
    const meta=META[uid]||0;
    const pct=meta>0?Math.round(d.total/meta*100)+'%':'—';
    return[i+1, nombre, fmtN(d.total), pct, fmtN(d.maleta), fmtN(d.linea), fmtN(d.insumo)];
  });
  tableData.push(['','TOTAL EQUIPO',fmtN(totGeneral),'',
    fmtN(sorted.reduce((s,[,d])=>s+d.maleta,0)),
    fmtN(sorted.reduce((s,[,d])=>s+d.linea,0)),
    fmtN(sorted.reduce((s,[,d])=>s+d.insumo,0))
  ]);
  const doc=buildRankingPDF(
    'Ranking de Producción · '+fmtFecha(fecha),
    sorted.length+' operarias · '+fmtN(totGeneral)+' unidades totales',
    tableData
  );
  doc.save('ranking_'+fecha+'.pdf');
  toast('✓ PDF generado correctamente');
}

function exportRankingSemanaPDF(){
  if(!supSemCache.length){toast('Sin datos para exportar');return}
  const ws=document.getElementById('sup-semana').value;
  const [desde,hasta]=weekRange(ws);
  const gu={};
  supSemCache.forEach(r=>{
    if(!gu[r.usuario])gu[r.usuario]={total:0,maleta:0,linea:0,insumo:0};
    gu[r.usuario].total+=r.cantidad;
    gu[r.usuario][r.tipo]=(gu[r.usuario][r.tipo]||0)+r.cantidad;
  });
  const gf=groupByFecha(supSemCache);
  const dias=Object.keys(gf).length;
  const sortedU=Object.entries(gu).sort((a,b)=>b[1].total-a[1].total);
  const totGeneral=sortedU.reduce((s,[,d])=>s+d.total,0);
  const tableData=sortedU.map(([uid,d],i)=>{
    const nombre=DB[uid]||uid;
    const metaSem=(META[uid]||0)*dias;
    const pct=metaSem>0?Math.round(d.total/metaSem*100)+'%':'—';
    return[i+1, nombre, fmtN(d.total), pct, fmtN(d.maleta), fmtN(d.linea), fmtN(d.insumo)];
  });
  tableData.push(['','TOTAL EQUIPO',fmtN(totGeneral),'',
    fmtN(sortedU.reduce((s,[,d])=>s+d.maleta,0)),
    fmtN(sortedU.reduce((s,[,d])=>s+d.linea,0)),
    fmtN(sortedU.reduce((s,[,d])=>s+d.insumo,0))
  ]);
  const doc=buildRankingPDF(
    'Ranking Semanal · '+fmtFecha(desde)+' – '+fmtFecha(hasta),
    sortedU.length+' operarias · '+dias+' días · '+fmtN(totGeneral)+' unidades',
    tableData
  );
  doc.save('ranking_semana_'+ws+'.pdf');
  toast('✓ PDF semanal generado');
}

// ============================================================
// ===== EXPORTAR PDF DÍA SUPERVISOR =====
// Genera el mismo HTML que el correo y abre ventana de impresión para guardar como PDF
// ============================================================
async function exportDiaPDF(){
  const fecha = document.getElementById('eq-fecha').value;
  if(!fecha){ toast('Selecciona una fecha primero'); return; }

  toast('Cargando datos...');
  try{
    const d = await fetchRptDatos(fecha);
    if(!d.totalHoy){ toast('Sin datos para esa fecha'); return; }

    const htmlBody = await buildEmailHTML(d);

    // Abrir ventana con el reporte listo para imprimir / guardar como PDF
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Reporte ${fecha}</title>
<style>
  body{margin:0;padding:20px;background:#EEF2F7;font-family:Arial,Helvetica,sans-serif}
  @media print{
    body{padding:0;background:#EEF2F7}
    .no-print{display:none}
    @page{margin:10mm;size:A4}
  }
  .toolbar{background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px}
  .btn-print{background:#2563EB;color:#fff;border:none;padding:9px 20px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;font-family:Arial}
  .btn-print:hover{background:#1d4ed8}
  .hint{font-size:12px;color:#64748B}
</style>
</head>
<body>
<div class="toolbar no-print">
  <button class="btn-print" onclick="window.print()">⬇ Guardar como PDF / Imprimir</button>
  <span class="hint">En el diálogo de impresión selecciona "Guardar como PDF" como destino</span>
</div>
${htmlBody}

</body>
</html>`);
  win.document.close();
  }catch(e){
    toast('Error al generar reporte: '+(e.message||e));
    console.error('exportDiaPDF:',e);
  }
} // cierre exportDiaPDF

function abrirModalReporte(){
  document.getElementById('modal-rpt').style.display='flex';
  const sta=document.getElementById('rpt-send-status');
  const btn=document.getElementById('btn-rpt-enviar');
  // Limpiar estado anterior
  sta.textContent=''; sta.style.color='';
  btn.disabled=true;
  rptDatos=null;
  // Poner fecha del día seleccionado en vista Día (o hoy)
  const fechaDia=document.getElementById('eq-fecha')?.value||fechaLocalStr(new Date());
  const inputFecha=document.getElementById('rpt-fecha-sel');
  if(inputFecha) inputFecha.value=fechaDia;
  _actualizarSubtituloRpt(fechaDia);
  // NO cargar datos automáticamente — esperar que el usuario presione Cargar
  sta.textContent='Selecciona la fecha y presiona Cargar';
  sta.style.color='#8AAED4';
}

function recargarRptFecha(){
  const inputFecha=document.getElementById('rpt-fecha-sel');
  const fecha=inputFecha?.value||fechaLocalStr(new Date());
  if(!fecha){ toast('Selecciona una fecha'); return; }
  _actualizarSubtituloRpt(fecha);
  rptDatos=null;
  document.getElementById('btn-rpt-enviar').disabled=true;
  _cargarRptConFecha(fecha);
}

function _actualizarSubtituloRpt(fecha){
  const sub=document.getElementById('rpt-fecha-sub');
  if(!sub||!fecha) return;
  const fd=new Date(fecha+'T12:00:00').toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  sub.textContent=fd.charAt(0).toUpperCase()+fd.slice(1);
}

function _cargarRptConFecha(fecha){
  const sta=document.getElementById('rpt-send-status');
  const btn=document.getElementById('btn-rpt-enviar');
  sta.textContent='Cargando datos...'; sta.style.color='#8AAED4'; btn.disabled=true;
  console.log('_cargarRptConFecha:', fecha);
  const tid=setTimeout(()=>{
    if(!rptDatos){
      sta.textContent='⚠️ Sin conexión — intenta de nuevo';
      sta.style.color='#FF6B6B';
      btn.disabled=false;
      console.warn('Timeout cargando datos para', fecha);
    }
  }, 30000);
  fetchRptDatos(fecha).then(d=>{
    clearTimeout(tid);
    rptDatos=d;
    btn.disabled=false;
    console.log('rptDatos cargado OK:', fecha, 'totalHoy=', d?.totalHoy);
    sta.textContent='✓ Listo para enviar';
    sta.style.color='#2ECC8A';
    setTimeout(()=>{ sta.textContent=''; sta.style.color=''; },3000);
  }).catch(err=>{
    clearTimeout(tid);
    console.error('fetchRptDatos error:', err);
    sta.textContent='⚠️ Error: '+(err?.message||String(err)).slice(0,60);
    sta.style.color='#FF6B6B';
    btn.disabled=false;
  });
}
function cerrarModalReporte(){
  document.getElementById('modal-rpt').style.display='none';
}

// ══════════════════════════════════════════════════
// REPORTE 1 — EMAIL
// ══════════════════════════════════════════════════

function buildBloqueSemanalemail(p){
  if(!p||!p.totalMeta) return '';
  const {pctAv,pctEsp,totalMeta,totalProd,totalCarg,metaDia,dR,canalesPlan,semMin,semMax} = p;
  const carg = totalCarg || 0;
  const pctCargPlan = totalMeta>0 ? Math.round(carg/totalMeta*100) : 0;
  const pctEmbalCarg = carg>0 ? Math.round(totalProd/carg*100) : null;
  const gap = Math.round(totalMeta - totalProd);
  const sc = pctAv>=95?'#16A34A':pctAv>=75?'#D97706':'#DC2626';
  const ico = pctAv>=95?'&#128994;':pctAv>=75?'&#128993;':'&#128308;';
  const bw = Math.min(Math.round(pctAv),100);
  const bwE = Math.min(Math.round(pctEsp),100);

  // Filas de canales compactas
  const OFFLINE=['Locales','Concesiones','Grandes Tiendas','Distribuidor'];
  const ONLINE=['Ecommerce','Marketplace','Venta en verde'];
  function grupo(nombre, lista){
    const rows = (canalesPlan||[]).filter(c=>lista.includes(c.canal)).map(c=>{
      const g = Math.round(c.meta - c.prod);
      const cc = c.pct>=95?'#16A34A':c.pct>=75?'#D97706':'#DC2626';
      const gstr = g>0?'<span style="color:#DC2626">&minus;'+g.toLocaleString('es-CL')+'</span>':'<span style="color:#16A34A">+'+Math.abs(g).toLocaleString('es-CL')+'</span>';
      return '<tr><td style="padding:3px 8px;font-size:9px;color:#334155">'+c.canal+'</td>'
        +'<td align="right" style="padding:3px 8px;font-size:9px;color:#94A3B8">'+c.meta.toLocaleString('es-CL')+'</td>'
        +'<td align="right" style="padding:3px 8px;font-size:9px;font-weight:700;color:'+cc+'">'+c.prod.toLocaleString('es-CL')+'</td>'
        +'<td align="right" style="padding:3px 8px;font-size:9px">'+gstr+'</td>'
        +'<td align="right" style="padding:3px 8px;font-size:9px;color:'+cc+'">'+c.pct+'%</td></tr>';
    }).join('');
    if(!rows) return '';
    return '<tr><td colspan="5" style="padding:4px 8px 2px;font-size:8px;font-weight:700;color:#94A3B8;text-transform:uppercase;background:#F8FAFC">'+nombre+'</td></tr>'+rows;
  }

  return `<tr><td bgcolor="#FFF" style="background:#FFF;padding:14px 22px 16px;border-top:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0">
  <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">&#128197; Plan Semana ${semMin}</div>
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#F8FAFC;border-radius:8px;margin-bottom:10px">
    <tr>
      <td style="padding:10px 12px">
        <div style="font-size:9px;color:#94A3B8">Plan</div>
        <div style="font-size:18px;font-weight:900;color:#0F172A">${totalMeta.toLocaleString('es-CL')}</div>
        <div style="font-size:8px;color:#94A3B8">uds semana</div>
      </td>
      <td style="padding:10px 12px">
        <div style="font-size:9px;color:#94A3B8">Embalado</div>
        <div style="font-size:18px;font-weight:900;color:#0F172A">${totalProd.toLocaleString('es-CL')}</div>
        <div style="font-size:8px;color:#94A3B8">de ${totalMeta.toLocaleString('es-CL')} uds plan</div>
      </td>
      <td style="padding:10px 12px">
        <div style="font-size:9px;color:#D97706;font-weight:700">&#128666; Cargado</div>
        <div style="font-size:18px;font-weight:900;color:${carg>0?'#F59E0B':'#94A3B8'}">${carg>0?carg.toLocaleString('es-CL'):'—'}</div>
        <div style="font-size:8px;color:#94A3B8">${carg>0?pctCargPlan+'% del plan':'Sin datos'}</div>
      </td>
      <td style="padding:10px 12px">
        <div style="font-size:9px;color:#94A3B8">Avance ${ico}</div>
        <div style="font-size:18px;font-weight:900;color:${sc}">${pctAv}%</div>
        <div style="font-size:8px;color:#94A3B8">Esperado ${pctEsp}%</div>
      </td>
      <td style="padding:10px 12px">
        <div style="font-size:9px;color:#94A3B8">Meta diaria</div>
        <div style="font-size:18px;font-weight:900;color:#0F172A">${metaDia.toLocaleString('es-CL')}</div>
        <div style="font-size:8px;color:#94A3B8">${dR} día${dR!==1?'s':''} restante${dR!==1?'s':''}</div>
      </td>
      <td style="padding:10px 12px">
        <div style="font-size:9px;color:#94A3B8">Brecha</div>
        <div style="font-size:18px;font-weight:900;color:${gap>0?'#DC2626':'#16A34A'}">${gap>0?'&minus;'+gap.toLocaleString('es-CL'):'+'+Math.abs(gap).toLocaleString('es-CL')}</div>
        <div style="font-size:8px;color:#94A3B8">uds al plan</div>
      </td>
    </tr>
    <tr><td colspan="6" style="padding:0 12px 10px">
      <div style="background:#E2E8F0;height:6px;border-radius:3px;position:relative">
        <div style="background:#CBD5E1;width:${bwE}%;height:6px;border-radius:3px;position:absolute;top:0;left:0"></div>
        <div style="background:${sc};width:${bw}%;height:6px;border-radius:3px;position:absolute;top:0;left:0"></div>
      </div>
    </td></tr>
  </table>
  <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E2E8F0;border-radius:6px">
    <tr style="background:#F1F5F9">
      <td style="padding:4px 8px;font-size:8px;font-weight:700;color:#64748B">Canal</td>
      <td align="right" style="padding:4px 8px;font-size:8px;font-weight:700;color:#64748B">Plan</td>
      <td align="right" style="padding:4px 8px;font-size:8px;font-weight:700;color:#64748B">Embalado</td>
      <td align="right" style="padding:4px 8px;font-size:8px;font-weight:700;color:#64748B">Brecha</td>
      <td align="right" style="padding:4px 8px;font-size:8px;font-weight:700;color:#64748B">%</td>
    </tr>
    ${grupo('Offline',OFFLINE)}
    ${grupo('Online',ONLINE)}
  </table>
</td></tr>`;
}

async function buildEmailHTML(d){
  const {hoy,porCanal,porTipo,totalHoy,offline,online,insumoHoy,rawData,kpisGer,planEmail,dotacionEmail} = d;
  const fd = new Date(hoy+'T12:00:00').toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const fdCap = fd.charAt(0).toUpperCase()+fd.slice(1);
  const totalDia = totalHoy||1;
  const getRaw = r => Number(r.cantidad||r.uds||0);

  const allFechas = [...new Set((rawData||[]).map(r=>r.fecha))].sort().filter(Boolean);
  const ultimas5 = allFechas.slice(-5);
  const lblFechas = ultimas5.map(f=>{
    const dt = new Date(f+'T12:00:00');
    return (dt.getDate()+'').padStart(2,'0')+'/'+(dt.getMonth()+1+'').padStart(2,'0');
  });

  // Mini gráfico HTML compacto — barras grises, solo HOY en color, ancho completo
  function miniChart(vals, color, labels){
    // 3 filas: fechas | valores | barras. bgcolor en td = compatible Gmail/Outlook.
    if(!vals||!vals.length) return '';
    const max=Math.max(...vals,1), n=vals.length;
    const BH=22, CW=Math.floor(100/n);
    const S0='font-size:0;height:', S1='px', PD='padding:0 2px', W='width:'+CW+'%';
    let rF='',rV='',rB='';
    vals.forEach((v,i)=>{
      const isH=i===n-1;
      const bh=v>0?Math.max(Math.round((v/max)*BH),2):1;
      const sp=BH-bh;
      const bg=isH?color:'#CBD5E1';
      const fc=isH?color:'#94A3B8';
      const fcV=isH?color:'#475569';
      const fw=isH?'700':'400';
      rF+='<td style="'+W+';'+PD+';font-size:7px;color:'+fc+';font-weight:'+fw+';height:11px;line-height:11px" align="center">'+(labels[i]||'')+'</td>';
      rV+='<td style="'+W+';'+PD+';font-size:8px;color:'+fcV+';font-weight:'+fw+';height:13px;line-height:13px" align="center">'+(v>0?v.toLocaleString('es-CL'):'-')+'</td>';
      rB+='<td style="'+W+';'+PD+'"><table width="100%" cellpadding="0" cellspacing="0">'
        +'<tr><td style="'+S0+sp+S1+'"></td></tr>'
        +'<tr><td bgcolor="'+bg+'" height="'+bh+'" style="background:'+bg+';height:'+bh+S1+';font-size:0"></td></tr>'
        +'</table></td>';
    });
    return '<table cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;border-top:1px solid #E2E8F0"><tr>'+rF+'</tr><tr>'+rV+'</tr><tr>'+rB+'</tr></table>';
  }

  const totalSerie5=ultimas5.map(f=>(rawData||[]).filter(r=>r.fecha===f&&r.canal!=='Anulada'&&r.tipo!=='insumo').reduce((s,r)=>s+getRaw(r),0));
  const delta5=totalSerie5.length>=2?totalSerie5[totalSerie5.length-1]-totalSerie5[totalSerie5.length-2]:0;
  const deltaColor=delta5>=0?'#16A34A':'#DC2626';
  const deltaSign=delta5>=0?'+':'';

  // ── KPIs gerenciales ──
  const kg = kpisGer || {produccionTotal:totalHoy, capacidadTotal:0, dotacion:0, cumplimiento:0, brecha:0};
  const prodReal   = kg.produccionTotal;
  const capTotal   = kg.capacidadTotal;
  const dotacionKpi = kg.dotacion;
  const cumplPct   = kg.cumplimiento;
  const brecha     = kg.brecha;
  const brechaAbs  = Math.abs(brecha);
  const brechaSign = brecha>=0?'+':'−';

  // Semáforo dinámico
  const semCol = cumplPct>=95?'#16A34A':cumplPct>=85?'#D97706':'#DC2626';
  const semBg  = cumplPct>=95?'#F0FDF4':cumplPct>=85?'#FFFBEB':'#FEF2F2';
  const semLbl = cumplPct>=95?'&#128994; Verde &mdash; En rango':cumplPct>=85?'&#128993; Amarillo &mdash; Atenci&oacute;n':'&#128308; Rojo &mdash; Bajo umbral';

  // Barra cumplimiento (cap al 100% visual)
  const barW = Math.min(cumplPct,100);

  const CANALES_DEF=[
    {key:'Locales',        color:'#2563EB',icon:'🏪'},
    {key:'Concesiones',    color:'#16A34A',icon:'🏷️'},
    {key:'Grandes Tiendas',color:'#9333EA',icon:'🛍️'},
    {key:'Distribuidor',   color:'#EA580C',icon:'🚚'},
    {key:'Ecommerce',      color:'#0891B2',icon:'💻'},
    {key:'Marketplace',    color:'#DB2777',icon:'🛒'},
    {key:'Venta en verde', color:'#65A30D',icon:'🌿'},
  ];
  const canalActivos=CANALES_DEF.filter(({key})=>(porCanal[key]||0)>0);
  const maxUds=Math.max(...canalActivos.map(({key})=>porCanal[key]||0),1);

  const TRB='border-top:1px solid #F1F5F9';
  const canalFilasHTML=canalActivos.map(c=>{
    const uds=porCanal[c.key]||0;
    const pct=((uds/totalDia)*100).toFixed(1);
    const serie5=ultimas5.map(f=>(rawData||[]).filter(r=>r.fecha===f&&r.canal===c.key&&r.tipo!=='insumo').reduce((s,r)=>s+getRaw(r),0));
    return '<tr style="'+TRB+'">'
      +'<td style="padding:8px 4px 0 0;font-size:10px;font-weight:700;color:#334155">'+c.icon+' '+c.key+'&nbsp;&nbsp;<span style="font-size:14px;font-weight:900;color:#0F172A">'+uds.toLocaleString('es-CL')+'</span></td>'
      +'<td align="right" style="padding:8px 0 0 12px;white-space:nowrap"><span style="font-size:10px;font-weight:700;color:#64748B;background:#F1F5F9;padding:2px 7px;border-radius:20px">'+pct+'%</span></td>'
      +'</tr><tr><td colspan="2" height="6" style="height:6px;font-size:0"></td></tr>'
      +'<tr><td colspan="2" style="padding:0 0 8px">'+miniChart(serie5,c.color,lblFechas)+'</td></tr>';
  }).join('');

  const tiposDef=[
    {k:'maleta',lbl:'Maletas',   c:'#2563EB',icn:'🧳'},
    {k:'linea', lbl:'No maletas',c:'#0891B2',icn:'🎒'},
    {k:'insumo',lbl:'Insumos',   c:'#7C3AED',icn:'📌'},
  ];
  const maxTipo=Math.max(...tiposDef.map(({k})=>porTipo[k]||0),1);
  const tipoFilasHTML=tiposDef.map(({k,lbl,c,icn})=>{
    const uds=porTipo[k]||0;
    if(!uds) return '';
    const pct=((uds/totalDia)*100).toFixed(1);
    const serie5=ultimas5.map(f=>(rawData||[]).filter(r=>r.fecha===f&&r.tipo===k&&r.canal!=='Anulada').reduce((s,r)=>s+getRaw(r),0));
    return '<tr style="'+TRB+'">'
      +'<td style="padding:8px 4px 0 0;font-size:10px;font-weight:700;color:#334155">'+icn+' '+lbl+'&nbsp;&nbsp;<span style="font-size:14px;font-weight:900;color:#0F172A">'+uds.toLocaleString('es-CL')+'</span></td>'
      +'<td align="right" style="padding:8px 0 0 12px;white-space:nowrap"><span style="font-size:10px;font-weight:700;color:#64748B;background:#F1F5F9;padding:2px 7px;border-radius:20px">'+pct+'%</span></td>'
      +'</tr><tr><td colspan="2" height="6" style="height:6px;font-size:0"></td></tr>'
      +'<tr><td colspan="2" style="padding:0 0 8px">'+miniChart(serie5,c,lblFechas)+'</td></tr>';
  }).join('');

  const trendChart=miniChart(totalSerie5,'#3B8FFF',lblFechas);

  const planEmailSem = planEmail ? buildBloqueSemanalemail(planEmail) : '';
  const _raw = `
<table cellpadding="0" cellspacing="0" width="100%" bgcolor="#EEF2F7" style="background:#EEF2F7">
<tr><td align="center" style="padding:20px 10px">
<table cellpadding="0" cellspacing="0" width="600">

  <!-- HEADER -->
  <tr><td bgcolor="#0D1B2E" style="background:#0D1B2E;border-radius:10px 10px 0 0">
    <table cellpadding="0" cellspacing="0" width="100%"><tr>
      <td valign="middle" style="padding:18px 22px">
        <div style="font-size:22px;font-weight:900;color:#FFF;letter-spacing:3px">SAMSONITE</div>
        <div style="font-size:9px;color:#4D7AAA;margin-top:3px;text-transform:uppercase">CD Lo Boza &middot; Embalaje</div>
      </td>
      <td valign="middle" align="right" style="padding:18px 22px">
        <table cellpadding="8" cellspacing="0" bgcolor="#0A2040" style="background:#0A2040;border:1px solid #1E3A5F"><tr><td>
          <div style="font-size:9px;font-weight:700;color:#4D7AAA;text-transform:uppercase">Reporte diario</div>
          <div style="font-size:12px;color:#E8F1FF;font-weight:600;margin-top:3px">${fdCap}</div>
        </td></tr></table>
      </td>
    </tr></table>
  </td></tr>

  <!-- INTRO -->
  <tr><td bgcolor="#FFF" style="background:#FFF;padding:16px 22px;border-bottom:1px solid #E2E8F0">
    <div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:8px">Hola equipo,</div>
    <div style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:8px">
      Adjunto el resumen de producci&oacute;n del d&iacute;a y la evoluci&oacute;n de los &uacute;ltimos ${ultimas5.length} d&iacute;as.<br>
      M&aacute;s all&aacute; de los n&uacute;meros, lo importante es la tendencia: &#128200; c&oacute;mo estamos avanzando y d&oacute;nde podemos mejorar.
    </div>
    <div style="font-size:12px;color:#475569;margin-bottom:4px">Sigamos enfocados en:</div>
    <table cellpadding="0" cellspacing="0" style="margin-left:8px">
      <tr><td style="padding:2px 0;font-size:12px;color:#0F172A">&#9679;&nbsp; <strong>Precisi&oacute;n</strong></td></tr>
      <tr><td style="padding:2px 0;font-size:12px;color:#0F172A">&#9679;&nbsp; <strong>Performance</strong></td></tr>
      <tr><td style="padding:2px 0;font-size:12px;color:#0F172A">&#9679;&nbsp; <strong>Trabajo en equipo</strong></td></tr>
    </table>
  </td></tr>

  <!-- TOP 3 OPERARIAS -->
  <tr><td bgcolor="#0D1B2E" style="background:#0D1B2E;padding:16px 22px">
    <div style="font-size:10px;font-weight:700;color:#4D7AAA;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">&#127942; Top 3 operarias del d&iacute;a</div>
    ${(function(){
      var rankMap={};
      (rawData||[]).forEach(function(r){
        if(r.fecha===hoy&&r.tipo!=='insumo'&&r.canal!=='Anulada'&&DB[r.usuario])
          rankMap[r.usuario]=(rankMap[r.usuario]||0)+Number(r.cantidad||0);
      });
      var ranking=Object.keys(rankMap).map(function(u){return[u,rankMap[u]];}).sort(function(a,b){return b[1]-a[1];});
      var top3=ranking.slice(0,3);
      if(!top3.length) return '<div style="color:#4D7AAA;font-size:11px;text-align:center">Sin datos de ranking</div>';
      var cfgs=[
        {pos:'1&deg;',emoji:'&#129351;',border:'#C0C0C0',bg:'linear-gradient(180deg,#1a1a1a,#111)',col:'#E8E8E8',fEmoji:'30',fPos:'11',fNom:'13',fNum:'28'},
        {pos:'2&deg;',emoji:'&#129352;',border:'#C8A800',bg:'linear-gradient(180deg,#2a1f00,#1a1400)',col:'#C8A800',fEmoji:'24',fPos:'10',fNom:'12',fNum:'22'},
        {pos:'3&deg;',emoji:'&#129353;',border:'#CD7F32',bg:'linear-gradient(180deg,#1a0d00,#110900)',col:'#CD7F32',fEmoji:'20',fPos:'9',fNom:'11',fNum:'18'}
      ];
      var order=[1,0,2]; // visual: izq=2°, centro=1°, der=3°
      var html='<table cellpadding="0" cellspacing="0" width="100%"><tr>';
      order.forEach(function(vi){
        if(vi>=top3.length){html+='<td width="33%" style="padding:0 4px"></td>';return;}
        var uid=top3[vi][0],val=top3[vi][1],nom=DB[uid]||uid;
        var cfg=cfgs[vi]; // cfgs[0]=gold(1°), cfgs[1]=silver(2°), cfgs[2]=bronze(3°)
        var padTd=vi===0?'8':'12'; // 1° con menos padding de tabla para compensar tamaño mayor
        html+='<td width="33%" align="center" valign="bottom" style="padding:0 4px">'
          +'<table cellpadding="'+padTd+'" cellspacing="0" width="100%" style="background:'+cfg.bg+';border:2px solid '+cfg.border+';border-radius:10px"><tr><td align="center">'
          +'<div style="font-size:'+cfg.fEmoji+'px;margin-bottom:3px">'+cfg.emoji+'</div>'
          +'<div style="font-size:'+cfg.fPos+'px;font-weight:700;color:'+cfg.col+';margin-bottom:5px">'+cfg.pos+' LUGAR</div>'
          +'<div style="font-size:'+cfg.fNom+'px;font-weight:700;color:#FFF;margin-bottom:8px">'+nom+'</div>'
          +'<div style="font-size:'+cfg.fNum+'px;font-weight:900;color:'+cfg.col+';line-height:1">'+val.toLocaleString('es-CL')+'</div>'
          +'<div style="font-size:10px;color:#8AAED4;margin-top:3px">unidades</div>'
          +'</td></tr></table></td>';
      });
      return html+'</tr></table>';
    })()}
  </td></tr>

  <!-- CAPACIDAD VS PRODUCCIÓN -->
  <tr><td bgcolor="#F1F5F9" style="background:#F1F5F9;padding:14px 22px 4px">
    <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.08em">&#128200; Capacidad vs Producci&oacute;n</div>
  </td></tr>
  <tr><td bgcolor="#F1F5F9" style="background:#F1F5F9;padding:0 14px 4px">
    <table cellpadding="0" cellspacing="0" width="100%"><tr>
      <td width="20%" align="center" style="padding:3px">
        <table cellpadding="10" cellspacing="0" width="100%" bgcolor="#0D1B2E" style="background:#0D1B2E;border:1px solid #1E3A5F;border-radius:10px"><tr><td align="center">
          <div style="font-size:9px;font-weight:700;color:#8AAED4;text-transform:uppercase;margin-bottom:4px">Operarias</div>
          <div style="font-size:22px">&#128101;</div>
          <div style="font-size:22px;font-weight:900;color:#FFF;line-height:1">${dotacionKpi}</div>
          <div style="font-size:9px;color:#4D7AAA;margin-top:2px">personas</div>
        </td></tr></table>
      </td>
      <td width="20%" align="center" style="padding:3px">
        <table cellpadding="10" cellspacing="0" width="100%" bgcolor="#0D1B2E" style="background:#0D1B2E;border:1px solid #1E3A5F;border-radius:10px"><tr><td align="center">
          <div style="font-size:9px;font-weight:700;color:#8AAED4;text-transform:uppercase;margin-bottom:4px">Capacidad</div>
          <div style="font-size:22px">&#127919;</div>
          <div style="font-size:18px;font-weight:900;color:#3B8FFF;line-height:1">${capTotal.toLocaleString('es-CL')}</div>
          <div style="font-size:9px;color:#4D7AAA;margin-top:2px">unidades</div>
        </td></tr></table>
      </td>
      <td width="20%" align="center" style="padding:3px">
        <table cellpadding="10" cellspacing="0" width="100%" bgcolor="#0D1B2E" style="background:#0D1B2E;border:1px solid #1E3A5F;border-radius:10px"><tr><td align="center">
          <div style="font-size:9px;font-weight:700;color:#8AAED4;text-transform:uppercase;margin-bottom:4px">Producci&oacute;n</div>
          <div style="font-size:22px">&#128230;</div>
          <div style="font-size:18px;font-weight:900;color:${semCol};line-height:1">${prodReal.toLocaleString('es-CL')}</div>
          <div style="font-size:9px;color:#4D7AAA;margin-top:2px">offline: ${offline.toLocaleString('es-CL')} &middot; online: ${online.toLocaleString('es-CL')}</div>
        </td></tr></table>
      </td>
      <td width="20%" align="center" style="padding:3px">
        <table cellpadding="10" cellspacing="0" width="100%" bgcolor="#0D1B2E" style="background:#0D1B2E;border:1px solid #1E3A5F;border-radius:10px"><tr><td align="center">
          <div style="font-size:9px;font-weight:700;color:#8AAED4;text-transform:uppercase;margin-bottom:4px">Prom./persona</div>
          <div style="font-size:22px">&#129489;</div>
          <div style="font-size:18px;font-weight:900;color:#FFB84D;line-height:1">${dotacionKpi>0?Math.round(prodReal/dotacionKpi).toLocaleString('es-CL'):0}</div>
          <div style="font-size:9px;color:#4D7AAA;margin-top:2px">uds / persona</div>
        </td></tr></table>
      </td>
      <td width="20%" align="center" style="padding:3px">
        <table cellpadding="10" cellspacing="0" width="100%" bgcolor="${semBg}" style="background:${semBg};border:2px solid ${semCol};border-radius:10px"><tr><td align="center">
          <div style="font-size:9px;font-weight:700;color:${semCol};text-transform:uppercase;margin-bottom:4px">Uso cap.</div>
          <div style="font-size:22px">&#9201;</div>
          <div style="font-size:22px;font-weight:900;color:${semCol};line-height:1">${cumplPct}%</div>
          <div style="font-size:9px;color:${semCol};margin-top:2px">de capacidad</div>
        </td></tr></table>
      </td>
    </tr></table>
  </td></tr>
  <tr><td bgcolor="#F1F5F9" style="padding:0 22px 10px"><div style="border-top:2px solid #CBD5E1"></div></td></tr>

  <!-- 5. TENDENCIA EQUIPO 5 DIAS -->
  <tr><td bgcolor="#FFF" style="background:#FFF;padding:14px 22px;border-top:2px solid #E2E8F0">
    <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">
      &#128200; Tendencia equipo &middot; &uacute;ltimos 5 d&iacute;as
      <span style="color:${deltaColor};font-weight:800">&nbsp;${deltaSign}${Math.abs(delta5).toLocaleString('es-CL')} vs ayer</span>
    </div>
    ${trendChart}
  </td></tr>

  <!-- 6. TENDENCIA POR CANAL -->
  <tr><td bgcolor="#FFF" style="background:#FFF;padding:0 22px 14px;border-bottom:1px solid #E2E8F0">
    <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">&#128230; Producci&oacute;n por canal &middot; tendencia 5 d&iacute;as</div>
    <table cellpadding="0" cellspacing="0" width="100%">${canalFilasHTML}</table>
  </td></tr>

  <!-- 7. TENDENCIA POR MATERIAL -->
  <tr><td bgcolor="#FFF" style="background:#FFF;padding:14px 22px;border-bottom:1px solid #E2E8F0">
    <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">&#129518; Mix de materiales &middot; tendencia 5 d&iacute;as</div>
    <table cellpadding="0" cellspacing="0" width="100%">${tipoFilasHTML}</table>
  </td></tr>

  <!-- 8. PLAN SEMANAL -->
  ${planEmailSem}

  <!-- FIRMA -->
  <tr><td bgcolor="#F8FAFC" style="background:#F8FAFC;padding:16px 22px;border-top:2px solid #E2E8F0;border-bottom:1px solid #E2E8F0">
    <div style="font-size:13px;font-weight:700;color:#0F172A">Diego Mancilla</div>
    <div style="font-size:11px;color:#64748B;margin-top:2px">Supervisor de Operaciones Log&iacute;sticas</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:1px">Samsonite Chile &middot; CD Lo Boza</div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td bgcolor="#0D1B2E" style="background:#0D1B2E;border-radius:0 0 10px 10px;padding:12px 22px">
    <table cellpadding="0" cellspacing="0" width="100%"><tr>
      <td valign="middle">
        <div style="font-size:11px;color:#4D7AAA">Reporte generado autom&aacute;ticamente · CD Lo Boza</div>
      </td>
      <td valign="middle" align="right">
        <div style="font-size:10px;color:#4D7AAA">&#127937; &iexcl;Buen trabajo equipo!</div>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>`;
  return _raw.replace(/>\s+</g,'><').replace(/\n\s*/g,'').replace(/\s{2,}/g,' ');
}

async function cargarDatosReporte(){
  const body=document.getElementById('rpt-body-contenido');
  const fechaSel=document.getElementById('rpt-fecha-sel')?.value||fechaLocalStr(new Date());
  body.innerHTML='<div class="loading"><span class="spinner"></span>Cargando datos...</div>';
  document.getElementById('btn-rpt-enviar').disabled=true;
  try{
    rptDatos=await fetchRptDatos(fechaSel);
    renderRptBody(rptDatos);
    document.getElementById('btn-rpt-enviar').disabled=false;
  }catch(e){
    body.innerHTML='<div style="color:#FF8080;font-size:13px;padding:16px">Error al cargar: '+e.message+'</div>';
  }
}

async function cargarPlanCompacto(){
  const card = document.getElementById('plan-compacto-card');
  const el   = document.getElementById('plan-compacto-contenido');
  if(!card||!el) return;

  try{
    const anio    = new Date().getFullYear();
    const semActual = isoWeekActual();

    // Fetch plan semana actual
    const planRaw = await sbFetchAll(
      `plan_carga?select=canal,tipo,unidades_plan&semana_iso=eq.${semActual}&anio=eq.${anio}`
    );
    if(!planRaw||!planRaw.length){ card.style.display='none'; return; }

    // Fechas semana actual
    const {lun,vie} = isoSemanaAFechas(anio, semActual);
    const hoyStr    = fechaLocalStr(new Date());
    const vieStr    = fechaLocalStr(vie);
    const fLun      = fechaLocalStr(lun);
    const fHasta    = hoyStr <= vieStr ? hoyStr : vieStr;

    // Producción acumulada semana actual (sin insumos, anuladas, BTS)
    // usando sbFetchAll que ya maneja paginación y RLS
    const prodRaw = await sbFetchAll(
      `produccion?select=usuario,canal,tipo,cantidad&fecha=gte.${fLun}&fecha=lte.${fHasta}&canal=neq.Anulada&canal=neq.BTS&canal=neq.Regula&tipo=neq.insumo&order=id.asc`
    );
    const prodFilt = (prodRaw||[]).filter(r=>DB[r.usuario]!==undefined);

    // Días hábiles
    const diasSem   = diasHabileSem(lun,vie,null);
    const diasHasta = diasHabileSem(lun,vie,new Date(fHasta+'T12:00:00'));
    const nDiasTransc = diasHasta.length;
    const nDiasRest   = diasSem.length - nDiasTransc;
    const pctEsp      = diasSem.length>0 ? Math.round(nDiasTransc/diasSem.length*100) : 0;

    // Totales
    const metaMap={}, prodMap={};
    planRaw.forEach(r=>{ metaMap[r.canal]=(metaMap[r.canal]||0)+Number(r.unidades_plan); });
    prodFilt.forEach(r=>{ prodMap[r.canal]=(prodMap[r.canal]||0)+Number(r.cantidad); });

    const totalMeta = Object.values(metaMap).reduce((s,v)=>s+v,0);
    const totalProd = Object.values(prodMap).reduce((s,v)=>s+v,0);
    const totalRest = Math.max(totalMeta-totalProd,0);
    const pctAv     = totalMeta>0?Math.round(totalProd/totalMeta*100):0;
    const ritmo     = nDiasTransc>0?Math.round(totalProd/nDiasTransc):0;
    const metaDia   = nDiasRest>0?Math.round(totalRest/nDiasRest):0;
    const sc        = semColor(pctAv);

    card.style.display='block';

    // KPIs fila superior
    let html=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
      <div style="background:${sc.bg};border:1px solid ${sc.c}30;border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:${sc.c};text-transform:uppercase">Avance S${semActual}</div>
        <div style="font-size:22px;font-weight:800;color:${sc.c};line-height:1.1">${pctAv}%</div>
        <div style="font-size:9px;color:${sc.c}">${sc.ico} esp. ${pctEsp}%</div>
      </div>
      <div style="background:var(--card2);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:var(--txt2);text-transform:uppercase">Ritmo</div>
        <div style="font-size:22px;font-weight:800;color:var(--txt);line-height:1.1">${fmtN(ritmo)}</div>
        <div style="font-size:9px;color:var(--txt2)">uds/día</div>
      </div>
      <div style="background:#FEF3C7;border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:#92400E;text-transform:uppercase">Meta hoy</div>
        <div style="font-size:22px;font-weight:800;color:#92400E;line-height:1.1">${fmtN(metaDia)}</div>
        <div style="font-size:9px;color:#92400E">uds para cerrar</div>
      </div>
    </div>`;

    // Barras por canal
    const ORDEN=['Locales','Concesiones','Grandes Tiendas','Distribuidor','Ecommerce','Marketplace','Venta en verde'];
    ORDEN.forEach(canal=>{
      const meta=metaMap[canal]||0, prod=prodMap[canal]||0;
      if(!meta&&!prod) return;
      const pct=meta>0?Math.round(prod/meta*100):0;
      const esc=semColor(pct);
      const delta=pct-pctEsp;
      html+=`<div style="margin-bottom:7px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-size:11px;font-weight:600">${canal}</span>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:9px;color:${delta>=0?'#16A34A':'#DC2626'}">${delta>=0?'+':''}${delta}pp</span>
            <span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:${esc.bg};color:${esc.c}">${esc.ico} ${pct}%</span>
          </div>
        </div>
        <div style="background:var(--card2);border-radius:3px;height:7px;position:relative;overflow:hidden">
          <div style="position:absolute;top:0;left:0;width:${Math.min(pctEsp,100)}%;height:100%;background:var(--txt2);opacity:.2;border-radius:3px"></div>
          <div style="position:absolute;top:0;left:0;width:${Math.min(pct,100)}%;height:100%;background:${esc.c};border-radius:3px"></div>
        </div>
      </div>`;
    });

    // Alerta canal más atrasado
    const masAtr = ORDEN
      .filter(cn=>metaMap[cn]>0)
      .map(cn=>({canal:cn,pct:metaMap[cn]>0?Math.round((prodMap[cn]||0)/metaMap[cn]*100):0,
                  rest:Math.max(metaMap[cn]-(prodMap[cn]||0),0)}))
      .sort((a,b)=>a.pct-b.pct)[0];

    if(masAtr && masAtr.pct < pctEsp){
      const mdC = nDiasRest>0?Math.round(masAtr.rest/nDiasRest):0;
      html+=`<div style="background:#FEE2E2;border:1px solid #FECACA;border-radius:8px;padding:10px;display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <div>
          <div style="font-size:10px;font-weight:700;color:#991B1B">⚠️ Más atrasado</div>
          <div style="font-size:12px;font-weight:700;color:#7F1D1D">${masAtr.canal}</div>
          <div style="font-size:10px;color:#991B1B">${masAtr.pct}% de avance</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:9px;color:#991B1B;text-transform:uppercase">Necesita</div>
          <div style="font-size:18px;font-weight:800;color:#DC2626">${fmtN(mdC)}</div>
          <div style="font-size:9px;color:#991B1B">uds/día</div>
        </div>
      </div>`;
    }

    el.innerHTML = html;

  }catch(e){
    console.error('cargarPlanCompacto:',e);
    card.style.display='none';
  }
}

function renderSelectorDia(lun, hoyLocal){
  const nombres = ['L','M','M','J','V'];
  const cont = _getPlanEl('plan-selector-dia');
  if(!cont) return;
  let html = `<button onclick="seleccionarDiaPlan(null)" style="flex-shrink:0;padding:6px 12px;border-radius:8px;border:1px solid ${!planDiaActual?'#3B8FFF':'var(--border)'};background:${!planDiaActual?'#3B8FFF22':'var(--card)'};color:${!planDiaActual?'#5AABFF':'var(--txt3)'};font-size:11px;font-weight:700;white-space:nowrap">Semana</button>`;
  for(let i=0;i<5;i++){ // solo lun-vie (días hábiles, igual que el resto de la app)
    const d = new Date(lun.getFullYear(), lun.getMonth(), lun.getDate()+i);
    const fStr = fechaLocalStr(d);
    const esFuturo = fStr > hoyLocal;
    const activo = planDiaActual === fStr;
    const dd = String(d.getDate()).padStart(2,'0');
    html += `<button ${esFuturo?'disabled':`onclick="seleccionarDiaPlan('${fStr}')"`} style="flex-shrink:0;width:38px;padding:6px 0;border-radius:8px;border:1px solid ${activo?'#3B8FFF':'var(--border)'};background:${activo?'#3B8FFF22':'var(--card)'};color:${esFuturo?'var(--txt3)':activo?'#5AABFF':'var(--txt2)'};font-size:11px;font-weight:700;opacity:${esFuturo?'.35':'1'}">
      <div>${nombres[i]}</div>
      <div style="font-size:9px;font-weight:600;opacity:.8">${dd}</div>
    </button>`;
  }
  cont.innerHTML = html;
  // Texto guía debajo del selector
  let hint = document.getElementById('plan-selector-dia-hint');
  if(!hint){
    hint = document.createElement('div');
    hint.id = 'plan-selector-dia-hint';
    hint.style.cssText = 'font-size:9px;color:var(--txt3);margin-top:4px;text-align:center';
    cont.parentElement.insertBefore(hint, cont.nextSibling);
  }
  if(planDiaActual){
    const dts = new Date(planDiaActual+'T12:00:00');
    const nombreDia = dts.toLocaleDateString('es-CL',{weekday:'long'});
    hint.textContent = `Mostrando acumulado Lun → ${nombreDia.charAt(0).toUpperCase()+nombreDia.slice(1)} (corte al día seleccionado)`;
  } else {
    hint.textContent = '';
  }
}
function seleccionarDiaPlan(fecha){
  planDiaActual = fecha;
  const _anio = new Date().getFullYear();
  if(_planCache.sem===planSemActual && _planCache.anio===_anio && _planCache.planRaw){
    renderSelectorDia(_planCache.lunObj, fechaLocalStr(new Date()));
    _renderFromCache();
    return;
  }
  invalidarPlanCache();
  cargarPlanSemanal();
}

function renderResumenEjecutivo(p){
  const {totalPlan,totalProd,nDiasParaRitmo,nDiasRest,metaCanalMap,prodCanalMap,planSemActual,planDiaActual,diasSem} = p;
  const el = document.getElementById('plan-resumen-ejecutivo');
  if(!el) return;
  if(!totalPlan){ el.innerHTML=''; return; }

  // ── Lógica central: meta diaria fija = plan / 5 ──────────────────────────
  const metaDiaria      = Math.round(totalPlan / 5);
  const esperadoAcorte  = metaDiaria * nDiasParaRitmo;   // acumulado esperado al corte
  const gapReal         = totalProd - esperadoAcorte;     // + adelantado, - atrasado
  const diasRestSemana  = 5 - nDiasParaRitmo;            // días que quedan desde el corte

  // ── Semáforo basado en real vs esperado acumulado ────────────────────────
  let statusWord, sc;
  if(totalProd >= totalPlan){
    statusWord = 'En rango'; sc = {c:'#2ECC8A', ico:'✅'};
  } else if(totalProd >= esperadoAcorte){
    statusWord = 'En rango'; sc = {c:'#2ECC8A', ico:'🟢'};
  } else if(totalProd >= esperadoAcorte * 0.85){
    statusWord = 'Atención'; sc = {c:'#F59E0B', ico:'🟡'};
  } else {
    statusWord = 'Crítico';  sc = {c:'#EF4444', ico:'🔴'};
  }

  // ── Canal más atrasado (vs su propia meta proporcional) ──────────────────
  const ORDEN_CANALES=['Locales','Concesiones','Grandes Tiendas','Distribuidor','Ecommerce','Marketplace','Venta en verde'];
  const masAtrasado = ORDEN_CANALES
    .filter(cn=>metaCanalMap[cn]>0)
    .map(cn=>{
      const metaCanalDia  = Math.round(metaCanalMap[cn] / 5);
      const esperadoCanal = metaCanalDia * nDiasParaRitmo;
      const prodCanal     = prodCanalMap[cn] || 0;
      return { canal:cn, prod:prodCanal, esperado:esperadoCanal, gap:prodCanal-esperadoCanal,
               rest:Math.max(metaCanalMap[cn]-prodCanal,0) };
    })
    .sort((a,b)=>a.gap-b.gap)[0];

  // ── Prefijo día ──────────────────────────────────────────────────────────
  const prefijoCorte = planDiaActual
    ? (()=>{ const n=new Date(planDiaActual+'T12:00:00').toLocaleDateString('es-CL',{weekday:'long'}); return `Corte al ${n.charAt(0).toUpperCase()+n.slice(1)}: `; })()
    : '';

  // ── Frase unificada para todos los días ──────────────────────────────────
  let frase;
  const gapFmt = fmtN(Math.abs(gapReal));
  const sobreOBajo = gapReal >= 0
    ? `<span style="color:#2ECC8A;font-weight:700">+${gapFmt} uds sobre la meta</span>`
    : `<span style="color:#EF4444;font-weight:700">${gapFmt} uds bajo la meta</span>`;

  if(totalProd >= totalPlan){
    frase = `Plan semanal completado — ${fmtN(totalProd)} de ${fmtN(totalPlan)} uds. ¡Buen cierre de semana!`;
  } else {
    frase  = `${fmtN(totalProd)} uds embaladas. Meta acumulada al corte: ${fmtN(esperadoAcorte)} uds (${fmtN(metaDiaria)}/día × ${nDiasParaRitmo} día${nDiasParaRitmo>1?'s':''}) — ${sobreOBajo}.`;
    // Canal más atrasado (solo si está genuinamente bajo su meta proporcional)
    if(masAtrasado && masAtrasado.gap < 0){
      const necesarioPorDia = diasRestSemana > 0
        ? Math.round(masAtrasado.rest / diasRestSemana)
        : masAtrasado.rest;
      frase += ` Canal más atrasado: <strong>${masAtrasado.canal}</strong> (${fmtN(masAtrasado.prod)} de ${fmtN(masAtrasado.esperado)} esperadas)${diasRestSemana>0?' — necesita '+fmtN(necesarioPorDia)+' uds/día para cerrar':''}.`;
    }
  }

  el.innerHTML =
    '<div style="background:var(--card);border:1px solid '+sc.c+'40;border-left:4px solid '+sc.c+';border-radius:var(--r);padding:14px 16px;display:flex;gap:12px;align-items:flex-start">'
    +'<div style="font-size:22px;line-height:1;flex-shrink:0">'+sc.ico+'</div>'
    +'<div style="flex:1;min-width:0">'
    +'<div style="font-size:10px;font-weight:800;color:'+sc.c+';text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">'+statusWord+' &middot; Semana '+planSemActual+'</div>'
    +'<div style="font-size:13px;color:var(--txt);line-height:1.55">'+prefijoCorte+frase+'</div>'
    +'</div></div>';
}

// ── Estado Operacional: nueva tarjeta central de arrastre ──────────────────
function renderEstadoOperacional(opts){
  // opts: { totalPlan, totalCarg, totalProd, backlogPorCanal, diasSem, prodFiltradaSemana, entregasPorFecha, planDiaActual }
  var totalPlan    = opts.totalPlan    || 0;
  var totalCarg    = opts.totalCarg    || 0;
  var totalProd    = opts.totalProd    || 0;  // embalado semana actual
  var backlog      = opts.backlogPorCanal || {};
  var diasSem      = opts.diasSem      || [];
  var prodRawSem   = opts.prodFiltradaSemana || [];
  var entregasPorFecha = opts.entregasPorFecha || {};
  var planDiaActual    = opts.planDiaActual || null;

  // Arrastre inicial S-1 — usar valor fijo guardado en caché/localStorage para estabilidad
  // Si no viene fijo, calcular desde backlog (primer render)
  var arrastreInicial = (opts.arrastreInicialFijo != null)
    ? opts.arrastreInicialFijo
    : Object.keys(backlog).reduce(function(s,c){
        return s + (backlog[c].pendiente||0) + (backlog[c].consumido||0);
      }, 0);
  // Lo embalado de arrastre esta semana = consumido del backlog
  var arrastreConsumido = Object.keys(backlog).reduce(function(s,c){ return s+(backlog[c].consumido||0); }, 0);
  // Arrastre pendiente = max(arrastreInicial - consumido, 0)
  var arrastrePendiente = Math.max(arrastreInicial - arrastreConsumido, 0);
  // % absorción
  var pctAbsorcion = arrastreInicial > 0 ? Math.round(arrastreConsumido / arrastreInicial * 100) : 0;
  // Total embalado = arrastre consumido + embalado de carga actual
  var embDeCargaActual = Math.max(totalProd - arrastreConsumido, 0);
  var totalEmbalado = arrastreConsumido + embDeCargaActual; // == totalProd
  // % cargado del plan
  var pctCargPlan = totalPlan > 0 ? Math.round(totalCarg / totalPlan * 100) : 0;

  // Estado semafórico
  var estadoIcon, estadoTxt, estadoCol;
  if(!arrastreInicial){
    estadoIcon = '🟢'; estadoTxt = 'Sin arrastre de semana anterior'; estadoCol = '#2ECC8A';
  } else if(arrastrePendiente === 0){
    estadoIcon = '🟢'; estadoTxt = 'Arrastre completado'; estadoCol = '#2ECC8A';
  } else if(pctAbsorcion >= 50){
    estadoIcon = '🟡'; estadoTxt = 'Absorbiendo arrastre — más del 50% absorbido'; estadoCol = '#FFBA4D';
  } else {
    estadoIcon = '🟡'; estadoTxt = 'Absorbiendo arrastre'; estadoCol = '#FFBA4D';
  }

  var idsSAnt           = opts.idEntregasSAnt    || new Set();
  var embalBackPorFecha = opts.embalBackPorFecha  || {};

  // embalCargaPorFecha = total diario - back diario
  var embalTotalPorFecha = {};
  prodRawSem.forEach(function(r){
    var f = (r.fecha||'').toString().slice(0,10);
    if(f) embalTotalPorFecha[f] = (embalTotalPorFecha[f]||0) + (Number(r.cantidad)||0);
  });
  var embalCargaPorFecha = {};
  Object.keys(embalTotalPorFecha).forEach(function(f){
    embalCargaPorFecha[f] = Math.max((embalTotalPorFecha[f]||0) - (embalBackPorFecha[f]||0), 0);
  });
  var embalPorFecha = embalTotalPorFecha;

  // ── Ajuste para vista de día: arrastreConsumido acumulado hasta planDiaActual ──
  // Cuando hay un día seleccionado, el arrastre absorbido es solo el acumulado hasta ese día
  var arrastreConsumidoVista = arrastreConsumido; // valor semana completa
  if(planDiaActual){
    arrastreConsumidoVista = Object.keys(embalBackPorFecha).reduce(function(s,f){
      return f <= planDiaActual ? s + (embalBackPorFecha[f]||0) : s;
    }, 0);
    arrastreConsumidoVista = Math.min(arrastreConsumidoVista, arrastreInicial);
  }
  // embDeCargaActual = totalProd del período - arrastre absorbido en ese mismo período
  var embDeCargaActual = Math.max(totalProd - arrastreConsumidoVista, 0);
  var totalEmbalado    = arrastreConsumidoVista + embDeCargaActual; // debe == totalProd
  // Recalcular pendiente y % absorción para la vista del día
  var arrastrePendienteVista = Math.max(arrastreInicial - arrastreConsumidoVista, 0);
  var pctAbsorcionVista = arrastreInicial > 0 ? Math.round(arrastreConsumidoVista / arrastreInicial * 100) : 0;

  // ── KPIs adicionales para nueva UI ──
  var pctEmbalDeCarg  = totalCarg > 0 ? Math.round(embDeCargaActual / totalCarg * 100) : 0;
  var pctEmbTotalPlan = totalPlan > 0 ? Math.round(totalEmbalado / totalPlan * 100) : 0;
  var pctEmbBackAbs   = arrastreInicial > 0 ? Math.round(arrastreConsumidoVista / arrastreInicial * 100) : 0;
  // Colores dinámicos % embalado de cargado
  var colPctCarg = pctEmbalDeCarg >= 80 ? '#2ECC8A' : pctEmbalDeCarg >= 50 ? '#FFBA4D' : '#EF4444';
  // Circunferencia SVG para el donut (r=22 → circ=138.2)
  var circDonut = 138.2;
  var pctBack = totalEmbalado > 0 ? arrastreConsumidoVista / totalEmbalado : 0;
  var pctNueva = 1 - pctBack;
  var dashBack  = Math.round(pctBack  * circDonut * 10) / 10;
  var dashNueva = Math.round(pctNueva * circDonut * 10) / 10;
  var pctBackPct  = totalEmbalado > 0 ? Math.round(pctBack  * 100) : 0;
  var pctNuevaPct = totalEmbalado > 0 ? Math.round(pctNueva * 100) : 0;
  // Pendiente por cargar y por embalar (para fila ritmo)
  var pendCargarEO  = Math.max(totalPlan - totalCarg, 0);
  var pendEmbalEO   = Math.max(totalCarg - embDeCargaActual, 0);
  // Ritmo diario real (días con producción)
  var diasConProd = planDiaActual
    ? diasSem.filter(function(d){ return d.fecha <= planDiaActual && (embalTotalPorFecha[d.fecha]||0) > 0; }).length
    : diasSem.filter(function(d){ return (embalTotalPorFecha[d.fecha]||0) > 0; }).length;
  var ritmoDiario = diasConProd > 0 ? Math.round(totalEmbalado / diasConProd) : 0;
  var diasTranscEO = planDiaActual ? diasSem.filter(function(d){ return d.fecha <= planDiaActual; }).length : diasConProd;
  var totalDiasEO  = diasSem.length || 5;

  // ── Render Estado Operacional ──
  var elEO = _getPlanEl('plan-estado-operacional');
  if(elEO) elEO.innerHTML = ''

  // ── CARD 1: Estado Operacional ──
  + '<div style="background:linear-gradient(135deg,rgba(15,30,53,1) 0%,rgba(10,22,40,1) 100%);border:1px solid rgba(59,143,255,.3);border-radius:16px;padding:14px;position:relative;overflow:hidden;margin-bottom:8px">'
    + '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#3B8FFF,#2ECC8A,transparent)"></div>'
    + '<div style="font-size:10px;font-weight:800;color:var(--txt3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Estado Operacional</div>'

    // Fila 1: Plan / Cargado — con barra de progreso
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'
      + '<div style="background:rgba(59,143,255,.08);border:1px solid rgba(59,143,255,.2);border-radius:10px;padding:10px 12px">'
        + '<div style="font-size:9px;font-weight:700;color:#3B8FFF;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Plan Semana</div>'
        + '<div style="font-size:26px;font-weight:900;color:#3B8FFF;line-height:1">' + fmtN(totalPlan) + '</div>'
        + '<div style="font-size:9px;color:rgba(59,143,255,.5);margin-top:2px">unidades totales</div>'
      + '</div>'
      + '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:10px 12px">'
        + '<div style="font-size:9px;font-weight:700;color:#F59E0B;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Cargado</div>'
        + '<div style="font-size:26px;font-weight:900;color:#F59E0B;line-height:1">' + (totalCarg > 0 ? fmtN(totalCarg) : '—') + '</div>'
        + (totalPlan > 0 && totalCarg > 0
          ? '<div style="margin-top:5px"><div style="display:flex;justify-content:space-between;font-size:8px;color:rgba(245,158,11,.65);margin-bottom:2px"><span>' + pctCargPlan + '% del plan</span><span>' + fmtN(totalCarg) + '/' + fmtN(totalPlan) + '</span></div>'
            + '<div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + Math.min(pctCargPlan,100) + '%;background:#F59E0B;border-radius:3px"></div></div></div>'
          : '<div style="font-size:9px;color:rgba(245,158,11,.4);margin-top:2px">sin datos</div>')
      + '</div>'
    + '</div>'

    // % Embalado de lo Cargado (NUEVO destacado)
    + (totalCarg > 0
      ? '<div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 12px;margin-bottom:8px">'
          + '<div style="position:relative;width:56px;height:56px;flex:0 0 56px">'
            + '<svg width="56" height="56" viewBox="0 0 56 56" style="position:absolute;inset:0;transform:rotate(-90deg)">'
              + '<circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="6"/>'
              + '<circle cx="28" cy="28" r="22" fill="none" stroke="' + colPctCarg + '" stroke-width="6"'
              + ' stroke-dasharray="138.2" stroke-dashoffset="' + (138.2 * (1 - pctEmbalDeCarg/100)).toFixed(1) + '"'
              + ' stroke-linecap="round"/>'
            + '</svg>'
            + '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:' + colPctCarg + '">' + pctEmbalDeCarg + '%</div>'
          + '</div>'
          + '<div style="flex:1">'
            + '<div style="font-size:9px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">% Embalado de lo Cargado</div>'
            + '<div style="font-size:22px;font-weight:900;color:' + colPctCarg + ';line-height:1">' + pctEmbalDeCarg + '%</div>'
            + '<div style="font-size:8px;color:var(--txt3);margin-top:1px">' + fmtN(embDeCargaActual) + ' embalados de ' + fmtN(totalCarg) + ' cargados</div>'
            + '<div style="height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;margin-top:5px"><div style="height:100%;width:' + Math.min(pctEmbalDeCarg,100) + '%;background:linear-gradient(90deg,' + colPctCarg + ',#3B8FFF);border-radius:3px"></div></div>'
          + '</div>'
        + '</div>'
      : '')

    // Bloque Arrastre S-1 (solo si hay arrastre)
    + (arrastreInicial > 0
      ? '<div style="background:rgba(239,68,68,.05);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:10px 12px;margin-bottom:8px">'
          + '<div style="font-size:9px;font-weight:700;color:#EF4444;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">⚠ Avance Arrastre S-1</div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">'
            + '<div style="text-align:center">'
              + '<div style="font-size:8px;color:var(--txt3);margin-bottom:2px">Inicial</div>'
              + '<div style="font-size:20px;font-weight:900;color:#EF4444;line-height:1">' + fmtN(arrastreInicial) + '</div>'
            + '</div>'
            + '<div style="text-align:center;border-left:1px solid rgba(255,255,255,.07);border-right:1px solid rgba(255,255,255,.07)">'
              + '<div style="font-size:8px;color:var(--txt3);margin-bottom:2px">Absorbido</div>'
              + '<div style="font-size:20px;font-weight:900;color:#2ECC8A;line-height:1">' + fmtN(arrastreConsumidoVista) + '</div>'
              + '<div style="font-size:9px;color:rgba(46,204,138,.5)">' + pctAbsorcionVista + '%</div>'
            + '</div>'
            + '<div style="text-align:center;cursor:pointer" ondblclick="abrirDetalleArrastre()" title="Doble clic para ver detalle pendiente">'              + '<div style="font-size:8px;color:var(--txt3);margin-bottom:2px">Pendiente</div>'              + '<div style="font-size:20px;font-weight:900;color:#FFBA4D;line-height:1">' + fmtN(arrastrePendienteVista) + '</div>'              + '<div style="font-size:8px;color:rgba(255,186,77,.4);margin-top:2px">2× detalle</div>'            + '</div>'
          + '</div>'
          + '<div style="display:flex;gap:2px;margin-top:10px">'
          + (function(){ var b=''; for(var i=0;i<20;i++){ b+='<div style="flex:1;height:8px;background:'+(i/20*100<pctAbsorcionVista?'#2ECC8A':'rgba(255,255,255,.08)')+';border-radius:2px"></div>'; } return b; })()
          + '</div>'
          + '<div style="display:flex;justify-content:space-between;margin-top:3px;font-size:8px;color:rgba(255,255,255,.25)">'
            + '<span>0%</span><span style="color:#2ECC8A;font-weight:700">' + pctAbsorcionVista + '%</span><span>100%</span>'
          + '</div>'
        + '</div>'
      : '')

    // Fila 3: 3 tiles embalado — con % de contexto
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">'
      + '<div style="background:rgba(46,204,138,.07);border:1px solid rgba(46,204,138,.2);border-radius:10px;padding:10px 8px;text-align:center">'
        + '<div style="font-size:8px;font-weight:700;color:#2ECC8A;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Embalado<br>Carga Sem.</div>'
        + '<div style="font-size:20px;font-weight:900;color:#2ECC8A;line-height:1">' + fmtN(embDeCargaActual) + '</div>'
        + (totalCarg > 0 ? '<div style="font-size:9px;color:rgba(46,204,138,.55);margin-top:2px;font-weight:700">' + pctEmbalDeCarg + '% de carg.</div>' : '')
      + '</div>'
      + '<div style="background:rgba(154,136,255,.07);border:1px solid rgba(154,136,255,.2);border-radius:10px;padding:10px 8px;text-align:center">'
        + '<div style="font-size:8px;font-weight:700;color:#9A88FF;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Embalado<br>Arrastre S-1</div>'
        + '<div style="font-size:20px;font-weight:900;color:#9A88FF;line-height:1">' + (arrastreInicial > 0 ? fmtN(arrastreConsumidoVista) : '—') + '</div>'
        + (arrastreInicial > 0 ? '<div style="font-size:9px;color:rgba(154,136,255,.55);margin-top:2px;font-weight:700">' + pctAbsorcionVista + '% abs.</div>' : '')
      + '</div>'
      + '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px 8px;text-align:center">'
        + '<div style="font-size:8px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Total<br>Embalado</div>'
        + '<div style="font-size:20px;font-weight:900;color:var(--txt);line-height:1">' + fmtN(totalEmbalado) + '</div>'
        + (totalPlan > 0 ? '<div style="font-size:9px;color:rgba(255,255,255,.3);margin-top:2px;font-weight:700">' + pctEmbTotalPlan + '% plan</div>' : '')
      + '</div>'
    + '</div>'

    // Fila ritmo — 4 KPIs compactos (NUEVO)
    + '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px">'
      + '<div style="font-size:8px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Indicadores de Ritmo</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px">'
        + '<div style="text-align:center">'
          + '<div style="font-size:7.5px;font-weight:700;color:#3B8FFF;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;line-height:1.3">Ritmo<br>Diario</div>'
          + '<div style="font-size:16px;font-weight:900;color:#3B8FFF;line-height:1">' + (ritmoDiario > 0 ? fmtN(ritmoDiario) : '—') + '</div>'
          + '<div style="font-size:8px;color:rgba(59,143,255,.45);margin-top:1px">uds/día</div>'
        + '</div>'
        + '<div style="text-align:center;border-left:1px solid rgba(255,255,255,.07)">'
          + '<div style="font-size:7.5px;font-weight:700;color:#2ECC8A;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;line-height:1.3">Días<br>Transcurr.</div>'
          + '<div style="font-size:16px;font-weight:900;color:#2ECC8A;line-height:1">' + diasTranscEO + '/' + totalDiasEO + '</div>'
          + '<div style="font-size:8px;color:rgba(46,204,138,.45);margin-top:1px">' + Math.round(diasTranscEO/totalDiasEO*100) + '% sem.</div>'
        + '</div>'
        + '<div style="text-align:center;border-left:1px solid rgba(255,255,255,.07)">'
          + '<div style="font-size:7.5px;font-weight:700;color:#F59E0B;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;line-height:1.3">Pend.<br>Cargar</div>'
          + '<div style="font-size:16px;font-weight:900;color:#F59E0B;line-height:1">' + (pendCargarEO > 0 ? fmtN(pendCargarEO) : '✓') + '</div>'
          + '<div style="font-size:8px;color:rgba(245,158,11,.45);margin-top:1px">unidades</div>'
        + '</div>'
        + '<div style="text-align:center;border-left:1px solid rgba(255,255,255,.07)">'
          + '<div style="font-size:7.5px;font-weight:700;color:#9A88FF;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;line-height:1.3">Pend.<br>Embalar</div>'
          + '<div style="font-size:16px;font-weight:900;color:#9A88FF;line-height:1">' + (pendEmbalEO > 0 ? fmtN(pendEmbalEO) : '✓') + '</div>'
          + '<div style="font-size:8px;color:rgba(154,136,255,.45);margin-top:1px">unidades</div>'
        + '</div>'
      + '</div>'
    + '</div>'

  + '</div>'

  // ── CARD 2: Producción Acumulada con donut (NUEVO) ──
  + (totalEmbalado > 0
    ? '<div style="background:linear-gradient(135deg,rgba(10,25,50,1),rgba(8,18,38,1));border:1px solid rgba(46,204,138,.25);border-radius:14px;padding:14px;margin-bottom:8px;position:relative;overflow:hidden">'
        + '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#2ECC8A,#9A88FF,transparent)"></div>'
        + '<div style="font-size:10px;font-weight:800;color:var(--txt3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">Producción Acumulada</div>'
        // 3 tiles superiores
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">'
          + '<div style="text-align:center;padding:8px 4px;background:rgba(46,204,138,.07);border:1px solid rgba(46,204,138,.2);border-radius:10px">'
            + '<div style="font-size:8px;font-weight:700;color:#2ECC8A;text-transform:uppercase;margin-bottom:3px">Embalado<br>Sem. Actual</div>'
            + '<div style="font-size:18px;font-weight:900;color:#2ECC8A">' + fmtN(embDeCargaActual) + '</div>'
            + '<div style="font-size:8px;color:rgba(46,204,138,.45)">unidades</div>'
          + '</div>'
          + '<div style="text-align:center;padding:8px 4px;background:rgba(154,136,255,.07);border:1px solid rgba(154,136,255,.2);border-radius:10px">'
            + '<div style="font-size:8px;font-weight:700;color:#9A88FF;text-transform:uppercase;margin-bottom:3px">Embalado<br>Backlog S-1</div>'
            + '<div style="font-size:18px;font-weight:900;color:#9A88FF">' + (arrastreInicial > 0 ? fmtN(arrastreConsumidoVista) : '—') + '</div>'
            + '<div style="font-size:8px;color:rgba(154,136,255,.45)">unidades</div>'
          + '</div>'
          + '<div style="text-align:center;padding:8px 4px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px">'
            + '<div style="font-size:8px;font-weight:700;color:var(--txt2);text-transform:uppercase;margin-bottom:3px">Total<br>Embalado</div>'
            + '<div style="font-size:18px;font-weight:900;color:var(--txt)">' + fmtN(totalEmbalado) + '</div>'
            + '<div style="font-size:8px;color:rgba(255,255,255,.28)">unidades</div>'
          + '</div>'
        + '</div>'
        // Donut + leyenda
        + '<div style="display:flex;align-items:center;gap:14px">'
          + '<svg width="80" height="80" viewBox="0 0 80 80" style="flex:0 0 80px">'
            + '<circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="12"/>'
            // Segmento Backlog (arranca en top → rotate -90 externo al SVG)
            + '<circle cx="40" cy="40" r="30" fill="none" stroke="#9A88FF" stroke-width="12"'
            + ' stroke-dasharray="188.5" stroke-dashoffset="0"'
            + ' transform="rotate(-90 40 40)"/>'
            // Segmento Producción nueva encima
            + (embDeCargaActual > 0
              ? '<circle cx="40" cy="40" r="30" fill="none" stroke="#2ECC8A" stroke-width="12"'
                + ' stroke-dasharray="' + (pctNueva * 188.5).toFixed(1) + ' 188.5"'
                + ' stroke-dashoffset="' + (-(pctBack * 188.5)).toFixed(1) + '"'
                + ' transform="rotate(-90 40 40)"/>'
              : '')
          + '</svg>'
          + '<div style="flex:1">'
            + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">'
              + '<div style="width:10px;height:10px;border-radius:50%;background:#9A88FF;flex:0 0 10px"></div>'
              + '<div><div style="font-size:12px;font-weight:800;color:var(--txt)">' + pctBackPct + '% <span style="font-size:9px;font-weight:600;color:var(--txt2)">Backlog S-1</span></div>'
              + '<div style="font-size:9px;color:var(--txt3)">' + fmtN(arrastreConsumidoVista) + ' unidades</div></div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:6px">'
              + '<div style="width:10px;height:10px;border-radius:50%;background:#2ECC8A;flex:0 0 10px"></div>'
              + '<div><div style="font-size:12px;font-weight:800;color:var(--txt)">' + pctNuevaPct + '% <span style="font-size:9px;font-weight:600;color:var(--txt2)">Producción Nueva</span></div>'
              + '<div style="font-size:9px;color:var(--txt3)">' + fmtN(embDeCargaActual) + ' unidades</div></div>'
            + '</div>'
          + '</div>'
        + '</div>'
      + '</div>'
    : '');

  // ── Render Avance Diario ──
  var metaDia = diasSem.length > 0 ? Math.round(totalPlan / diasSem.length) : 0;
  var cargPorFecha = entregasPorFecha || {};
  var filasDiarioV2 = '';
  var arrastreAcumV2 = arrastreInicial;
  var cols = '34px 1fr 48px 52px 52px 56px 54px';
  diasSem.forEach(function(d){
    var cargDia     = cargPorFecha[d.fecha]       || 0;
    var embBackDia  = embalBackPorFecha[d.fecha]  || 0;
    var embCargaDia = embalCargaPorFecha[d.fecha] || 0;
    var embalDia    = embBackDia + embCargaDia;
    // Pendiente back al cierre del día (acumulado, se propaga aunque no haya datos)
    arrastreAcumV2 = Math.max(arrastreAcumV2 - embBackDia, 0);
    var pendBackDia   = arrastreAcumV2;
    var totalEmbalDia = embalDia;
    var esFuturo = planDiaActual ? d.fecha > planDiaActual : false;
    var hayDatos = embalDia > 0 || cargDia > 0;
    var barPct = metaDia > 0 ? Math.min(Math.round(embalDia / metaDia * 100), 100) : 0;
    var colBar = barPct >= 100 ? '#2ECC8A' : barPct >= 70 ? '#FFBA4D' : (hayDatos ? '#EF4444' : 'rgba(255,255,255,.1)');
    // Color Pend.Back: rojo si queda mucho, amarillo si poco, verde si 0
    var colPend = pendBackDia === 0 ? '#2ECC8A' : pendBackDia < arrastreInicial * 0.2 ? '#FFBA4D' : '#EF4444';

    filasDiarioV2 += '<div style="display:grid;grid-template-columns:' + cols + ';gap:2px 3px;align-items:center;padding:6px 2px;border-bottom:1px solid rgba(255,255,255,.04)'
      + (esFuturo ? ';opacity:.3' : '') + '">'
      + '<span style="font-size:11px;font-weight:700;color:var(--txt2)">' + d.nombre + '</span>'
      + '<div style="height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden">'
      +   (barPct > 0 ? '<div style="height:100%;width:' + barPct + '%;background:' + colBar + ';border-radius:2px"></div>' : '')
      + '</div>'
      + '<span style="font-size:10px;text-align:right;color:#F59E0B;font-weight:700">'  + (cargDia     > 0 ? fmtN(cargDia)     : (esFuturo?'':'—')) + '</span>'
      + '<span style="font-size:10px;text-align:right;color:#2ECC8A;font-weight:700">'  + (embCargaDia > 0 ? fmtN(embCargaDia) : (esFuturo?'':'—')) + '</span>'
      + '<span style="font-size:10px;text-align:right;color:#9A88FF;font-weight:700">'  + (arrastreInicial > 0 ? (embBackDia > 0 ? fmtN(embBackDia) : (esFuturo?'':'—')) : '—') + '</span>'
      + '<span style="font-size:10px;text-align:right;font-weight:700;color:' + colPend + '">' + (arrastreInicial > 0 && hayDatos ? fmtN(pendBackDia) : '—') + '</span>'
      + '<span style="font-size:10px;text-align:right;font-weight:800;color:var(--txt)">' + (totalEmbalDia > 0 ? fmtN(totalEmbalDia) : (esFuturo?'':'—')) + '</span>'
      + '</div>';
  });

  // Fila totales — usa arrastreConsumido como fuente única para Emb.Back
  var totalCargSem  = diasSem.reduce(function(s,d){ return s+(cargPorFecha[d.fecha]||0); }, 0);
  var totalEmbCarga = Math.max(totalProd - arrastreConsumido, 0);
  var totalEmbBack  = arrastreConsumido;   // fuente = backlogPorCanal (consistente con tarjeta)
  var totalPendBack = arrastrePendiente;
  var totalEmbTotal = totalProd;
  filasDiarioV2 += '<div style="display:grid;grid-template-columns:' + cols + ';gap:2px 3px;align-items:center;padding:7px 2px;background:rgba(255,255,255,.03);border-radius:6px;margin-top:4px">'
    + '<span style="font-size:9px;font-weight:800;color:var(--txt3);text-transform:uppercase">Total</span>'
    + '<div></div>'
    + '<span style="font-size:10px;text-align:right;color:#F59E0B;font-weight:800">' + (totalCargSem > 0 ? fmtN(totalCargSem) : '—') + '</span>'
    + '<span style="font-size:10px;text-align:right;color:#2ECC8A;font-weight:800">' + fmtN(totalEmbCarga) + '</span>'
    + '<span style="font-size:10px;text-align:right;color:#9A88FF;font-weight:800">' + (arrastreInicial > 0 ? fmtN(totalEmbBack) : '—') + '</span>'
    + '<span style="font-size:10px;text-align:right;color:#FFBA4D;font-weight:800">' + (arrastreInicial > 0 ? fmtN(totalPendBack) : '—') + '</span>'
    + '<span style="font-size:10px;text-align:right;font-weight:900;color:var(--txt)">' + fmtN(totalEmbTotal) + '</span>'
  + '</div>';

  var elAD = _getPlanEl('plan-avance-diario');
  if(elAD) elAD.innerHTML = '<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px 10px;overflow-x:auto">'
    + '<div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Avance Diario · Meta ' + fmtN(metaDia) + ' uds/día</div>'
    + '<div style="display:grid;grid-template-columns:' + cols + ';gap:2px 3px;padding:0 2px 6px;font-size:8px;font-weight:700;color:var(--txt3);text-transform:uppercase;border-bottom:1px solid var(--border);margin-bottom:2px">'
      + '<div>Día</div><div></div>'
      + '<div style="text-align:right;color:#F59E0B">Carg.</div>'
      + '<div style="text-align:right;color:#2ECC8A">Emb.<br>Carga</div>'
      + '<div style="text-align:right;color:#9A88FF">Emb.<br>Back</div>'
      + '<div style="text-align:right;color:#FFBA4D">Pend.<br>Back</div>'
      + '<div style="text-align:right;color:var(--txt2)">Total<br>Emb.</div>'
    + '</div>'
    + filasDiarioV2
  + '</div>';
}

function renderPlanTrendChart(diasSem, prodPorFecha, entregasPorFecha, hoy, metaDiariaPlan, hayCargado){
  const canvasId='plan-chart-diario';
  const ctxEl=document.getElementById(canvasId);
  if(!ctxEl||typeof Chart==='undefined') return;
  const existing=Chart.getChart(canvasId);
  if(existing) existing.destroy();

  const labels    = diasSem.map(d=>d.nombre);
  const esFuturoF = f => new Date(f+'T12:00:00')>hoy;
  const dataEmbal = diasSem.map(d=> esFuturoF(d.fecha) ? null : (prodPorFecha[d.fecha]||0));
  const dataCarg  = diasSem.map(d=> esFuturoF(d.fecha) ? null : (entregasPorFecha[d.fecha]||0));

  const datasets=[];
  if(hayCargado){
    datasets.push({
      label:'Cargado', data:dataCarg, borderColor:'#F59E0B', backgroundColor:'rgba(245,158,11,.12)',
      borderWidth:2, tension:.35, spanGaps:false, fill:false,
      pointRadius:dataCarg.map(v=>v!==null?3:0), pointBackgroundColor:'#F59E0B', pointHoverRadius:5
    });
  }
  datasets.push({
    label:'Embalado', data:dataEmbal, borderColor:'#2ECC8A',
    backgroundColor:(ctx)=>{const g=ctx.chart.ctx.createLinearGradient(0,0,0,180);g.addColorStop(0,'rgba(46,204,138,.28)');g.addColorStop(1,'rgba(46,204,138,0)');return g;},
    borderWidth:2.5, tension:.35, spanGaps:false, fill:true,
    pointRadius:dataEmbal.map(v=>v!==null?3:0), pointBackgroundColor:'#2ECC8A', pointHoverRadius:5
  });
  if(metaDiariaPlan>0){
    datasets.push({
      label:'Meta diaria', data:Array(labels.length).fill(metaDiariaPlan),
      borderColor:'rgba(255,255,255,.28)', borderWidth:1.5, borderDash:[5,4],
      pointRadius:0, fill:false
    });
  }

  new Chart(ctxEl,{
    type:'line',
    data:{labels,datasets},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      plugins:{
        legend:{display:true, position:'bottom', labels:{color:'#7FA8D4', font:{size:9}, boxWidth:10, padding:10, usePointStyle:true}},
        tooltip:{backgroundColor:'#0A1628', borderColor:'#1E3A5F', borderWidth:1, titleColor:'#8AAED4', bodyColor:'#EEF4FF', padding:8,
          callbacks:{label:ctx=> (ctx.raw===null||ctx.raw===undefined) ? `${ctx.dataset.label}: sin datos` : `${ctx.dataset.label}: ${fmtN(ctx.raw)} uds`}}
      },
      scales:{
        x:{grid:{display:false}, ticks:{color:'#4D7AAA', font:{size:9}}},
        y:{beginAtZero:true, grid:{color:'rgba(255,255,255,.05)'}, ticks:{color:'#4D7AAA', font:{size:8}, callback:v=>fmtN(v)}}
      }
    }
  });
}

// ── Render Plan desde caché (sin red) ─────────────────────────────────────
function _renderFromCache(){
  const {planRaw, prodRawSemana, entregasRawSemana, backlogPorCanal,
         diasSem, lunObj, vieObj, domObj} = _planCache;
  const totalBacklog = Object.keys(backlogPorCanal||{}).reduce(function(s,c){ return s+((backlogPorCanal[c]||{}).pendiente||0); },0);
  const CANALES_OFFLINE = ['Locales','Concesiones','Grandes Tiendas','Distribuidor'];
  const CANALES_ONLINE  = ['Ecommerce','Marketplace','Venta en verde'];

  // Fechas recomputadas (solo date math, sin red)
  const hoyLocal = fechaLocalStr(new Date());
  const vieLocal = fechaLocalStr(vieObj);
  const domLocal = fechaLocalStr(domObj);
  const fLun     = fechaLocalStr(lunObj);
  const hoy      = new Date(hoyLocal + 'T12:00:00');
  const fHasta   = hoyLocal <= vieLocal ? hoyLocal : vieLocal;
  const hasta    = hoy < vieObj ? hoy : vieObj;
  const diasHasta = diasHabileSem(lunObj, vieObj, hasta);

  const sufijoTitulo = planDiaActual ? ' (acumulado al día)' : '';
  const elTC=_getPlanEl('titulo-cumplimiento-canal'); if(elTC) elTC.textContent='Cumplimiento por canal'+sufijoTitulo;
  const elPE=document.getElementById('titulo-pendiente-embalar');  if(elPE) elPE.textContent=(planDiaActual?'Pendiente por embalar (acumulado al día)':'Pendiente por embalar (de lo cargado)');
  const elTM=_getPlanEl('titulo-tipo-material');      if(elTM) elTM.textContent='Tipo de material'+sufijoTitulo;

  // ── Re-agregar entregas aplicando filtro de día (JS puro) ──
  const entregasRawCanal = planDiaActual
    ? entregasRawSemana.filter(r=>((r.fecha_carga||'').toString().trim().slice(0,10))<=planDiaActual)
    : entregasRawSemana;
  const entregasPorCanal={}, entregasPorTipo={linea:0,maleta:0}, entregasPorFecha={};
  let totalEntregas=0;
  (entregasRawCanal||[]).forEach(r=>{
    const tp=(r.tipo_producto||'').toString().trim().toLowerCase();
    if(tp==='insumo') return;
    const c=(r.canal||'').toString().trim(), cLow=c.toLowerCase();
    if(cLow==='anulada'||cLow==='regula'||cLow==='bts') return;
    const q=Number(r.cantidad)||0;
    entregasPorCanal[c]=(entregasPorCanal[c]||0)+q; totalEntregas+=q;
    if(tp==='maleta') entregasPorTipo.maleta+=q; else entregasPorTipo.linea+=q;
  });
  (entregasRawSemana||[]).forEach(r=>{
    const tp=(r.tipo_producto||'').toString().trim().toLowerCase();
    if(tp==='insumo') return;
    const cLow=(r.canal||'').toString().trim().toLowerCase();
    if(cLow==='anulada'||cLow==='regula'||cLow==='bts') return;
    const fc=(r.fecha_carga||'').toString().trim().slice(0,10);
    if(fc) entregasPorFecha[fc]=(entregasPorFecha[fc]||0)+(Number(r.cantidad)||0);
  });
  const totalCarg=totalEntregas;
  const prodRaw=prodRawSemana;

  // ── Calcular totales ──
  const nDiasTot  = diasSem.length;
  const nDiasTransc = diasHasta.length;
  const nDiasRest   = nDiasTot - nDiasTransc;
  const diasRestNombres = diasSem.slice(nDiasTransc).map(d=>d.nombre).join(', ');

  // Filtrar usuarios desvinculados (no están en DB)
  const prodFiltradaSemana = prodRaw.filter(r => DB[r.usuario] !== undefined);
  // Si hay un día específico filtrado, usar el ACUMULADO desde el lunes hasta ese día (corte acumulado, no día aislado)
  const prodFiltrada = planDiaActual
    ? prodFiltradaSemana.filter(r => r.fecha <= planDiaActual)
    : prodFiltradaSemana;

  // Si no hay plan para esta semana, mostrar aviso claro
  if(!Array.isArray(planRaw) || planRaw.length===0){
    const aviso=`<div style="text-align:center;padding:18px 14px;font-size:13px;color:var(--txt2)">
      📋 Sin plan cargado para la Semana ${planSemActual}<br>
      <span style="font-size:11px">Sube el Excel de plan en la sección inferior</span>
    </div>`;
    ['plan-tabla-canal','plan-tipo-material','plan-grafico-diario'].forEach(id=>{
      const el=_getPlanEl(id);
      if(el) el.innerHTML=aviso;
    });
    const _eo=_getPlanEl('plan-estado-operacional'); if(_eo) _eo.innerHTML='';
    const _ad=_getPlanEl('plan-avance-diario'); if(_ad) _ad.innerHTML='';
    return;
  }

  // Meta diaria = plan / días hábiles semana
  const metaMap={}, prodMap={};
  if(Array.isArray(planRaw)) planRaw.forEach(r=>{
    const k=r.canal+'|'+r.tipo;
    metaMap[k]=(metaMap[k]||0)+Number(r.unidades_plan);
  });
  prodFiltrada.forEach(r=>{
    const k=r.canal+'|'+r.tipo;
    prodMap[k]=(prodMap[k]||0)+Number(r.cantidad);
  });

  // Por canal (suma linea+maleta)
  const metaCanalMap={}, prodCanalMap={};
  Object.entries(metaMap).forEach(([k,v])=>{ const cn=k.split('|')[0]; metaCanalMap[cn]=(metaCanalMap[cn]||0)+v; });
  prodFiltrada.forEach(r=>{ prodCanalMap[r.canal]=(prodCanalMap[r.canal]||0)+Number(r.cantidad); });
  // NOTA: el Plan se mantiene SIEMPRE como la meta semanal completa (fija), sin importar el día seleccionado.
  // Lo que cambia al filtrar por día es el acumulado de Cargado y Embalado (corte acumulado hasta ese día).

  const totalPlan = Object.values(metaCanalMap).reduce((s,v)=>s+v,0);
  const totalProd = Object.values(prodCanalMap).reduce((s,v)=>s+v,0);
  const totalGap  = totalPlan - totalProd;
  const pctGlobal = totalPlan>0?Math.round(totalProd/totalPlan*100):0;
  const ritmo     = nDiasTransc>0?Math.round(totalProd/nDiasTransc):0;
  const metaDiariaTot = nDiasRest>0?Math.round(totalGap/nDiasRest):0;
  const metaDiariaPlan = nDiasTot>0?Math.round(totalPlan/nDiasTot):0;
  // ── Métricas con Cargado ──
  const pctEmbalPlan  = totalPlan>0  ? Math.round(totalProd/totalPlan*100)  : 0;
  const pctEmbalCarg  = totalCarg>0  ? Math.round(totalProd/totalCarg*100)  : 0;
  const pctCargPlan   = totalPlan>0  ? Math.round(totalCarg/totalPlan*100)  : 0;
  const pendCargar    = Math.max(totalPlan - totalCarg, 0);
  const pendEmbalar   = Object.keys(entregasPorCanal).reduce((s,c)=>s+Math.max((entregasPorCanal[c]||0)-(prodCanalMap[c]||0),0),0);
  const nDiasParaRitmo = planDiaActual
    ? diasSem.filter(d=>d.fecha<=planDiaActual).length
    : nDiasTransc;
  const pctEsperado   = diasSem.length>0 ? Math.round(nDiasParaRitmo/diasSem.length*100) : 0;

  // ── Estado Operacional + Avance Diario ──
  renderEstadoOperacional({
    totalPlan: totalPlan,
    totalCarg: totalCarg,
    totalProd: totalProd,
    backlogPorCanal: backlogPorCanal,
    diasSem: diasSem,
    prodFiltradaSemana: prodRaw.filter(r=>DB[r.usuario]!==undefined),
    entregasPorFecha: entregasPorFecha,
    planDiaActual: planDiaActual,
    idEntregasSAnt: _planCache.idEntregasSAnt || new Set(),
    embalBackPorFecha: _planCache.embalBackPorFecha || {},
    arrastreInicialFijo: _planCache.arrastreInicial
  });

  // ── arrConsumido por canal filtrado por planDiaActual ──
  // embalBackPorFechaCanal = { fecha: { canal: qty } }
  const _backFechaCanal = _planCache.embalBackPorFechaCanal || {};
  const arrConsPorCanal = {};  // canal → qty consumido hasta planDiaActual (o total semana)
  Object.keys(_backFechaCanal).forEach(f=>{
    if(planDiaActual && f > planDiaActual) return;  // filtrar por día
    Object.keys(_backFechaCanal[f]).forEach(c=>{
      arrConsPorCanal[c] = (arrConsPorCanal[c]||0) + (_backFechaCanal[f][c]||0);
    });
  });

  // ── Precalcular desglose maleta/línea por canal para el detalle expandible ──
  // Cargado SAP (entregas) desglose por canal
  const cargMaletaPorCanal={}, cargLineaPorCanal={};
  (entregasRawCanal||[]).forEach(r=>{
    const tp=(r.tipo_producto||'').toString().trim().toLowerCase();
    if(tp==='insumo') return;
    const c=(r.canal||'').toString().trim(), cLow=c.toLowerCase();
    if(cLow==='anulada'||cLow==='regula'||cLow==='bts') return;
    const q=Number(r.cantidad)||0;
    if(tp==='maleta'){ cargMaletaPorCanal[c]=(cargMaletaPorCanal[c]||0)+q; }
    else { cargLineaPorCanal[c]=(cargLineaPorCanal[c]||0)+q; }
  });
  // Embalado desglose por canal
  const prodMaletaPorCanal={}, prodLineaPorCanal={};
  prodFiltrada.forEach(r=>{
    const tp=(r.tipo||'').toString().trim().toLowerCase();
    const c=(r.canal||'').toString().trim();
    const q=Number(r.cantidad)||0;
    if(tp==='maleta'){ prodMaletaPorCanal[c]=(prodMaletaPorCanal[c]||0)+q; }
    else if(tp==='linea'||tp==='no maleta'){ prodLineaPorCanal[c]=(prodLineaPorCanal[c]||0)+q; }
  });
  // Plan desglose por canal (maleta/linea)
  const planMaletaPorCanal={}, planLineaPorCanal={};
  Object.entries(metaMap).forEach(([k,v])=>{
    const parts=k.split('|'); const c=parts[0], t=parts[1];
    if(t==='maleta') planMaletaPorCanal[c]=(planMaletaPorCanal[c]||0)+v;
    else if(t==='linea') planLineaPorCanal[c]=(planLineaPorCanal[c]||0)+v;
  });

  // ── Tabla expandible por canal OFFLINE/ONLINE ──
  // Estado de expansión (persiste en objeto local para evitar re-renders)
  if(!window._canalExpandido) window._canalExpandido={};

  let tabHtml = '';

  // ── Tabla canal: columnas fijas, colores = headers, abreviaturas ──
  const CANAL_ABREV = {
    'Locales':'LOC','Concesiones':'CONC','Grandes Tiendas':'GGTT',
    'Distribuidor':'DIST','Ecommerce':'ECO','Marketplace':'MKP','Venta en verde':'VEV'
  };
  // Grid: abrev(36) plan(32) carg(48) %c(28) emb(48) %e(28) tot(46) %f(30) = 296px + 7*2px gaps = 310px
  const G = _gridCols('36px 32px 48px 28px 48px 28px 46px 30px');

  tabHtml += `
    <div style="padding:4px 2px 6px;border-bottom:1px solid var(--border)">
      <div style="display:grid;grid-template-columns:${G};gap:0 2px;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;text-align:right;line-height:1.3">
        <div style="text-align:left;color:var(--txt3)">Canal</div>
        <div style="color:#8B9CB6">Plan</div>
        <div style="color:#F59E0B">Carg.</div>
        <div style="color:#F59E0B">%</div>
        <div style="color:#2ECC8A">Embal.</div>
        <div style="color:#2ECC8A">%</div>
        <div style="color:#60B0FF">Total</div>
        <div style="color:#60B0FF">%F</div>
      </div>
      <div style="display:grid;grid-template-columns:${G};gap:0 2px;font-size:7px;font-weight:600;text-align:right;margin-top:1px;line-height:1.3">
        <div></div><div></div><div></div><div></div>
        <div style="color:#9A88FF">+Arr.</div>
        <div></div><div></div><div></div>
      </div>
    </div>`;

  ['OFFLINE','ONLINE'].forEach(grupo=>{
    const canalGrupo = grupo==='OFFLINE' ? CANALES_OFFLINE : CANALES_ONLINE;
    const colGrupo   = grupo==='OFFLINE' ? '#3B8FFF' : '#2ECC8A';
    tabHtml += `
      <div style="display:flex;align-items:center;gap:6px;margin:9px 0 5px">
        <div style="width:3px;height:11px;background:${colGrupo};border-radius:2px"></div>
        <span style="font-size:9px;font-weight:700;color:${colGrupo};letter-spacing:.05em">${grupo}</span>
      </div>`;

    let subPlan=0,subCarg=0,subProd=0,subArrCons=0;
    canalGrupo.forEach(canal=>{
      const plan       = metaCanalMap[canal]||0;
      const carg       = entregasPorCanal[canal]||0;
      const prod         = prodCanalMap[canal]||0;
      const arrConsumido = arrConsPorCanal[canal]||0;
      const embCargado   = Math.max(prod - arrConsumido, 0); // solo embalado del cargado
      if(!plan && !carg && !prod) return;
      subPlan+=plan; subCarg+=carg; subProd+=prod; subArrCons+=arrConsumido;

      const pctCarg  = plan>0 ? Math.round(carg/plan*100) : 0;
      const pctEmb   = carg>0 ? Math.round(embCargado/carg*100) : 0;  // emb.cargado / cargado
      const pctFinal = plan>0 ? Math.round(prod/plan*100) : 0;        // total (prod) / plan
      const scFinal  = semColor(pctFinal);
      const scCarg   = semColor(pctCarg);   // usado en panel detalle
      const scEmb    = semColor(pctEmb);    // usado en panel detalle
      const idFila   = 'canal-det-'+grupo+'-'+canal.replace(/\s/g,'_');
      const abierto  = window._canalExpandido[idFila]||false;
      const abrev    = CANAL_ABREV[canal]||canal.slice(0,4).toUpperCase();

      const rowHtml = `
        <div id="row-${idFila}" onclick="window._toggleCanalDetalle('${idFila}')" style="cursor:pointer;border-radius:7px;padding:5px 2px 4px;margin-bottom:1px;transition:background .15s;background:${abierto?'rgba(59,143,255,.09)':'transparent'}">
          <div style="display:grid;grid-template-columns:${G};gap:0 2px;align-items:baseline;text-align:right;margin-bottom:1px">
            <span style="font-size:11px;font-weight:800;color:var(--txt);text-align:left">${abrev}</span>
            <span style="font-size:9px;color:#8B9CB6">${fmtN(plan)}</span>
            <span style="font-size:11px;font-weight:800;color:#F59E0B">${carg>0?fmtN(carg):'—'}</span>
            <span style="font-size:10px;font-weight:700;color:#F59E0B">${carg>0?pctCarg+'%':'—'}</span>
            <span style="font-size:11px;font-weight:800;color:#2ECC8A">${fmtN(embCargado)}</span>
            <span style="font-size:10px;font-weight:700;color:#2ECC8A">${carg>0?pctEmb+'%':'—'}</span>
            <span style="font-size:11px;font-weight:800;color:#60B0FF">${fmtN(prod)}</span>
            <span style="font-size:10px;font-weight:800;color:${scFinal.c}">${pctFinal}%</span>
          </div>
          <div style="display:grid;grid-template-columns:${G};gap:0 2px;align-items:baseline;text-align:right">
            <span></span><span></span><span></span><span></span>
            <span style="font-size:9px;color:#9A88FF">${arrConsumido>0?'+'+fmtN(arrConsumido):'—'}</span>
            <span></span><span></span><span></span>
          </div>
        </div>`;

      // Panel detalle (expandible)
      const cMal = planMaletaPorCanal[canal]||0;
      const cLin = planLineaPorCanal[canal]||0;
      const cgMal = cargMaletaPorCanal[canal]||0;
      const cgLin = cargLineaPorCanal[canal]||0;
      const pMal = prodMaletaPorCanal[canal]||0;
      const pLin = prodLineaPorCanal[canal]||0;
      const pctMalCarg = cgMal>0?Math.round(pMal/cgMal*100):0;
      const pctLinCarg = cgLin>0?Math.round(pLin/cgLin*100):0;
      const pctMalPlan = plan>0?Math.round(cgMal/plan*100):0;
      const pctLinPlan = plan>0?Math.round(cgLin/plan*100):0;
      const scMalC=semColor(pctMalCarg), scLinC=semColor(pctLinCarg);

      // Donut SVG cumplimiento final
      const r30=188.5, pctF100=Math.min(pctFinal,100)/100;
      const donutDet = `<svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="21" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="9"/>
        <circle cx="28" cy="28" r="21" fill="none" stroke="${scFinal.c}" stroke-width="9"
          stroke-dasharray="${(pctF100*131.9).toFixed(1)} 131.9" stroke-dashoffset="0"
          stroke-linecap="round" transform="rotate(-90 28 28)"/>
        <text x="28" y="33" text-anchor="middle" font-size="11" fill="${scFinal.c}" font-family="DM Sans,Arial" font-weight="900">${pctFinal}%</text>
      </svg>`;

      const detHtml = `
        <div id="${idFila}" style="display:${abierto?'block':'none'};background:rgba(10,20,40,.6);border:1px solid rgba(59,143,255,.15);border-radius:10px;margin:0 2px 8px;padding:10px;overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:11px;font-weight:800;color:var(--txt)">Detalle: <span style="color:${colGrupo}">${canal}</span></span>
            <div style="font-size:9px;color:var(--txt3)">Sem. Ant.</div>
          </div>
          <!-- 5 tarjetas superiores -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:5px;margin-bottom:8px">
            <!-- Plan -->
            <div style="background:rgba(59,143,255,.08);border-radius:7px;padding:6px 4px;text-align:center">
              <div style="font-size:7px;font-weight:700;color:#3B8FFF;text-transform:uppercase;margin-bottom:2px">Plan</div>
              <div style="font-size:13px;font-weight:900;color:var(--txt);line-height:1">${fmtN(plan)}</div>
              <div style="font-size:7px;color:var(--txt3);margin-top:1px">uds</div>
            </div>
            <!-- Cargado -->
            <div style="background:rgba(245,158,11,.08);border-radius:7px;padding:6px 4px;text-align:center">
              <div style="font-size:7px;font-weight:700;color:#F59E0B;text-transform:uppercase;margin-bottom:2px">Cargado</div>
              <div style="font-size:13px;font-weight:900;color:#F59E0B;line-height:1">${fmtN(carg)}</div>
              <div style="font-size:7px;color:${scCarg.c};margin-top:1px;font-weight:700">${pctCarg}% del plan</div>
            </div>
            <!-- Embalado -->
            <div style="background:rgba(46,204,138,.08);border-radius:7px;padding:6px 4px;text-align:center">
              <div style="font-size:7px;font-weight:700;color:#2ECC8A;text-transform:uppercase;margin-bottom:2px">Embalado</div>
              <div style="font-size:13px;font-weight:900;color:#2ECC8A;line-height:1">${fmtN(embCargado)}</div>
              <div style="font-size:7px;color:${scEmb.c};margin-top:1px;font-weight:700">${carg>0?pctEmb+'% del carg.':'—'}</div>
            </div>
            <!-- Arrastre -->
            <div style="background:rgba(154,136,255,.08);border-radius:7px;padding:6px 4px;text-align:center">
              <div style="font-size:7px;font-weight:700;color:#9A88FF;text-transform:uppercase;margin-bottom:2px">Arrastre</div>
              <div style="font-size:13px;font-weight:900;color:#9A88FF;line-height:1">${arrConsumido>0?fmtN(arrConsumido):'—'}</div>
              <div style="font-size:7px;color:var(--txt3);margin-top:1px">emb. del arrastre</div>
            </div>
            <!-- Total Embalado -->
            <div style="background:rgba(96,176,255,.08);border-radius:7px;padding:6px 4px;text-align:center">
              <div style="font-size:7px;font-weight:700;color:#60B0FF;text-transform:uppercase;line-height:1.1;margin-bottom:2px">Total Emb.</div>
              <div style="font-size:13px;font-weight:900;color:#60B0FF;line-height:1">${fmtN(prod)}</div>
              <div style="font-size:7px;color:${scFinal.c};margin-top:1px;font-weight:700">${pctFinal}% del plan</div>
            </div>
          </div>
          <!-- Desglose Maleta / No Maleta + donut -->
          <div style="display:grid;grid-template-columns:1fr 56px;gap:8px;align-items:start">
            <div>
              <!-- Maleta -->
              <div style="margin-bottom:6px">
                <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
                  <span style="font-size:8px;font-weight:700;color:#F97316">🧳 Maleta</span>
                  ${cMal>0?`<span style="font-size:7px;color:var(--txt3)">(Plan: ${fmtN(cMal)})</span>`:''}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">
                  <div style="background:rgba(245,158,11,.07);border-radius:5px;padding:4px;text-align:center">
                    <div style="font-size:7px;color:#F59E0B;font-weight:600">Cargado</div>
                    <div style="font-size:11px;font-weight:800;color:var(--txt)">${cgMal>0?fmtN(cgMal):'—'}</div>
                    ${cgMal>0&&carg>0?`<div style="font-size:7px;color:var(--txt3)">${Math.round(cgMal/carg*100)}%</div>`:''}
                  </div>
                  <div style="background:rgba(46,204,138,.07);border-radius:5px;padding:4px;text-align:center">
                    <div style="font-size:7px;color:#2ECC8A;font-weight:600">Embalado</div>
                    <div style="font-size:11px;font-weight:800;color:var(--txt)">${pMal>0?fmtN(pMal):'—'}</div>
                    ${cgMal>0?`<div style="font-size:7px;color:${scMalC.c};font-weight:700">${pctMalCarg}%</div>`:''}
                  </div>
                  <div style="background:rgba(249,115,22,.07);border-radius:5px;padding:4px;text-align:center">
                    <div style="font-size:7px;color:#F97316;font-weight:600">Pendiente</div>
                    <div style="font-size:11px;font-weight:800;color:var(--txt)">${cgMal>0?fmtN(Math.max(cgMal-pMal,0)):'—'}</div>
                  </div>
                </div>
                ${cgMal>0?`<div style="height:3px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;margin-top:3px">
                  <div style="height:100%;width:${Math.min(pctMalCarg,100)}%;background:#F97316;border-radius:2px"></div>
                </div>`:''}
              </div>
              <!-- No Maleta -->
              <div>
                <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
                  <span style="font-size:8px;font-weight:700;color:#60B0FF">🎒 No Maleta</span>
                  ${cLin>0?`<span style="font-size:7px;color:var(--txt3)">(Plan: ${fmtN(cLin)})</span>`:''}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">
                  <div style="background:rgba(245,158,11,.07);border-radius:5px;padding:4px;text-align:center">
                    <div style="font-size:7px;color:#F59E0B;font-weight:600">Cargado</div>
                    <div style="font-size:11px;font-weight:800;color:var(--txt)">${cgLin>0?fmtN(cgLin):'—'}</div>
                    ${cgLin>0&&carg>0?`<div style="font-size:7px;color:var(--txt3)">${Math.round(cgLin/carg*100)}%</div>`:''}
                  </div>
                  <div style="background:rgba(46,204,138,.07);border-radius:5px;padding:4px;text-align:center">
                    <div style="font-size:7px;color:#2ECC8A;font-weight:600">Embalado</div>
                    <div style="font-size:11px;font-weight:800;color:var(--txt)">${pLin>0?fmtN(pLin):'—'}</div>
                    ${cgLin>0?`<div style="font-size:7px;color:${scLinC.c};font-weight:700">${pctLinCarg}%</div>`:''}
                  </div>
                  <div style="background:rgba(96,176,255,.07);border-radius:5px;padding:4px;text-align:center">
                    <div style="font-size:7px;color:#60B0FF;font-weight:600">Pendiente</div>
                    <div style="font-size:11px;font-weight:800;color:var(--txt)">${cgLin>0?fmtN(Math.max(cgLin-pLin,0)):'—'}</div>
                  </div>
                </div>
                ${cgLin>0?`<div style="height:3px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;margin-top:3px">
                  <div style="height:100%;width:${Math.min(pctLinCarg,100)}%;background:#60B0FF;border-radius:2px"></div>
                </div>`:''}
              </div>
            </div>
            <!-- Donut cumplimiento final -->
            <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
              ${donutDet}
              <div style="font-size:7px;color:var(--txt3);text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:.03em">Cumpl. Final</div>
            </div>
          </div>
        </div>`;

      tabHtml += rowHtml + detHtml;
    });

    // Subtotal grupo — colores fijos, sin semáforo
    const subEmbCargado = Math.max(subProd - subArrCons, 0);
    const subPctF    = subPlan>0?Math.round(subProd/subPlan*100):0;
    const scSub      = semColor(subPctF);
    const subPctCarg = subPlan>0?Math.round(subCarg/subPlan*100):0;
    const subPctEmb  = subCarg>0?Math.round(subEmbCargado/subCarg*100):0;
    tabHtml += `
      <div style="padding:5px 6px;background:rgba(255,255,255,.05);border-left:3px solid ${colGrupo};border-radius:6px;margin-bottom:6px">
        <div style="display:grid;grid-template-columns:${G};gap:0 2px;align-items:baseline;text-align:right;margin-bottom:1px">
          <span style="font-size:9px;font-weight:800;color:${colGrupo};text-align:left">TOT.</span>
          <span style="font-size:9px;color:#8B9CB6">${fmtN(subPlan)}</span>
          <span style="font-size:10px;font-weight:800;color:#F59E0B">${subCarg>0?fmtN(subCarg):'—'}</span>
          <span style="font-size:10px;font-weight:700;color:#F59E0B">${subCarg>0?subPctCarg+'%':'—'}</span>
          <span style="font-size:10px;font-weight:800;color:#2ECC8A">${fmtN(subEmbCargado)}</span>
          <span style="font-size:10px;font-weight:700;color:#2ECC8A">${subCarg>0?subPctEmb+'%':'—'}</span>
          <span style="font-size:10px;font-weight:800;color:#60B0FF">${fmtN(subProd)}</span>
          <span style="font-size:10px;font-weight:800;color:${scSub.c}">${subPctF}%</span>
        </div>
        <div style="display:grid;grid-template-columns:${G};gap:0 2px;align-items:baseline;text-align:right">
          <span></span><span></span><span></span><span></span>
          <span style="font-size:8px;color:#9A88FF">${subArrCons>0?'+'+fmtN(subArrCons):'—'}</span>
          <span></span><span></span><span></span>
        </div>
      </div>`;
  });

  // Total general — colores fijos, sin semáforo en %, solo en %F
  const totalGapAbs    = totalPlan - totalProd;
  const totalArrCons   = Object.keys(arrConsPorCanal).reduce((s,c)=>s+(arrConsPorCanal[c]||0),0);
  const totalEmbCargado= Math.max(totalProd - totalArrCons, 0);
  const pctFinalTot    = totalPlan>0?Math.round(totalProd/totalPlan*100):0;
  const scTot          = semColor(pctFinalTot);
  const pctGenBar      = Math.min(pctFinalTot,100);
  const pctCargTot     = totalPlan>0?Math.round(totalCarg/totalPlan*100):0;
  const pctEmbTot      = totalCarg>0?Math.round(totalEmbCargado/totalCarg*100):0;

  _getPlanEl('plan-tabla-canal').innerHTML = `
    ${tabHtml}
    <div style="padding:8px 6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:8px;margin-top:4px">
      <div style="display:grid;grid-template-columns:${G};gap:0 2px;align-items:baseline;text-align:right;margin-bottom:1px">
        <span style="font-size:8px;font-weight:900;color:var(--txt);text-align:left;line-height:1.2">TOT.<br><span style="font-size:7px;font-weight:600;color:var(--txt3)">GEN.</span></span>
        <span style="font-size:9px;color:#8B9CB6">${fmtN(totalPlan)}</span>
        <span style="font-size:10px;font-weight:900;color:#F59E0B">${totalCarg>0?fmtN(totalCarg):'—'}</span>
        <span style="font-size:10px;font-weight:700;color:#F59E0B">${totalCarg>0?pctCargTot+'%':'—'}</span>
        <span style="font-size:10px;font-weight:900;color:#2ECC8A">${fmtN(totalEmbCargado)}</span>
        <span style="font-size:10px;font-weight:700;color:#2ECC8A">${totalCarg>0?pctEmbTot+'%':'—'}</span>
        <span style="font-size:11px;font-weight:900;color:#60B0FF">${fmtN(totalProd)}</span>
        <span style="font-size:10px;font-weight:900;color:${scTot.c}">${pctFinalTot}%</span>
      </div>
      <div style="display:grid;grid-template-columns:${G};gap:0 2px;align-items:baseline;text-align:right;margin-bottom:6px">
        <span></span><span></span><span></span><span></span>
        <span style="font-size:8px;color:#9A88FF">${totalArrCons>0?'+'+fmtN(totalArrCons):'—'}</span>
        <span></span><span></span><span></span>
      </div>
      <div style="height:4px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;margin-bottom:4px">
        <div style="height:100%;width:${pctGenBar}%;background:linear-gradient(90deg,#2ECC8A,#3B8FFF);border-radius:3px"></div>
      </div>
      <div style="font-size:7px;color:var(--txt3);display:flex;justify-content:space-between">
        <span>Embalado total vs plan</span>
        <span style="color:${scTot.c};font-weight:700">${fmtN(totalProd)} / ${fmtN(totalPlan)}</span>
      </div>
    </div>
    ${!totalCarg?`<div style="margin-top:6px;font-size:9px;color:var(--txt3)">⚠️ Sin datos de entregas cargadas ${planDiaActual?'acumuladas hasta ese día':'para esta semana'}</div>`:''}
  `;

  // ── Toggle detalle canal (función global, reutilizable) ──
  window._toggleCanalDetalle = function(idFila){
    const det = document.getElementById(idFila);
    const row = document.getElementById('row-'+idFila);
    if(!det) return;
    const abierto = det.style.display==='block';
    det.style.display = abierto ? 'none' : 'block';
    window._canalExpandido[idFila] = !abierto;
    if(row) row.style.background = abierto ? 'transparent' : 'rgba(59,143,255,.09)';
  };

  // ── Tipo de material — tabla expandible igual a canales ──
  if(!window._tipoExpandido) window._tipoExpandido={};

  // prodTipo necesario para cálculos de tipo
  let planTipo={linea:0,maleta:0}, prodTipo={linea:0,maleta:0};
  Object.entries(metaMap).forEach(([k,v])=>{ const t=k.split('|')[1]; if(planTipo[t]!==undefined) planTipo[t]+=v; });
  prodFiltrada.forEach(r=>{ if(prodTipo[r.tipo]!==undefined) prodTipo[r.tipo]+=Number(r.cantidad); });

  // Arrastre consumido por tipo (maleta/linea) — desde backlogPorCanal cruzado con cargMaletaPorCanal
  // Se usa la proporción maleta/linea dentro del arrastre de cada canal
  const arrConsMaleta = Object.keys(arrConsPorCanal).reduce((s,c)=>{
    const totCarg = (cargMaletaPorCanal[c]||0)+(cargLineaPorCanal[c]||0);
    const propMal = totCarg>0?(cargMaletaPorCanal[c]||0)/totCarg:0;
    return s + Math.round((arrConsPorCanal[c]||0)*propMal);
  },0);
  const arrConsLinea = totalArrCons - arrConsMaleta;

  // Producción por tipo separada: emb del cargado = prod - arrCons por tipo
  const prodMaleta = prodTipo.maleta||0;
  const prodLinea  = prodTipo.linea||0;
  const embCargMaleta = Math.max(prodMaleta - arrConsMaleta, 0);
  const embCargLinea  = Math.max(prodLinea  - arrConsLinea,  0);

  // Datos por canal dentro de cada tipo (para el expandible)
  const TODOS_CANALES = [...CANALES_OFFLINE, ...CANALES_ONLINE];
  const GT  = _gridCols('48px 30px 44px 26px 44px 26px 42px 28px');
  const GT2 = _gridCols('34px 30px 44px 26px 44px 26px 42px 28px');

  const buildTipoDetalle = (tipo)=>{
    const esMal = tipo==='maleta';
    const cargXCanal = esMal ? cargMaletaPorCanal : cargLineaPorCanal;
    const prodXCanal = esMal ? prodMaletaPorCanal  : prodLineaPorCanal;
    const planXCanal = esMal ? planMaletaPorCanal  : planLineaPorCanal;
    const colT = esMal ? '#F97316' : '#3B8FFF';
    const idDet = 'tipo-det-'+tipo;
    const abierto = window._tipoExpandido[idDet]||false;

    let filas='';
    let subP=0,subC=0,subPr=0,subArr=0;
    TODOS_CANALES.forEach(canal=>{
      const pl = planXCanal[canal]||0;
      const cg = cargXCanal[canal]||0;
      const pr = prodXCanal[canal]||0;
      // arrastre proporcional de este canal para este tipo
      const totCarg = (cargMaletaPorCanal[canal]||0)+(cargLineaPorCanal[canal]||0);
      const prop    = totCarg>0?(esMal?(cargMaletaPorCanal[canal]||0):(cargLineaPorCanal[canal]||0))/totCarg:0;
      const arr     = Math.round((arrConsPorCanal[canal]||0)*prop);
      const emb     = Math.max(pr - arr, 0);
      if(!pl && !cg && !pr) return;
      subP+=pl; subC+=cg; subPr+=pr; subArr+=arr;
      const pctC  = pl>0?Math.round(cg/pl*100):0;
      const pctE  = cg>0?Math.round(emb/cg*100):0;
      const pctF  = pl>0?Math.round(pr/pl*100):0;
      const abrev = CANAL_ABREV[canal]||canal.slice(0,4).toUpperCase();
      filas+=`
        <div style="display:grid;grid-template-columns:${GT};gap:0 2px;align-items:baseline;text-align:right;padding:4px 2px 2px;border-bottom:1px solid rgba(255,255,255,.03)">
          <span style="font-size:10px;font-weight:700;color:var(--txt);text-align:left">${abrev}</span>
          <span style="font-size:8px;color:#8B9CB6">${pl>0?fmtN(pl):'—'}</span>
          <span style="font-size:10px;font-weight:700;color:#F59E0B">${cg>0?fmtN(cg):'—'}</span>
          <span style="font-size:9px;color:#F59E0B">${cg>0?pctC+'%':'—'}</span>
          <span style="font-size:10px;font-weight:700;color:#2ECC8A">${fmtN(emb)}</span>
          <span style="font-size:9px;color:#2ECC8A">${cg>0?pctE+'%':'—'}</span>
          <span style="font-size:10px;font-weight:700;color:#60B0FF">${fmtN(pr)}</span>
          <span style="font-size:9px;font-weight:800;color:${semColor(pctF).c}">${pl>0?pctF+'%':'—'}</span>
        </div>
        ${arr>0?`<div style="display:grid;grid-template-columns:${GT};gap:0 2px;text-align:right;padding:0 2px 3px">
          <span></span><span></span><span></span><span></span>
          <span style="font-size:8px;color:#9A88FF">+${fmtN(arr)}</span>
          <span></span><span></span><span></span>
        </div>`:''}`;
    });

    const subEmbC = Math.max(subPr-subArr,0);
    const subPctC = subP>0?Math.round(subC/subP*100):0;
    const subPctE = subC>0?Math.round(subEmbC/subC*100):0;
    const subPctF = subP>0?Math.round(subPr/subP*100):0;

    return `
      <div id="tipo-det-block-${tipo}" style="display:${abierto?'block':'none'};background:rgba(10,20,40,.5);border:1px solid rgba(59,143,255,.12);border-radius:8px;margin:2px 2px 8px;padding:8px 6px">
        <div style="display:grid;grid-template-columns:${GT};gap:0 2px;font-size:7px;font-weight:700;text-transform:uppercase;text-align:right;color:var(--txt3);padding-bottom:5px;border-bottom:1px solid var(--border);margin-bottom:2px">
          <div style="text-align:left">Canal</div>
          <div style="color:#8B9CB6">Plan</div>
          <div style="color:#F59E0B">Carg.</div><div style="color:#F59E0B">%</div>
          <div style="color:#2ECC8A">Embal.</div><div style="color:#2ECC8A">%</div>
          <div style="color:#60B0FF">Total</div><div style="color:#60B0FF">%F</div>
        </div>
        ${filas}
        <div style="display:grid;grid-template-columns:${GT};gap:0 2px;align-items:baseline;text-align:right;padding:5px 2px 2px;border-top:1px solid var(--border);margin-top:2px">
          <span style="font-size:9px;font-weight:800;color:${colT};text-align:left">TOT.</span>
          <span style="font-size:8px;color:#8B9CB6">${fmtN(subP)}</span>
          <span style="font-size:10px;font-weight:800;color:#F59E0B">${subC>0?fmtN(subC):'—'}</span>
          <span style="font-size:9px;color:#F59E0B">${subC>0?subPctC+'%':'—'}</span>
          <span style="font-size:10px;font-weight:800;color:#2ECC8A">${fmtN(subEmbC)}</span>
          <span style="font-size:9px;color:#2ECC8A">${subC>0?subPctE+'%':'—'}</span>
          <span style="font-size:10px;font-weight:800;color:#60B0FF">${fmtN(subPr)}</span>
          <span style="font-size:10px;font-weight:800;color:${semColor(subPctF).c}">${subPctF}%</span>
        </div>
        ${subArr>0?`<div style="display:grid;grid-template-columns:${GT};gap:0 2px;text-align:right;padding:0 2px">
          <span></span><span></span><span></span><span></span>
          <span style="font-size:8px;color:#9A88FF">+${fmtN(subArr)}</span>
          <span></span><span></span><span></span>
        </div>`:''}
      </div>`;
  };

  // Tabla principal tipos
  let tipoHtml = `
      <div style="display:grid;grid-template-columns:${GT2};gap:0 2px;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;text-align:right;line-height:1.3">
        <div style="text-align:left;color:var(--txt3)">Tipo</div>
        <div style="color:#8B9CB6">Plan</div>
        <div style="color:#F59E0B">Carg.</div><div style="color:#F59E0B">%</div>
        <div style="color:#2ECC8A">Embal.</div><div style="color:#2ECC8A">%</div>
        <div style="color:#60B0FF">Total</div><div style="color:#60B0FF">%F</div>
      </div>
      <div style="display:grid;grid-template-columns:${GT2};gap:0 2px;font-size:7px;font-weight:600;text-align:right;margin-top:1px">
        <div></div><div></div><div></div><div></div>
        <div style="color:#9A88FF">+Arr.</div>
        <div></div><div></div><div></div>
      </div>
    </div>`;

  [
    {k:'maleta', lbl:'Maleta',    c:'#F97316', icon:'🧳', carg:entregasPorTipo.maleta||0, prod:prodMaleta, embC:embCargMaleta, arr:arrConsMaleta, plan:planTipo.maleta||0},
    {k:'linea',  lbl:'No Maleta', c:'#3B8FFF', icon:'🎒', carg:entregasPorTipo.linea||0,  prod:prodLinea,  embC:embCargLinea,  arr:arrConsLinea,  plan:planTipo.linea||0},
  ].forEach(t=>{
    const pctCarg  = t.plan>0?Math.round(t.carg/t.plan*100):0;
    const pctEmb   = t.carg>0?Math.round(t.embC/t.carg*100):0;
    const pctFinal = t.plan>0?Math.round(t.prod/t.plan*100):0;
    const scF      = semColor(pctFinal);
    const idFila   = 'tipo-det-'+t.k;
    const abierto  = window._tipoExpandido[idFila]||false;

    tipoHtml += `
      <div id="row-${idFila}" onclick="window._toggleTipoDet('${t.k}')" style="cursor:pointer;border-radius:7px;padding:5px 2px 4px;margin-bottom:1px;transition:background .15s;background:${abierto?'rgba(59,143,255,.09)':'transparent'}">
        <div style="display:grid;grid-template-columns:${GT2};gap:0 2px;align-items:baseline;text-align:right;margin-bottom:1px">
          <span style="font-size:11px;font-weight:800;color:${t.c};text-align:left">${t.icon}</span>
          <span style="font-size:9px;color:#8B9CB6">${fmtN(t.plan)}</span>
          <span style="font-size:11px;font-weight:800;color:#F59E0B">${t.carg>0?fmtN(t.carg):'—'}</span>
          <span style="font-size:10px;font-weight:700;color:#F59E0B">${t.carg>0?pctCarg+'%':'—'}</span>
          <span style="font-size:11px;font-weight:800;color:#2ECC8A">${fmtN(t.embC)}</span>
          <span style="font-size:10px;font-weight:700;color:#2ECC8A">${t.carg>0?pctEmb+'%':'—'}</span>
          <span style="font-size:11px;font-weight:800;color:#60B0FF">${fmtN(t.prod)}</span>
          <span style="font-size:10px;font-weight:800;color:${scF.c}">${pctFinal}%</span>
        </div>
        <div style="display:grid;grid-template-columns:${GT2};gap:0 2px;align-items:baseline;text-align:right">
          <span style="font-size:10px;color:${t.c};font-weight:700;text-align:left">${t.lbl}</span>
          <span></span><span></span><span></span>
          <span style="font-size:9px;color:#9A88FF">${t.arr>0?'+'+fmtN(t.arr):'—'}</span>
          <span></span><span></span><span></span>
        </div>
      </div>
      ${buildTipoDetalle(t.k)}`;
  });

  // Total general tipos
  const totTipoPlan = planTipo.linea+planTipo.maleta;
  const totTipoCarg = (entregasPorTipo.linea||0)+(entregasPorTipo.maleta||0);
  const totTipoProd = prodMaleta+prodLinea;
  const totEmbC     = embCargMaleta+embCargLinea;
  const totArr      = arrConsMaleta+arrConsLinea;
  const pctCargTipo = totTipoPlan>0?Math.round(totTipoCarg/totTipoPlan*100):0;
  const pctEmbTipo  = totTipoCarg>0?Math.round(totEmbC/totTipoCarg*100):0;
  const pctFTipo    = totTipoPlan>0?Math.round(totTipoProd/totTipoPlan*100):0;
  const scFTipo     = semColor(pctFTipo);

  tipoHtml += `
    <div style="padding:7px 6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:8px;margin-top:4px">
      <div style="display:grid;grid-template-columns:${GT2};gap:0 2px;align-items:baseline;text-align:right;margin-bottom:1px">
        <span style="font-size:8px;font-weight:900;color:var(--txt);text-align:left;line-height:1.2">TOT.<br><span style="font-size:7px;color:var(--txt3)">GEN.</span></span>
        <span style="font-size:9px;color:#8B9CB6">${fmtN(totTipoPlan)}</span>
        <span style="font-size:10px;font-weight:900;color:#F59E0B">${totTipoCarg>0?fmtN(totTipoCarg):'—'}</span>
        <span style="font-size:10px;color:#F59E0B">${totTipoCarg>0?pctCargTipo+'%':'—'}</span>
        <span style="font-size:10px;font-weight:900;color:#2ECC8A">${fmtN(totEmbC)}</span>
        <span style="font-size:10px;color:#2ECC8A">${totTipoCarg>0?pctEmbTipo+'%':'—'}</span>
        <span style="font-size:11px;font-weight:900;color:#60B0FF">${fmtN(totTipoProd)}</span>
        <span style="font-size:10px;font-weight:900;color:${scFTipo.c}">${pctFTipo}%</span>
      </div>
      <div style="display:grid;grid-template-columns:${GT2};gap:0 2px;align-items:baseline;text-align:right;margin-bottom:6px">
        <span></span><span></span><span></span><span></span>
        <span style="font-size:8px;color:#9A88FF">${totArr>0?'+'+fmtN(totArr):'—'}</span>
        <span></span><span></span><span></span>
      </div>
      <div style="height:4px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;margin-bottom:4px">
        <div style="height:100%;width:${Math.min(pctFTipo,100)}%;background:linear-gradient(90deg,#F97316,#3B8FFF);border-radius:3px"></div>
      </div>
      <div style="font-size:7px;color:var(--txt3);display:flex;justify-content:space-between">
        <span>Embalado total vs plan</span>
        <span style="color:${scFTipo.c};font-weight:700">${fmtN(totTipoProd)} / ${fmtN(totTipoPlan)}</span>
      </div>
    </div>`;

  _getPlanEl('plan-tipo-material').innerHTML = tipoHtml;

  window._toggleTipoDet = function(tipo){
    const det = document.getElementById('tipo-det-block-'+tipo);
    const row = document.getElementById('row-tipo-det-'+tipo);
    if(!det) return;
    const abierto = det.style.display==='block';
    det.style.display = abierto?'none':'block';
    window._tipoExpandido['tipo-det-'+tipo] = !abierto;
    if(row) row.style.background = abierto?'transparent':'rgba(59,143,255,.09)';
  };

  // ── Gráfico de tendencia diaria — Chart.js: línea Cargado vs Embalado ──
  const prodPorFecha={};
  prodFiltradaSemana.forEach(r=>{ prodPorFecha[r.fecha]=(prodPorFecha[r.fecha]||0)+Number(r.cantidad); });
  const hayCargado = Object.keys(entregasPorFecha).length > 0;

  _getPlanEl('plan-grafico-diario').innerHTML =
    `<div style="position:relative;height:200px"><canvas id="plan-chart-diario"></canvas></div>`;
  renderPlanTrendChart(diasSem, prodPorFecha, entregasPorFecha, hoy, metaDiariaPlan, hayCargado);

  // (datos ya en caché — renderizado completado)
}
// ── Helper: devuelve el elemento del Plan en la pantalla activa (sup o ger) ──
function _getPlanEl(id){
  const gerEl = document.getElementById('ger-'+id);
  const supEl = document.getElementById(id);
  // Usar el elemento cuya pantalla padre esté activa (.on)
  const scGer = document.getElementById('sc-ger');
  if(scGer && scGer.classList.contains('on')) return gerEl || supEl;
  return supEl || gerEl;
}

async

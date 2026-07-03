/**
 * dashboard.js
 * ─────────────────────────────────────────────────────────────
 * Dashboard individual de embaladora: carga de datos de día,
 * semana, mes e historial. Renderizado de anillo de progreso,
 * barras por tipo, heatmap de actividad, logros, ranking podio,
 * celebración con confetti y frases motivacionales.
 *
 * Dependencias : config.js, supabase.js, helpers.js, ui.js
 * Exporta (global): showDashTab, showDashTab2, loadSemana,
 *   loadHistorial, renderDiaHTML, renderTipoBars, renderBarChart,
 *   ring, calcularLogros, renderHeatmap, hmTooltip,
 *   mostrarWelcome, lanzarCelebracion, cerrarCeleb,
 *   lanzarConfetti, getFrase, fetchRecordYRacha
 * ─────────────────────────────────────────────────────────────
 */

// ============================================================
// DASHBOARD EMBALADORA
// ============================================================
function showDashTab(tab, btn){
  ['dia','semana','mes','historial'].forEach(t=>{
    document.getElementById('dt-'+t).style.display=t===tab?'block':'none';
  });
  document.querySelectorAll('.dtab').forEach(b=>b.classList.remove('on'));
  if(btn&&btn.classList) btn.classList.add('on');
  if(tab==='semana') loadSemana();
  else if(tab==='mes') loadMes();
  else if(tab==='historial') loadHistorial();
}

function renderDiaHTML(g, meta, pct, fecha, rows, gAyer={}, gfTend={}){
  const canales={};
  rows.forEach(r=>{if(r.tipo!=='insumo') canales[r.canal]=(canales[r.canal]||0)+r.cantidad;});

  // Comparativa con ayer
  let compAyer='';
  if(gAyer.total>0){
    const diff=g.total-gAyer.total;
    const diffPct=Math.round(Math.abs(diff)/gAyer.total*100);
    if(diff>0) compAyer=`<div class="mini-trend trend-up">↑ +${fmtN(diff)} uds vs ayer (+${diffPct}%)</div>`;
    else if(diff<0) compAyer=`<div class="mini-trend trend-dn">↓ ${fmtN(Math.abs(diff))} uds vs ayer (−${diffPct}%)</div>`;
    else compAyer=`<div class="mini-trend trend-eq">= Igual que ayer</div>`;
  }

  // Actualizar hero progress bar
  if(meta>0){
    const pctC=Math.min(pct,100);
    const col=pct>=100?'#2ECC8A':pct>=70?'#FFBA4D':'#3B8FFF';
    const heroMeta=document.getElementById('dash-hero-meta');
    const horaStr=new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
    const frase=getFrase(pct);
    if(heroMeta) heroMeta.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
        <div>
          <div style="font-size:11px;color:rgba(255,255,255,.5);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Meta del día · ${fmtFecha(fecha).slice(0,5)}</div>
          <div style="font-size:36px;font-weight:900;color:${col};line-height:1;letter-spacing:-.03em">${fmtN(g.total)}<span style="font-size:14px;font-weight:600;color:rgba(255,255,255,.4);margin-left:4px">/ ${fmtN(meta)} uds</span></div>
          ${compAyer}
        </div>
        <div style="text-align:right">
          <div style="font-size:38px;font-weight:900;color:${col};line-height:1;letter-spacing:-.03em">${pct}%</div>
          ${pct>=100?'<div style="font-size:10px;color:#2ECC8A;font-weight:700">¡Meta! 🏆</div>':''}
        </div>
      </div>
      <div style="height:12px;background:rgba(255,255,255,.07);border-radius:6px;overflow:hidden;position:relative;margin-bottom:10px">
        <div style="position:absolute;top:0;left:${Math.min(100,100)}%;width:1.5px;height:100%;background:rgba(255,255,255,.25)"></div>
        <div style="height:100%;width:${pctC}%;background:linear-gradient(90deg,${col}99,${col});border-radius:6px;transition:width .8s cubic-bezier(.4,0,.2,1);position:relative">
          <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.2));border-radius:6px"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="font-size:11px;color:${col};font-weight:600;font-style:italic;flex:1;line-height:1.3">${frase}</div>
        <div style="font-size:9px;color:rgba(255,255,255,.25);white-space:nowrap;flex-shrink:0">Act. ${horaStr}</div>
      </div>`;
  }

  // Celebración
  const celebracion=pct>=100?`<div class="meta-banner">
    <div class="mb-icon">🏆</div>
    <div class="mb-txt">
      <div class="mb-t">¡Meta cumplida! ¡Excelente trabajo!</div>
      <div class="mb-s">${fmtN(g.total)} uds · ${pct}% de tu meta diaria</div>
    </div>
  </div>`:'';

  // KPIs tipo de material
  const tipos=[
    {k:'maleta',n:'Maletas',c:'#3B8FFF'},
    {k:'linea',n:'No maleta',c:'#2ECC8A'},
    {k:'insumo',n:'Insumos',c:'#9A88FF'},
    {k:'otro',n:'Otro',c:'#FFBA4D'},
  ].filter(t=>g[t.k]>0);
  const maxTipo=Math.max(...tipos.map(t=>g[t.k]),1);

  return`
  ${celebracion}
  <div style="display:grid;grid-template-columns:repeat(${Math.min(tipos.length,2)},1fr);gap:8px;margin-bottom:.7rem">
    ${tipos.map(t=>{
      const barW=Math.round(g[t.k]/maxTipo*100);
      const pctT=g.total>0?Math.round(g[t.k]/g.total*100):0;
      return`<div style="background:var(--card);border:1px solid ${t.c}33;border-radius:var(--r);padding:12px 14px;position:relative;overflow:hidden">
        <div style="position:absolute;bottom:0;left:0;height:3px;width:${barW}%;background:${t.c};border-radius:0 0 0 var(--r);transition:width .6s ease"></div>
        <div style="font-size:9px;font-weight:700;color:${t.c};text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">${t.n}</div>
        <div style="font-size:24px;font-weight:800;color:var(--txt);line-height:1;letter-spacing:-.02em">${fmtN(g[t.k])}</div>
        <div style="font-size:10px;color:var(--txt3);margin-top:3px">${pctT}% del total</div>
      </div>`;
    }).join('')}
  </div>
  ${Object.keys(canales).length?`<div class="card">
    <div class="card-title" style="margin-bottom:.75rem">Por canal</div>
    ${Object.entries(canales).sort((a,b)=>b[1]-a[1]).map(([c,v])=>{
      const barW=Math.round(v/g.total*100);
      return`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
        <span class="canal-chip" style="flex-shrink:0">${c||'—'}</span>
        <div style="flex:1;height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden">
          <div style="width:${barW}%;height:100%;background:#3B8FFF;border-radius:3px;transition:width .5s ease"></div>
        </div>
        <span style="font-size:13px;font-weight:700;color:var(--txt);min-width:42px;text-align:right">${fmtN(v)}</span>
      </div>`;
    }).join('')}
  </div>`:''}`;
}

function renderTipoBars(g){
  const max=Math.max(g.maleta,g.linea,g.otro)||1;
  return['maleta','linea','insumo','otro'].filter(t=>g[t]>0).map(t=>`
  <div class="tipo-item">
    <div class="tipo-dot" style="background:${TIPO_COLORS[t]}"></div>
    <div class="tipo-name">${TIPO_NAMES[t]}</div>
    <div class="tipo-bar-wrap"><div class="tipo-bar" style="width:${Math.round(g[t]/max*100)}%;background:${TIPO_COLORS[t]}"></div></div>
    <div class="tipo-val">${fmtN(g[t])}</div>
    <div class="tipo-pct">${g.total>0?Math.round(g[t]/g.total*100):0}%</div>
  </div>`).join('');
}

async function loadSemana(){
  const ws=document.getElementById('fil-semana').value;
  if(!ws) return;
  const [desde,hasta]=weekRange(ws);
  const el=document.getElementById('sem-content');
  el.innerHTML='<div class="loading"><span class="spinner"></span>Cargando...</div>';
  try{
    // Usar caché si la semana incluye hoy
    const hoy=today();
    let rows;
    if(desde<=hoy && hoy<=hasta && _cache.rows){
      rows=_cache.rows.filter(r=>r.fecha>=desde&&r.fecha<=hasta);
    } else {
      rows=await fetchProd(cUser,desde,hasta);
    }
    if(!rows.length){el.innerHTML='<div class="empty">Sin datos para esta semana</div>';return}

    const g=groupByTipo(rows);
    const gf=groupByFecha(rows);
    const meta=META[cUser]||0;
    const metaSem=meta*5;
    const pctSem=metaSem>0?Math.min(100,Math.round(g.total/metaSem*100)):0;
    const pctCol=pctSem>=100?'#2ECC8A':pctSem>=60?'#FFBA4D':'#3B8FFF';
    const dias=['Lun','Mar','Mié','Jue','Vie'];
    const fechas=[];
    for(let i=0;i<5;i++){
      const d=new Date(desde+'T12:00:00'); d.setDate(d.getDate()+i);
      fechas.push(d.toISOString().slice(0,10));
    }
    const vals=fechas.map(f=>gf[f]?.total||0);
    const maxVal=Math.max(...vals,1);
    const mejorIdx=vals.indexOf(Math.max(...vals));

    el.innerHTML=`
    <!-- Progreso semanal -->
    <div style="background:linear-gradient(135deg,#0A1E3D,#061228);border:1px solid #1A3354;border-radius:var(--r);padding:16px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Semana ${ws.split('-W')[1]} · ${fmtFecha(desde).slice(0,5)} – ${fmtFecha(hasta).slice(0,5)}</div>
          <div style="font-size:38px;font-weight:900;color:${pctCol};line-height:1;letter-spacing:-.03em">${fmtN(g.total)}<span style="font-size:14px;font-weight:500;color:rgba(255,255,255,.35);margin-left:4px">uds</span></div>
        </div>
        <div style="text-align:right">
          <div style="font-size:36px;font-weight:900;color:${pctCol};line-height:1">${pctSem}%</div>
          <div style="font-size:10px;color:var(--txt3);margin-top:2px">${metaSem>0?`meta: ${fmtN(metaSem)}`:'sin meta'}</div>
        </div>
      </div>
      <div style="height:10px;background:rgba(255,255,255,.07);border-radius:5px;overflow:hidden">
        <div style="height:100%;width:${pctSem}%;background:linear-gradient(90deg,${pctCol}88,${pctCol});border-radius:5px;transition:width .7s ease;position:relative">
          <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.18));border-radius:5px"></div>
        </div>
      </div>
    </div>

    <!-- Barras por día -->
    <div class="card">
      <div class="card-title" style="margin-bottom:14px">Producción por día</div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:6px;height:120px;padding:0 4px">
        ${fechas.map((f,i)=>{
          const v=vals[i];
          const esFuturo=f>hoy;
          const esHoy=f===hoy;
          const h=esFuturo?0:v>0?Math.max(Math.round(v/maxVal*100),4):0;
          const esMejor=i===mejorIdx&&v>0;
          const barCol=esMejor?'#FFBA4D':meta>0&&v>=meta?'#2ECC8A':'#3B8FFF';
          const metaH=meta>0?Math.round(meta/maxVal*100):0;
          return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="font-size:${v>999?'9':'10'}px;font-weight:700;color:${esMejor?'#FFBA4D':esHoy?'#60B0FF':'var(--txt2)'};min-height:14px">
              ${v>0?fmtN(v):esFuturo?'':'-'}
            </div>
            <div style="width:100%;height:100px;display:flex;align-items:flex-end;position:relative">
              <!-- Línea de meta -->
              ${meta>0&&!esFuturo?`<div style="position:absolute;left:0;right:0;bottom:${metaH}%;height:1px;background:rgba(255,255,255,.2);z-index:1"></div>`:''}
              ${esFuturo
                ?`<div style="width:100%;height:${metaH}%;background:rgba(255,255,255,.04);border:1px dashed rgba(255,255,255,.1);border-radius:4px 4px 0 0"></div>`
                :`<div style="width:100%;height:${h}%;background:${barCol};border-radius:5px 5px 0 0;position:relative;overflow:hidden;transition:height .5s ease">
                    <div style="position:absolute;top:0;left:0;right:0;height:40%;background:linear-gradient(180deg,rgba(255,255,255,.2),transparent);border-radius:5px 5px 0 0"></div>
                  </div>`}
            </div>
            <div style="font-size:10px;font-weight:${esHoy?'700':'500'};color:${esHoy?'#60B0FF':'var(--txt3)'}">${dias[i]}</div>
            ${esHoy?`<div style="width:4px;height:4px;border-radius:50%;background:#60B0FF;margin-top:-2px"></div>`:''}
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;justify-content:center;gap:14px;margin-top:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:var(--txt3)"><div style="width:8px;height:8px;background:#3B8FFF;border-radius:2px"></div>Normal</div>
        <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#2ECC8A"><div style="width:8px;height:8px;background:#2ECC8A;border-radius:2px"></div>Sobre meta</div>
        <div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#FFBA4D"><div style="width:8px;height:8px;background:#FFBA4D;border-radius:2px"></div>Mejor día</div>
      </div>
    </div>

    <!-- KPIs compactos -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:11px 12px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Días</div>
        <div style="font-size:22px;font-weight:800;color:var(--txt)">${Object.keys(gf).length}</div>
        <div style="font-size:9px;color:var(--txt3)">activos</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:11px 12px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Prom.</div>
        <div style="font-size:22px;font-weight:800;color:#3B8FFF">${fmtN(Math.round(g.total/Math.max(Object.keys(gf).length,1)))}</div>
        <div style="font-size:9px;color:var(--txt3)">uds/día</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:11px 12px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Mejor</div>
        <div style="font-size:22px;font-weight:800;color:#FFBA4D">${fmtN(Math.max(...vals))}</div>
        <div style="font-size:9px;color:var(--txt3)">${dias[mejorIdx]}</div>
      </div>
    </div>

    <!-- Tipo de material -->
    <div class="card">
      <div class="card-title" style="margin-bottom:.85rem">Por tipo de material</div>
      ${renderTipoBars(g)}
    </div>`;
  }catch(e){el.innerHTML='<div class="empty">Error: '+e.message+'</div>'}

  // ── Canal Online banner — siempre visible ──
  const cyberBanner = document.getElementById('cyber-banner');
  if(cyberBanner){
    cyberBanner.style.display = 'block';
    actualizarCyber();
  }
}

async function loadHistorial(){
  const el=document.getElementById('hist-content');
  el.innerHTML='<div class="loading"><span class="spinner"></span>Cargando tu perfil...</div>';
  try{
    const hoy=today();
    const cache=await getHistorialCache();
    const {rows:rowsAll,gfAll}=cache;
    if(!rowsAll.length){el.innerHTML='<div class="empty">Sin datos históricos aún</div>';return;}

    // ── Cálculos base ──
    const mesActual=hoy.slice(0,7);
    const rowsNoInsumo=rowsAll.filter(r=>r.tipo!=='insumo');
    const diasActivos=Object.values(gfAll).filter(d=>d.total>0).length;
    const totalAll=rowsNoInsumo.reduce((s,r)=>s+r.cantidad,0);
    const promDiario=diasActivos>0?Math.round(totalAll/diasActivos):0;
    const valoresDias=Object.values(gfAll).map(d=>d.total);
    const record=Math.max(...valoresDias,0);
    const recordFecha=Object.entries(gfAll).find(([,d])=>d.total===record)?.[0]||'';

    // Meta mes
    const metaDia=META[cUser]||0;
    const rowsMes=rowsNoInsumo.filter(r=>r.fecha.startsWith(mesActual));
    const totalMes=rowsMes.reduce((s,r)=>s+r.cantidad,0);
    const metaMes=metaDia*20;
    const pctMeta=metaMes>0?Math.min(100,Math.round(totalMes/metaMes*100)):0;
    const diasMesAct=new Set(rowsMes.map(r=>r.fecha)).size;
    const promMesAct=diasMesAct>0?Math.round(totalMes/diasMesAct):0;

    // Mes anterior
    const [anioM,mesM]=mesActual.split('-').map(Number);
    const mesAntKey=mesM===1?`${anioM-1}-12`:`${anioM}-${String(mesM-1).padStart(2,'0')}`;
    const rowsAnt=rowsNoInsumo.filter(r=>r.fecha.startsWith(mesAntKey));
    const diasAnt=new Set(rowsAnt.map(r=>r.fecha)).size;
    const totalAnt=rowsAnt.reduce((s,r)=>s+r.cantidad,0);
    const promAnt=diasAnt>0?Math.round(totalAnt/diasAnt):0;
    const varPct=promAnt>0?Math.round((promMesAct-promAnt)/promAnt*100):null;
    const varColor=varPct!==null&&varPct>=0?'#2ECC8A':'#FF6B6B';
    const varTxt=varPct!==null?(varPct>=0?`+${varPct}%`:`${varPct}%`):'—';

    // Racha actual
    let rachaActual=0;
    let dRacha=new Date(hoy+'T12:00:00');
    for(let i=0;i<90;i++){
      const f=dRacha.toISOString().slice(0,10);
      if(gfAll[f]&&gfAll[f].total>0) rachaActual++;
      else if(rachaActual>0) break;
      dRacha.setDate(dRacha.getDate()-1);
    }

    // Mejor semana
    const porSemana={};
    Object.entries(gfAll).forEach(([f,d])=>{
      const dt=new Date(f+'T12:00:00');
      const jan4=new Date(dt.getFullYear(),0,4);
      const s=new Date(jan4); s.setDate(jan4.getDate()-(jan4.getDay()||7)+1);
      const sem=Math.ceil(((dt-s)/86400000+1)/7);
      const key=`${dt.getFullYear()}-S${String(sem).padStart(2,'0')}`;
      porSemana[key]=(porSemana[key]||0)+d.total;
    });
    const mejorSemEntry=Object.entries(porSemana).sort((a,b)=>b[1]-a[1])[0];
    const mejorSem=mejorSemEntry?mejorSemEntry[1]:0;
    const mejorSemKey=mejorSemEntry?mejorSemEntry[0]:'—';

    // Datos gráfico 30 días
    const d30=new Date(hoy+'T12:00:00'); d30.setDate(d30.getDate()-29);
    const desde30=d30.toISOString().slice(0,10);
    const labels30=[],data30=[];
    for(let i=0;i<30;i++){
      const dd=new Date(desde30+'T12:00:00'); dd.setDate(dd.getDate()+i);
      const f=dd.toISOString().slice(0,10);
      labels30.push(f); data30.push(gfAll[f]?.total??null);
    }

    // Top 3 días del mes
    const top3=Object.entries(gfAll)
      .filter(([f])=>f.startsWith(mesActual))
      .sort((a,b)=>b[1].total-a[1].total).slice(0,3);
    const maxTop=top3[0]?.[1].total||1;

    // Mix de tipo (histórico)
    const totalTipos={maleta:0,linea:0,insumo:0,otro:0};
    rowsAll.forEach(r=>{totalTipos[r.tipo]=(totalTipos[r.tipo]||0)+r.cantidad;});
    const totalTipoSum=Object.values(totalTipos).reduce((a,b)=>a+b,0)||1;

    // Score sintético (0-100)

    // Avatar iniciales
    const nombre=DB[cUser]||cUser;
    const partes=nombre.trim().split(/\s+/);
    const iniciales=(partes[0][0]+(partes[1]?partes[1][0]:'')).toUpperCase();
    const primerNombre=partes[0];

    // Colores dinámicos

    const cMeta=pctMeta>=100?'#2ECC8A':pctMeta>=70?'#FFBA4D':'#3B8FFF';
    const cRacha=rachaActual>=7?'#FF6B6B':rachaActual>=3?'#FFBA4D':'#2ECC8A';

    // Ring SVG helper
    const ring=(r,pct,color,size=44,sw=5)=>{
      const circ=2*Math.PI*r; const off=circ*(1-Math.min(1,pct/100));
      return`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="${sw}"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
          stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      </svg>`;
    };

    // Insights dinámicos
    const insights=[];
    if(varPct!==null&&varPct>0) insights.push({ico:'📈',col:'#2ECC8A',txt:`Mejoraste <strong>+${varPct}%</strong> vs el mes anterior. ¡Gran tendencia!`});
    else if(varPct!==null&&varPct<0) insights.push({ico:'📉',col:'#FF6B6B',txt:`Bajaste <strong>${varPct}%</strong> vs el mes anterior. ¡Tú puedes recuperarlo!`});
    if(rachaActual>=5) insights.push({ico:'🔥',col:'#FF6B6B',txt:`¡Llevas <strong>${rachaActual} días seguidos</strong> activa! Racha increíble.`});
    else if(rachaActual>=2) insights.push({ico:'⚡',col:'#FFBA4D',txt:`Llevas <strong>${rachaActual} días consecutivos</strong> activa. ¡Sigue así!`});
    if(pctMeta>=100) insights.push({ico:'🏆',col:'#FFBA4D',txt:`<strong>¡Meta del mes cumplida!</strong> Eres la número uno este mes.`});
    else if(metaMes>0) insights.push({ico:'🎯',col:'#3B8FFF',txt:`Vas en <strong>${pctMeta}% de tu meta mensual</strong> (${fmtN(totalMes)} de ${fmtN(metaMes)} uds).`});
    if(record>=metaDia&&metaDia>0) insights.push({ico:'💎',col:'#9A88FF',txt:`Tu récord histórico es <strong>${fmtN(record)} uds</strong> — superaste la meta en ese día.`});
    insights.push({ico:'📅',col:'#7090C0',txt:`Has estado activa <strong>${diasActivos} días</strong> con un promedio de <strong>${fmtN(promDiario)} uds/día</strong>.`});

    // ── HTML principal ──
    el.innerHTML=`
    <style>
      .pf-hero{background:linear-gradient(160deg,#0A1C38 0%,#060E1E 100%);border:1px solid #1A2E50;border-radius:18px;padding:20px 16px 16px;margin-bottom:10px;position:relative;overflow:hidden}
      .pf-hero::before{content:'';position:absolute;top:-40px;left:50%;transform:translateX(-50%);width:240px;height:160px;background:radial-gradient(ellipse,rgba(59,143,255,.18) 0%,transparent 70%);pointer-events:none}
      .pf-avatar-ring{width:80px;height:80px;border-radius:50%;padding:3px;background:conic-gradient(from 0deg,#3B8FFF,#2ECC8A,#9A88FF,#FFBA4D,#3B8FFF);margin:0 auto 12px;animation:pfSpin 6s linear infinite;flex-shrink:0}
      @keyframes pfSpin{to{filter:hue-rotate(360deg)}}
      .pf-avatar-inner{width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#1A2E50,#0C1428);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#fff;position:relative;overflow:hidden}
      .pf-avatar-inner::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 30% 30%,rgba(59,143,255,.25),transparent 60%)}
      .pf-badge-ring{position:absolute;bottom:-2px;right:-2px;width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#FFBA4D,#FF8C00);border:2px solid #060E1E;display:flex;align-items:center;justify-content:center;font-size:11px;animation:pfBadge 2s ease-in-out infinite}
      @keyframes pfBadge{0%,100%{box-shadow:0 0 8px rgba(255,184,77,.4)}50%{box-shadow:0 0 18px rgba(255,184,77,.8)}}
      .pf-name{font-size:20px;font-weight:900;color:#fff;text-align:center;line-height:1.1;margin-bottom:5px}
      .pf-tags{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin-bottom:14px}
      .pf-tag{display:inline-flex;align-items:center;gap:4px;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700}
      .pf-hero-stats{display:grid;grid-template-columns:1fr 1fr 1fr;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden}
      .pf-hs{padding:8px 4px;text-align:center;position:relative}
      .pf-hs:not(:last-child)::after{content:'';position:absolute;right:0;top:20%;bottom:20%;width:1px;background:rgba(255,255,255,.08)}
      .pf-hs-ico{font-size:13px;margin-bottom:2px}
      .pf-hs-val{font-size:13px;font-weight:800;color:var(--txt);line-height:1}
      .pf-hs-lbl{font-size:8px;color:var(--txt3);margin-top:2px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}

      .pf-score{background:linear-gradient(135deg,#0C1F3A,#0A1428);border:1px solid #1A2E50;border-radius:18px;padding:14px;margin-bottom:10px;position:relative;overflow:hidden}
      .pf-score::before{content:'';position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:radial-gradient(circle,rgba(59,143,255,.12),transparent 70%)}
      .pf-score-grid{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center}
      .pf-big-ring{position:relative;width:88px;height:88px;flex-shrink:0}
      .pf-big-ring-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
      .pf-mini-rings{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
      .pf-mini-wrap{background:rgba(255,255,255,.03);border-radius:10px;padding:7px 4px;display:flex;flex-direction:column;align-items:center;gap:3px}
      .pf-mini-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:10px;font-weight:900;line-height:1}
      .pf-mini-rel{position:relative;width:44px;height:44px}
      .pf-mini-lbl{font-size:8px;color:var(--txt3);font-weight:600;text-align:center;line-height:1.2}

      .pf-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}
      .pf-kpi{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:3px;position:relative;overflow:hidden}
      .pf-kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;border-radius:2px 2px 0 0}
      .pf-kpi-ico{font-size:20px;line-height:1}
      .pf-kpi-val{font-size:15px;font-weight:900;line-height:1;text-align:center}
      .pf-kpi-lbl{font-size:8px;color:var(--txt3);font-weight:600;text-align:center;text-transform:uppercase;letter-spacing:.04em}
      .pf-kpi-sub{font-size:8px;text-align:center;margin-top:1px}

      .pf-card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:14px;margin-bottom:10px}
      .pf-card-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
      .pf-card-ttl{font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:6px}
      .pf-card-ttl::before{content:'';width:3px;height:14px;border-radius:2px;display:inline-block;background:var(--blue)}

      .pf-comp-row{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-top:4px}
      .pf-comp-side{background:rgba(255,255,255,.03);border-radius:10px;padding:10px;text-align:center}
      .pf-comp-side-lbl{font-size:8px;color:var(--txt3);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}
      .pf-comp-side-val{font-size:22px;font-weight:900;line-height:1}
      .pf-comp-side-sub{font-size:9px;color:var(--txt3);margin-top:2px}
      .pf-comp-delta{border-radius:12px;padding:8px 6px;text-align:center;border:1px solid}
      .pf-comp-delta-val{font-size:16px;font-weight:900;line-height:1}
      .pf-comp-delta-lbl{font-size:8px;margin-top:2px;line-height:1.3}

      .pf-logros-scroll{display:flex;gap:7px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
      .pf-logros-scroll::-webkit-scrollbar{display:none}
      .pf-logro{flex-shrink:0;width:70px;display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:12px;padding:9px 5px 7px;position:relative;overflow:hidden}
      .pf-logro.on{border-color:rgba(255,184,77,.4);background:linear-gradient(135deg,#1A1400,#0C1428)}
      .pf-logro.on::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 0%,rgba(255,184,77,.1),transparent 60%)}
      .pf-logro.off{opacity:.35;filter:grayscale(.7)}
      .pf-logro-ico{font-size:26px;line-height:1}
      .pf-logro-nom{font-size:8px;font-weight:700;color:var(--txt);text-align:center;line-height:1.2}
      .pf-logro-prog{width:100%;height:3px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden;margin-top:2px}
      .pf-logro-prog-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,#FFBA4D,#FF8C00)}
      .pf-logro-check{position:absolute;top:4px;right:4px;width:13px;height:13px;background:#FFBA4D;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:900;color:#000}

      .pf-mat-grid{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;margin-top:4px}
      .pf-mat-item{display:flex;align-items:center;gap:7px;margin-bottom:5px}
      .pf-mat-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
      .pf-mat-bar{height:4px;background:rgba(255,255,255,.06);border-radius:2px;flex:1;overflow:hidden}
      .pf-mat-fill{height:100%;border-radius:2px}
      .pf-mat-pct{font-size:10px;font-weight:700;width:32px;text-align:right}

      .pf-ins-item{display:flex;align-items:flex-start;gap:8px;background:rgba(255,255,255,.025);border-radius:10px;padding:9px 10px;margin-bottom:6px;border-left:3px solid}
      .pf-ins-ico{font-size:13px;flex-shrink:0;margin-top:1px}
      .pf-ins-txt{font-size:10px;color:var(--txt2);line-height:1.45;flex:1}
      .pf-ins-txt strong{color:var(--txt)}

      .pf-banner{background:linear-gradient(135deg,#0A1C38,#091220);border:1px solid rgba(59,143,255,.2);border-radius:18px;padding:14px;display:flex;gap:12px;align-items:center;margin-bottom:10px;position:relative;overflow:hidden}
      .pf-banner::before{content:'';position:absolute;top:-20px;right:-20px;width:90px;height:90px;background:radial-gradient(circle,rgba(154,136,255,.12),transparent 70%)}

      .pf-trend-card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:14px;margin-bottom:10px;position:relative;overflow:hidden}
      .pf-trend-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:50px;background:linear-gradient(0deg,rgba(59,143,255,.04),transparent);pointer-events:none}

      @keyframes pfFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      .pf-sec{animation:pfFadeUp .4s ease both}
      .pf-s1{animation-delay:.05s}.pf-s2{animation-delay:.1s}.pf-s3{animation-delay:.15s}
      .pf-s4{animation-delay:.2s}.pf-s5{animation-delay:.25s}.pf-s6{animation-delay:.3s}
      .pf-s7{animation-delay:.35s}.pf-s8{animation-delay:.4s}.pf-s9{animation-delay:.45s}
    </style>

    <!-- ── HERO ── -->
    <div class="pf-hero pf-sec pf-s1">
      <div style="display:flex;flex-direction:column;align-items:center">
        <div class="pf-avatar-ring" style="position:relative">
          <div class="pf-avatar-inner">${iniciales}
            <div class="pf-badge-ring">${rachaActual>=7?'🔥':pctMeta>=100?'🏆':'⭐'}</div>
          </div>
        </div>
        <div class="pf-name">${nombre.split(' ').slice(0,2).join(' ')}</div>
        <div class="pf-tags">
          ${pctMeta>=100?`<div class="pf-tag" style="background:rgba(255,184,77,.12);border:1px solid rgba(255,184,77,.3);color:#FFBA4D">🏆 Meta cumplida</div>`:''}
          <div class="pf-tag" style="background:rgba(59,143,255,.1);border:1px solid rgba(59,143,255,.25);color:#7EB5FF">📦 Embaladora</div>
          ${rachaActual>=5?`<div class="pf-tag" style="background:rgba(255,107,107,.1);border:1px solid rgba(255,107,107,.25);color:#FF6B6B">🔥 Racha ${rachaActual}d</div>`:''}
        </div>
        <div class="pf-hero-stats" style="width:100%">
          <div class="pf-hs"><div class="pf-hs-ico">📅</div><div class="pf-hs-val">${diasActivos}</div><div class="pf-hs-lbl">Días activos</div></div>
          <div class="pf-hs"><div class="pf-hs-ico">📦</div><div class="pf-hs-val">${totalAll>=1000?(totalAll/1000).toFixed(0)+'K':fmtN(totalAll)}</div><div class="pf-hs-lbl">Uds totales</div></div>
          <div class="pf-hs"><div class="pf-hs-ico">🏆</div><div class="pf-hs-val">${fmtN(record)}</div><div class="pf-hs-lbl">Récord día</div></div>
        </div>
      </div>
    </div>

    <!-- ── SCORE GENERAL ── -->
    <div class="pf-score pf-sec pf-s2">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:9px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.1em;display:flex;align-items:center;gap:6px">
          <span style="display:inline-block;width:16px;height:2px;background:${cMeta};border-radius:2px"></span>Meta mensual · ${fmtMes(mesActual)}
        </div>
        <div style="font-size:28px;font-weight:900;color:${cMeta};line-height:1;letter-spacing:-.03em">${pctMeta}%</div>
      </div>

      <!-- Anillo grande centrado -->
      <div style="display:flex;align-items:center;gap:16px">
        <div style="position:relative;width:100px;height:100px;flex-shrink:0">
          ${ring(42,pctMeta,cMeta,100,9)}
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
            <div style="font-size:20px;font-weight:900;color:${cMeta};line-height:1">${fmtN(totalMes)}</div>
            <div style="font-size:8px;color:var(--txt3);margin-top:2px">uds</div>
          </div>
        </div>
        <div style="flex:1">
          <!-- Barra de progreso -->
          <div style="height:14px;background:rgba(255,255,255,.06);border-radius:7px;overflow:hidden;margin-bottom:8px;position:relative">
            <div style="height:100%;width:${pctMeta}%;background:linear-gradient(90deg,${cMeta}99,${cMeta});border-radius:7px;transition:width .8s cubic-bezier(.4,0,.2,1)"></div>
            ${pctMeta<100?`<div style="position:absolute;top:50%;right:8px;transform:translateY(-50%);font-size:8px;font-weight:700;color:rgba(255,255,255,.3)">${fmtN(metaMes-totalMes)} faltan</div>`:''}
          </div>
          <!-- Sub-stats -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div style="background:rgba(255,255,255,.03);border-radius:8px;padding:7px 10px">
              <div style="font-size:8px;color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Días trabajados</div>
              <div style="font-size:16px;font-weight:800;color:var(--txt);line-height:1">${diasMesAct}<span style="font-size:10px;color:var(--txt3);font-weight:500"> días</span></div>
            </div>
            <div style="background:rgba(255,255,255,.03);border-radius:8px;padding:7px 10px">
              <div style="font-size:8px;color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Prom. este mes</div>
              <div style="font-size:16px;font-weight:800;color:var(--txt);line-height:1">${fmtN(promMesAct)}<span style="font-size:10px;color:var(--txt3);font-weight:500"> uds</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Meta total -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)">
        <div style="font-size:10px;color:var(--txt3)">Meta total del mes</div>
        <div style="font-size:13px;font-weight:700;color:var(--txt2)">${fmtN(totalMes)} <span style="color:var(--txt3)">/ ${fmtN(metaMes)} uds</span></div>
      </div>

      ${pctMeta>=100?`<div style="margin-top:10px;background:linear-gradient(90deg,rgba(46,204,138,.08),rgba(0,212,255,.06));border:1px solid rgba(46,204,138,.2);border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:8px"><span style="font-size:16px">🏆</span><span style="font-size:11px;color:#2ECC8A;font-weight:700">¡Meta del mes completada!</span></div>`:''}
    </div>

    <!-- ── KPIs ── -->
    <div class="pf-kpis pf-sec pf-s3">
      <div class="pf-kpi" style="border-top-color:#3B8FFF">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:#3B8FFF;border-radius:2px 2px 0 0"></div>
        <div class="pf-kpi-ico">📦</div>
        <div class="pf-kpi-val" style="color:#3B8FFF">${fmtN(promDiario)}</div>
        <div class="pf-kpi-lbl">Prom. día</div>
        <div class="pf-kpi-sub" style="color:rgba(59,143,255,.5)">Meta:${fmtN(metaDia)}</div>
      </div>
      <div class="pf-kpi">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:#FFBA4D;border-radius:2px 2px 0 0"></div>
        <div class="pf-kpi-ico">⭐</div>
        <div class="pf-kpi-val" style="color:#FFBA4D">${fmtN(mejorSem)}</div>
        <div class="pf-kpi-lbl">Mejor sem.</div>
        <div class="pf-kpi-sub" style="color:rgba(255,184,77,.5)">${mejorSemKey}</div>
      </div>
      <div class="pf-kpi">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${cRacha};border-radius:2px 2px 0 0"></div>
        <div class="pf-kpi-ico">${rachaActual>=7?'🔥':rachaActual>=3?'⚡':'✅'}</div>
        <div class="pf-kpi-val" style="color:${cRacha}">${rachaActual}</div>
        <div class="pf-kpi-lbl">Racha</div>
        <div class="pf-kpi-sub" style="color:rgba(255,255,255,.2)">${rachaActual>=7?'¡Increíble!':rachaActual>=3?'¡Sigue!':'días'}</div>
      </div>
      <div class="pf-kpi">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${cMeta};border-radius:2px 2px 0 0"></div>
        <div class="pf-kpi-ico">${pctMeta>=100?'🏆':pctMeta>=70?'🎯':'📈'}</div>
        <div class="pf-kpi-val" style="color:${cMeta}">${pctMeta}%</div>
        <div class="pf-kpi-lbl">Meta mes</div>
        <div class="pf-kpi-sub" style="color:rgba(255,255,255,.2)">${fmtMes(mesActual).slice(0,3)}</div>
      </div>
    </div>

    <!-- ── GRÁFICO 30 DÍAS ── -->
    <div class="pf-trend-card pf-sec pf-s4">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:10px;font-weight:700;color:var(--txt2);display:flex;align-items:center;gap:6px"><span>📊</span><span id="pf-chart-titulo">Últimos 30 días</span></div>
        <div style="display:flex;align-items:center;gap:4px">
          ${['30d','90d','6m','1a'].map(p=>`<button onclick="pfCambiarPeriodo('${p}')" id="pfbtn-${p}"
            style="background:${p==='30d'?'rgba(59,143,255,.2)':'rgba(255,255,255,.05)'};border:1px solid ${p==='30d'?'rgba(59,143,255,.5)':'rgba(255,255,255,.08)'};
            color:${p==='30d'?'#3B8FFF':'var(--txt3)'};border-radius:6px;padding:3px 8px;font-size:9px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s"
          >${p}</button>`).join('')}
        </div>
      </div>
      <div style="position:relative;height:130px"><canvas id="pfChart30"></canvas></div>
      <div style="display:flex;justify-content:space-between;margin-top:5px">
        <span id="pf-chart-desde" style="font-size:8px;color:var(--txt3)">${labels30[0]?.slice(5).replace('-','/')}</span>
        <span style="font-size:8px;color:var(--txt3)">Hoy</span>
      </div>
      ${rachaActual>=2?`<div style="margin-top:8px;background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.18);border-radius:9px;padding:7px 10px;font-size:10px;color:#2ECC8A;font-weight:600;display:flex;align-items:center;gap:6px">✅ <span>Llevas <strong>${rachaActual} días seguidos</strong> activa — ¡gran racha!</span></div>`:''}
    </div>

    <!-- ── COMPARATIVA VS SÍ MISMA ── -->
    <div class="pf-card pf-sec pf-s5">
      <div class="pf-card-hdr">
        <div class="pf-card-ttl" style="--blue:#3B8FFF"><span>⚖️</span> Comparación vs mes anterior</div>
      </div>
      <div class="pf-comp-row">
        <div class="pf-comp-side">
          <div class="pf-comp-side-lbl">Este mes</div>
          <div class="pf-comp-side-val" style="color:${varPct!==null&&varPct>=0?'#2ECC8A':'#3B8FFF'}">${fmtN(promMesAct)}</div>
          <div class="pf-comp-side-sub">prom uds/día</div>
        </div>
        <div class="pf-comp-delta" style="background:${varPct!==null&&varPct>=0?'rgba(46,204,138,.1)':'rgba(255,107,107,.1)'};border-color:${varPct!==null&&varPct>=0?'rgba(46,204,138,.3)':'rgba(255,107,107,.3)'}">
          <div class="pf-comp-delta-val" style="color:${varColor}">${varTxt}</div>
          <div class="pf-comp-delta-lbl" style="color:${varColor}aa">${varPct!==null&&varPct>=0?'↑ Mejor':'↓ Menor'}<br>vs ant.</div>
        </div>
        <div class="pf-comp-side">
          <div class="pf-comp-side-lbl">Mes anterior</div>
          <div class="pf-comp-side-val" style="color:var(--txt2)">${fmtN(promAnt)}</div>
          <div class="pf-comp-side-sub">prom uds/día</div>
        </div>
      </div>
    </div>

    <!-- ── TOP 3 DÍAS ── -->
    ${top3.length?`<div class="pf-card pf-sec pf-s5">
      <div class="pf-card-hdr">
        <div class="pf-card-ttl"><span>🥇</span> Mejores días · ${fmtMes(mesActual)}</div>
      </div>
      ${top3.map(([f,d],i)=>{
        const cols=['#FFBA4D','#8AAED4','#CD7C54'];
        const emojis=['🥇','🥈','🥉'];
        return`<div style="margin-bottom:${i<2?'10':'0'}px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:11px;color:var(--txt);font-weight:600">${emojis[i]} ${fmtFecha(f)}</span>
            <span style="font-size:12px;font-weight:800;color:${cols[i]}">${fmtN(d.total)} uds</span>
          </div>
          <div style="height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">
            <div style="width:${Math.round(d.total/maxTop*100)}%;height:100%;background:${cols[i]};border-radius:3px;transition:width .5s ease"></div>
          </div>
        </div>`;
      }).join('')}
    </div>`:''}

    <!-- ── LOGROS ── -->
    <div class="pf-card pf-sec pf-s6" id="pf-logros-container"></div>

    <!-- ── MATERIALES ── -->
    <div class="pf-card pf-sec pf-s7">
      <div class="pf-card-hdr">
        <div class="pf-card-ttl"><span>🧳</span> Mix de materiales</div>
        <div style="font-size:9px;color:var(--txt3)">${fmtN(totalAll)} uds históricas</div>
      </div>
      <div class="pf-mat-grid">
        <div style="position:relative;width:76px;height:76px">
          <svg width="76" height="76" viewBox="0 0 76 76" style="transform:rotate(-90deg)">
            <circle cx="38" cy="38" r="28" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="11"/>
            ${(()=>{
              const tipos=[
                {k:'maleta',c:'#378ADD'},
                {k:'linea',c:'#639922'},
                {k:'insumo',c:'#7F77DD'},
                {k:'otro',c:'#BA7517'},
              ];
              const circ=2*Math.PI*28;
              let offset=0;
              return tipos.map(t=>{
                const pct=totalTipos[t.k]/totalTipoSum;
                const dash=circ*pct;
                const el=`<circle cx="38" cy="38" r="28" fill="none" stroke="${t.c}" stroke-width="11"
                  stroke-dasharray="${dash.toFixed(1)} ${(circ-dash).toFixed(1)}"
                  stroke-dashoffset="${(-offset).toFixed(1)}" stroke-linecap="butt"/>`;
                offset+=dash;
                return el;
              }).join('');
            })()}
          </svg>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
            <div style="font-size:11px;font-weight:900;color:var(--txt);line-height:1">${totalAll>=1000?(totalAll/1000).toFixed(0)+'K':fmtN(totalAll)}</div>
            <div style="font-size:7px;color:var(--txt3)">uds</div>
          </div>
        </div>
        <div>
          ${[
            {k:'maleta',n:'🧳 Maleta',c:'#378ADD'},
            {k:'linea',n:'📦 No Maleta',c:'#639922'},
            {k:'insumo',n:'🔧 Insumo',c:'#7F77DD'},
            {k:'otro',n:'📋 Otro',c:'#BA7517'},
          ].map(t=>{
            const pct=Math.round(totalTipos[t.k]/totalTipoSum*100);
            return`<div class="pf-mat-item">
              <div class="pf-mat-dot" style="background:${t.c}"></div>
              <div style="font-size:9px;color:var(--txt2);flex:1">${t.n}</div>
              <div class="pf-mat-bar"><div class="pf-mat-fill" style="width:${pct}%;background:${t.c}"></div></div>
              <div class="pf-mat-pct" style="color:${t.c}">${pct}%</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- ── HEATMAP ── -->
    <div class="pf-sec pf-s8" id="pf-heatmap-container"></div>

    <!-- ── INSIGHTS ── -->
    <div class="pf-card pf-sec pf-s8">
      <div class="pf-card-hdr">
        <div class="pf-card-ttl"><span>⚡</span> Insights</div>
        <div style="width:22px;height:22px;background:rgba(59,143,255,.15);border:1px solid rgba(59,143,255,.3);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#3B8FFF">IA</div>
      </div>
      ${insights.map(ins=>`
        <div class="pf-ins-item" style="border-left-color:${ins.col}">
          <div class="pf-ins-ico">${ins.ico}</div>
          <div class="pf-ins-txt">${ins.txt}</div>
        </div>`).join('')}
    </div>

    <!-- ── BANNER CIERRE ── -->
    <div class="pf-banner pf-sec pf-s9">
      <div style="font-size:30px;flex-shrink:0;filter:drop-shadow(0 0 10px rgba(255,184,77,.5))">${pctMeta>=100?'🏆':rachaActual>=5?'🔥':'⭐'}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:900;color:#fff;margin-bottom:3px">¡Buen trabajo, ${primerNombre}!</div>
        <div style="font-size:10px;color:var(--txt2);line-height:1.4">
          ${pctMeta>=100?'¡Meta mensual cumplida! Eres increíble. 🎉':
            `Te faltan <strong style="color:var(--amber)">${fmtN(metaMes-totalMes)}</strong> uds para completar la meta mensual.`}
        </div>
      </div>
    </div>`;

    // ── Inyectar logros ──
    const logrosCont=document.getElementById('pf-logros-container');
    if(logrosCont){
      const tmpL=document.createElement('div');
      tmpL.innerHTML=calcularLogros(gfAll,META[cUser]||0,totalMes,record);
      const grid=tmpL.querySelector('.logro-grid');
      logrosCont.innerHTML=`<div class="pf-card-hdr" style="margin-bottom:12px"><div class="pf-card-ttl"><span style="display:inline-block;width:3px;height:14px;background:var(--amber);border-radius:2px"></span>🏅 Logros</div></div>`;
      if(grid) logrosCont.appendChild(grid);
    }

    // ── Inyectar heatmap ──
    const hmCont=document.getElementById('pf-heatmap-container');
    if(hmCont) hmCont.innerHTML=renderHeatmap(gfAll);

    // ── Chart con selector de período ──
    if(window.Chart){
      // Función reutilizable — se llama al init y al cambiar período
      window._pfGfAll = gfAll;
      window._pfMetaDia = metaDia;
      window._pfRecord = record;
      window._pfPromDiario = promDiario;

      window.pfCambiarPeriodo = function(periodo){
        const hoy2=today();
        const titulos={'30d':'Últimos 30 días','90d':'Últimos 3 meses','6m':'Últimos 6 meses','1a':'Último año'};
        const dias={'30d':30,'90d':90,'6m':180,'1a':365};
        const n=dias[periodo]||30;
        const inicio=new Date(hoy2+'T12:00:00'); inicio.setDate(inicio.getDate()-(n-1));
        const desdeStr=inicio.toISOString().slice(0,10);
        const labs=[],dat=[];
        for(let i=0;i<n;i++){
          const dd=new Date(desdeStr+'T12:00:00'); dd.setDate(dd.getDate()+i);
          const f=dd.toISOString().slice(0,10);
          labs.push(f); dat.push(window._pfGfAll[f]?.total??null);
        }
        // Promedio del período
        const vals=dat.filter(v=>v!==null&&v>0);
        const promP=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):window._pfPromDiario;

        // Actualizar botones
        ['30d','90d','6m','1a'].forEach(p=>{
          const btn=document.getElementById('pfbtn-'+p);
          if(!btn) return;
          const on=p===periodo;
          btn.style.background=on?'rgba(59,143,255,.2)':'rgba(255,255,255,.05)';
          btn.style.borderColor=on?'rgba(59,143,255,.5)':'rgba(255,255,255,.08)';
          btn.style.color=on?'#3B8FFF':'var(--txt3)';
        });
        // Actualizar título y fecha inicio
        const tit=document.getElementById('pf-chart-titulo');
        if(tit) tit.textContent=titulos[periodo];
        const desde=document.getElementById('pf-chart-desde');
        if(desde) desde.textContent=desdeStr.slice(5).replace('-','/');

        // Actualizar chart
        const ch=Chart.getChart('pfChart30');
        if(!ch) return;
        ch.data.labels=labs;
        ch.data.datasets[0].data=dat;
        ch.data.datasets[0].pointRadius=dat.map(v=>v===window._pfRecord&&v!==null?6:v!==null?( n<=30?2.5:n<=90?1.5:0):0);
        ch.data.datasets[0].pointBackgroundColor=dat.map(v=>v===window._pfRecord?'#FFBA4D':v>=window._pfMetaDia?'#2ECC8A':'#3B8FFF');
        ch.data.datasets[1].data=Array(n).fill(promP);
        ch.update('active');
      };

      const existingChart=Chart.getChart('pfChart30');
      if(existingChart) existingChart.destroy();
      new Chart(document.getElementById('pfChart30'),{
        type:'line',
        data:{labels:labels30,datasets:[
          {data:data30,borderColor:'#3B8FFF',borderWidth:2.5,
           pointRadius:data30.map(v=>v===record&&v!==null?6:v!==null?2.5:0),
           pointBackgroundColor:data30.map(v=>v===record?'#FFBA4D':v>=metaDia?'#2ECC8A':'#3B8FFF'),
           tension:.35,spanGaps:true,fill:true,
           backgroundColor:(ctx)=>{const g=ctx.chart.ctx.createLinearGradient(0,0,0,130);g.addColorStop(0,'rgba(59,143,255,.25)');g.addColorStop(1,'rgba(59,143,255,0)');return g}},
          {data:Array(30).fill(promDiario),borderColor:'rgba(255,255,255,.2)',
           borderWidth:1.5,borderDash:[5,4],pointRadius:0,fill:false}
        ]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{backgroundColor:'#0A1628',borderColor:'#1E3A5F',borderWidth:1,
            titleColor:'#8AAED4',bodyColor:'#EEF4FF',padding:8,
            callbacks:{title:ctx=>fmtFecha(ctx[0].label),
              label:ctx=>ctx.datasetIndex===0?(ctx.raw!==null?`${fmtN(ctx.raw)} uds${ctx.raw===record?' 🏆':''}` :'Sin registro'):`Prom: ${fmtN(ctx.raw)}`}}},
          scales:{x:{display:false},y:{display:true,grid:{color:'rgba(255,255,255,.04)',drawBorder:false},
            ticks:{color:'#4D7AAA',font:{size:8},maxTicksLimit:4,callback:v=>fmtN(v)},border:{display:false}}}}
      });
    }
  }catch(e){
    console.error(e);
    el.innerHTML=`<div class="empty">Error cargando perfil: ${e.message}</div>`;
  }
}

function fmtMes(ms){
  if(!ms)return'—';
  const [y,m]=ms.split('-');
  const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return meses[+m-1]+' '+y;
}

function normFecha(f){
  // Normaliza cualquier formato a YYYY-MM-DD
  if(!f) return '';
  const s=f.toString().trim();
  if(s.includes('/')) return s.replace(/\//g,'-');
  if(s.length===8&&!s.includes('-')) return s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8);
  return s.slice(0,10);
}
function renderBarChart(gf, compact=false){
  const entries=Object.entries(gf).sort((a,b)=>a[0].localeCompare(b[0]));
  const maxV=Math.max(...entries.map(([,d])=>d.total))||1;
  const meses=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const bars=entries.map(([f,d])=>{
    const fn=normFecha(f);
    const parts=fn.split('-');
    const dia=parts[2]||'';
    const mes=parts[1]?meses[+parts[1]-1]:'';
    const lbl=compact?dia:(dia+'\n'+mes);
    const h=Math.max(8,Math.round(d.total/maxV*80));
    return`<div class="bar-col">
      <div class="bar-val">${d.total>=1000?(d.total/1000).toFixed(1)+'k':d.total}</div>
      <div class="bar-fill" style="height:${h}px" title="${fmtFecha(fn)}: ${fmtN(d.total)}"></div>
      <div class="bar-lbl" style="white-space:pre;line-height:1.3">${lbl}</div>
    </div>`;
  }).join('');
  return`<div class="chart-wrap"><div class="chart-bars">${bars}</div></div>`;
}

// ============================================================



// ── DASHBOARD EMBALADORA: funciones nuevas ──

function showDashTab2(tab, btn){
  ['dia','semana','mes','historial'].forEach(t=>{
    document.getElementById('dt-'+t).style.display=t===tab?'block':'none';
  });
  document.querySelectorAll('.dtab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  // Animar entrada
  setTimeout(()=>{
    const el=document.getElementById('dt-'+tab);
    if(el){ el.style.opacity='0'; el.style.transform='translateY(10px)';
      requestAnimationFrame(()=>{ el.style.transition='opacity .25s,transform .25s';
        el.style.opacity='1'; el.style.transform='translateY(0)'; }); }
  },10);
  if(tab==='semana') loadSemana();
  else if(tab==='mes') loadMes();
  else if(tab==='historial') loadHistorial();
}

// Actualizar avatar e iniciales
function actualizarHeroLogin(cod){
  const nombre=DB[cod]||'';
  const partes=nombre.trim().split(/\s+/);
  const iniciales=(partes[0]?.[0]||'')+(partes[1]?.[0]||'');
  const avatarEl=document.getElementById('dash-avatar');
  if(avatarEl) avatarEl.textContent=iniciales.toUpperCase();
}

// Calcular y mostrar logros
function calcularLogros(gfAll, meta, totalMes, record){
  const hoy=today();
  // Racha actual
  let racha=0;
  let d=new Date(hoy+'T12:00:00');
  for(let i=0;i<60;i++){
    const f=d.toISOString().slice(0,10);
    if(gfAll[f]&&gfAll[f].total>0) racha++;
    else if(racha>0) break;
    d.setDate(d.getDate()-1);
  }
  // Días sobre meta este mes
  const mesKey=hoy.slice(0,7);
  const diasSobreMeta=Object.entries(gfAll).filter(([f,d])=>f.startsWith(mesKey)&&d.total>=(meta||Infinity)).length;

  const logros=[
    {id:'racha3',icon:'🔥',nombre:'Racha 3 días',desc:'3 días seguidos activa',ok:racha>=3},
    {id:'racha5',icon:'⚡',nombre:'Racha 5 días',desc:'5 días seguidos activa',ok:racha>=5},
    {id:'meta',icon:'🎯',nombre:'Meta del día',desc:'Cumpliste tu meta hoy',ok:!!(gfAll[hoy]&&gfAll[hoy].total>=(meta||Infinity))},
    {id:'record',icon:'🏆',nombre:'Nuevo récord',desc:'Tu mejor día de siempre',ok:!!(gfAll[hoy]&&gfAll[hoy].total===record&&record>0)},
    {id:'sobre5',icon:'⭐',nombre:'5 días meta',desc:'5 días sobre meta este mes',ok:diasSobreMeta>=5},
    {id:'mil',icon:'💎',nombre:'1.000 uds/día',desc:'Superaste las 1.000 unidades',ok:record>=1000},
  ];

  // Badges en header
  const rachaBadge=document.getElementById('dash-racha-badge');
  if(rachaBadge&&racha>=3){ rachaBadge.style.display='block'; rachaBadge.textContent=`🔥 ${racha} días`; }

  return`<div class="card">
    <div class="card-title" style="margin-bottom:.85rem">🏅 Mis logros</div>
    <div class="logro-grid">
      ${logros.map(l=>`
        <div class="logro-card ${l.ok?'desbloqueado':'bloqueado'}">
          <div class="logro-icon">${l.icon}</div>
          <div class="logro-txt">
            <div class="logro-nombre">${l.nombre}</div>
            <div class="logro-desc">${l.desc}</div>
          </div>
          ${l.ok?'<div style="position:absolute;top:6px;right:8px;font-size:9px;color:#FFBA4D;font-weight:700">✓</div>':''}
        </div>`).join('')}
    </div>
  </div>`;
}

// Heatmap mensual con tooltip al tocar
function renderHeatmap(gfAll){
  const hoy=today();
  const mesKey=hoy.slice(0,7);
  const primerDia=new Date(mesKey+'-01T12:00:00');
  const diasMes=new Date(primerDia.getFullYear(),primerDia.getMonth()+1,0).getDate();
  const offsetInicio=(primerDia.getDay()+6)%7;
  const nombreMes=new Date(mesKey+'-15T12:00:00').toLocaleDateString('es-CL',{month:'long',year:'numeric'});

  // Máx del mes
  let maxVal=0;
  for(let d=1;d<=diasMes;d++){
    const f=mesKey+'-'+String(d).padStart(2,'0');
    if(gfAll[f]) maxVal=Math.max(maxVal,gfAll[f].total);
  }

  // Días activos y total del mes
  let diasActivos=0, totalMes2=0;
  for(let d=1;d<=diasMes;d++){
    const f=mesKey+'-'+String(d).padStart(2,'0');
    const v=gfAll[f]?.total||0;
    if(v>0){diasActivos++;totalMes2+=v;}
  }

  const labels=['L','M','M','J','V','S','D'];
  let cells='';
  labels.forEach(l=>{ cells+=`<div style="text-align:center;font-size:8px;font-weight:700;color:var(--txt3);padding-bottom:3px">${l}</div>`; });
  for(let i=0;i<offsetInicio;i++) cells+=`<div></div>`;

  for(let d=1;d<=diasMes;d++){
    const f=mesKey+'-'+String(d).padStart(2,'0');
    const val=gfAll[f]?.total||0;
    const alpha=maxVal>0?Math.round(val/maxVal*100):0;
    const esHoy=f===hoy;
    const esFuturo=f>hoy;
    const bg=esFuturo?'rgba(255,255,255,.03)':
             val===0?'rgba(255,255,255,.06)':
             alpha>=80?'#2ECC8A':alpha>=50?'#1A9E6A':alpha>=25?'#0F5C3D':'#07301F';
    const nombreDia=new Date(f+'T12:00:00').toLocaleDateString('es-CL',{weekday:'short',day:'numeric'});
    const tooltipTxt=esFuturo?`${nombreDia} — pendiente`:
                     val===0?`${nombreDia} — sin registro`:
                     `${nombreDia} — ${fmtN(val)} uds${val===maxVal&&val>0?' 🏆':''}`;

    cells+=`<div class="hm-cell" 
      onclick="hmTooltip(this,'${tooltipTxt}','${bg}')"
      style="background:${bg};border-radius:4px;cursor:pointer;transition:transform .15s;position:relative;${esHoy?'box-shadow:0 0 0 2px #3B8FFF;':''}"
      title="${tooltipTxt}">
      ${val===maxVal&&val>0&&!esFuturo?`<div style="position:absolute;top:1px;right:1px;width:4px;height:4px;border-radius:50%;background:#FFD700;box-shadow:0 0 4px #FFD700"></div>`:''}
    </div>`;
  }

  return`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div class="card-title">Actividad · ${nombreMes}</div>
      <div style="display:flex;align-items:center;gap:5px;font-size:9px;color:var(--txt3)">
        <div style="width:9px;height:9px;background:rgba(255,255,255,.06);border-radius:2px"></div>
        <div style="width:9px;height:9px;background:#0F5C3D;border-radius:2px"></div>
        <div style="width:9px;height:9px;background:#2ECC8A;border-radius:2px"></div>
        <span>más</span>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:10px">
      <div style="font-size:10px;color:var(--txt3)">📅 <span style="color:var(--txt2);font-weight:600">${diasActivos}</span> días activos</div>
      <div style="font-size:10px;color:var(--txt3)">📦 <span style="color:var(--txt2);font-weight:600">${fmtN(totalMes2)}</span> uds este mes</div>
      ${maxVal>0?`<div style="font-size:10px;color:var(--txt3)">🏆 <span style="color:#FFD700;font-weight:600">${fmtN(maxVal)}</span> mejor día</div>`:''}
    </div>
    <!-- Tooltip flotante -->
    <div id="hm-tooltip" style="display:none;position:fixed;bottom:5.5rem;left:50%;transform:translateX(-50%);
      background:#0A1628;border:1px solid #1E3A5F;border-radius:12px;padding:10px 18px;
      font-size:12px;font-weight:600;color:#EEF4FF;z-index:1050;white-space:nowrap;
      box-shadow:0 4px 20px rgba(0,0,0,.5);pointer-events:none;
      animation:fadeSlideUp .2s ease forwards"></div>
    <div class="heatmap-grid" style="gap:4px">${cells}</div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:9px;color:var(--txt3)">
      <span>• Toca un día para ver el detalle</span>
      <span style="color:#FFD700">● Mejor día del mes</span>
    </div>
  </div>`;
}

// ── Frases motivacionales por tramo de cumplimiento ──
const FRASES_MOT = {
  cero:  ["Hoy es un nuevo comienzo 💪","El primer paso siempre es el más importante","¡Vamos, tú puedes con esto y más!","Cada unidad cuenta, ¡a arrancar!","La jornada empieza ahora 🚀"],
  bajo:  ["¡Buen inicio! Sigue así y lo logras","Vas construyendo tu meta, paso a paso 🔧","Cada unidad que emballas es progreso real","Constancia es la clave — ¡tú la tienes!","¡Bien encaminada! El ritmo es tuyo 💙"],
  medio: ["¡Muy bien! Ya vas a mitad del camino 🎯","¡Sigue así! La meta está a la vista","Gran ritmo — ¡no pares ahora!","Más de la mitad lograda, ¡excelente!","El esfuerzo se nota — ¡a seguir! ⚡"],
  alto:  ["¡Casi llegas! Un último esfuerzo 🔥","¡Increíble ritmo! La meta te espera","Estás volando — ¡la meta es tuya!","¡Último tramo! Tú puedes con todo","¡Qué jornada! La recta final 🏁"],
  meta:  ["¡META CUMPLIDA! Eres increíble 🏆","¡Lo lograste! Jornada perfecta ⭐","¡Campeona del día! Bien hecho 🥇","¡Objetivo alcanzado! Orgullo del equipo","¡Meta superada! Eres la número uno 🎉"]
};
function getFrase(pct){
  const pool = pct>=100?FRASES_MOT.meta : pct>=75?FRASES_MOT.alto : pct>=50?FRASES_MOT.medio : pct>0?FRASES_MOT.bajo : FRASES_MOT.cero;
  return pool[Math.floor(Math.random()*pool.length)];
}

// ── Welcome card al entrar ──
async function mostrarWelcome(){
  const hoy=today();
  const heroMeta=document.getElementById('dash-hero-meta');
  if(heroMeta) heroMeta.innerHTML='<div style="font-size:11px;color:rgba(255,255,255,.3);text-align:center;padding:4px">Cargando tu resumen...</div>';

  // Cargar datos de hoy en paralelo con el caché (ya precargado al login)
  const [rowsHoy]=await Promise.all([
    fetchProd(cUser,hoy,hoy),
    getHistorialCache()
  ]);

  const g=groupByTipo(rowsHoy);
  const meta=META[cUser]||0;
  const pct=meta>0?Math.min(100,Math.round(g.total/meta*100)):0;
  const pctCol=pct>=100?'#2ECC8A':pct>=70?'#FFBA4D':'#3B8FFF';

  // Hora de última actualización
  const ahora=new Date();
  const horaStr=ahora.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
  const frase=getFrase(pct);

  // Actualizar hero con datos reales
  if(heroMeta&&meta>0){
    heroMeta.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
        <div>
          <div style="font-size:11px;color:rgba(255,255,255,.45);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Meta del día · ${fmtFecha(hoy).slice(0,5)}</div>
          <div style="font-size:34px;font-weight:900;color:${pctCol};line-height:1;letter-spacing:-.03em">${fmtN(g.total)}<span style="font-size:13px;font-weight:500;color:rgba(255,255,255,.35);margin-left:4px">/ ${fmtN(meta)} uds</span></div>
        </div>
        <div style="text-align:right">
          <div style="font-size:36px;font-weight:900;color:${pctCol};line-height:1">${pct}%</div>
          ${pct>=100?'<div style="font-size:10px;color:#2ECC8A;font-weight:700">¡Meta! 🏆</div>':''}
        </div>
      </div>
      <div style="height:12px;background:rgba(255,255,255,.07);border-radius:6px;overflow:hidden;margin-bottom:10px">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${pctCol}88,${pctCol});border-radius:6px;transition:width .8s cubic-bezier(.4,0,.2,1)"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="font-size:11px;color:${pctCol};font-weight:600;font-style:italic;flex:1;line-height:1.3">${frase}</div>
        <div style="font-size:9px;color:rgba(255,255,255,.25);white-space:nowrap;flex-shrink:0">Act. ${horaStr}</div>
      </div>`;
  }

  // Celebración si cumplió meta hoy
  if(pct>=100 && g.total>0){
    const primerNombre=(DB[cUser]||'').trim().split(/\s+/)[0];
    setTimeout(()=>lanzarCelebracion(g.total, primerNombre, pct), 600);
  }

  // Badge racha si tenemos caché
  if(_cache.gfAll){
    let racha=0;
    let dCheck=new Date(hoy+'T12:00:00');
    for(let i=0;i<60;i++){
      const f=dCheck.toISOString().slice(0,10);
      if(_cache.gfAll[f]&&_cache.gfAll[f].total>0) racha++;
      else if(racha>0) break;
      dCheck.setDate(dCheck.getDate()-1);
    }
    if(racha>=3){
      const rb=document.getElementById('dash-racha-badge');
      if(rb){rb.style.display='inline-flex';rb.textContent=`🔥 ${racha} días`;}
    }
  }
}

// ── Celebración confetti + overlay ──
function lanzarCelebracion(total, nombre, pct){
  const overlay=document.getElementById('celeb-overlay');
  if(!overlay) return;
  document.getElementById('celeb-title').textContent=`¡Meta cumplida, ${nombre}!`;
  document.getElementById('celeb-sub').textContent=`¡Excelente trabajo hoy! Alcanzaste el ${pct}% de tu meta diaria.`;
  document.getElementById('celeb-stat').textContent=fmtN(total);
  overlay.classList.add('show');
  lanzarConfetti();
  // Cerrar automáticamente después de 4s
  setTimeout(()=>cerrarCeleb(), 4000);
}

function cerrarCeleb(){
  const overlay=document.getElementById('celeb-overlay');
  if(overlay) overlay.classList.remove('show');
}

function lanzarConfetti(){
  const colores=['#2ECC8A','#3B8FFF','#FFBA4D','#FF6B6B','#9A88FF','#60B0FF','#FFD700'];
  for(let i=0;i<55;i++){
    setTimeout(()=>{
      const p=document.createElement('div');
      p.className='confetti-piece';
      const size=Math.random()*8+4;
      p.style.cssText=`
        left:${Math.random()*100}vw;
        top:-${size}px;
        width:${size}px;
        height:${size}px;
        background:${colores[Math.floor(Math.random()*colores.length)]};
        animation-duration:${Math.random()*1.5+1.2}s;
        animation-delay:${Math.random()*0.4}s;
        border-radius:${Math.random()>0.5?'50%':'2px'};
      `;
      document.body.appendChild(p);
      setTimeout(()=>p.remove(), 2500);
    }, i*35);
  }
}

// ── Tooltip heatmap ──
let _hmTimer=null;
function hmTooltip(cell, txt, bg){
  // Efecto tactil en la celda
  cell.style.transform='scale(1.35)';
  setTimeout(()=>cell.style.transform='',200);

  const tt=document.getElementById('hm-tooltip');
  if(!tt) return;
  tt.textContent=txt;
  tt.style.display='block';
  tt.style.borderColor=bg==='rgba(255,255,255,.06)'?'#1E3A5F':bg;

  clearTimeout(_hmTimer);
  _hmTimer=setTimeout(()=>{ tt.style.display='none'; }, 2200);
}

// (hero init ya manejado en doLogin principal)

function abrirModalSelectorReporte(){
  document.getElementById('modal-selector-rpt').style.display='flex';
}
function cerrarModalSelectorReporte(){
  document.getElementById('modal-selector-rpt').style.display='none';
}
document.getElementById('modal-selector-rpt').addEventListener('click',function(e){
  if(e.target===this) cerrarModalSelectorReporte();
});

// ══════════════════════════════════════════════════════════════
// VISTA GERENTE
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

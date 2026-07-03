/**
 * upload.js
 * ─────────────────────────────────────────────────────────────
 * Carga de datos desde Excel: producción diaria, entregas
 * (carga de WMS Cygnus) y plan semanal. Manejo de drag & drop,
 * validación, previsualización y confirmación de subida.
 * También incluye borrado de día/mes.
 *
 * Dependencias : config.js, supabase.js, helpers.js, ui.js
 * Exporta (global): handleDrop, handleFile, confirmUpload,
 *   borrarDia, borrarMes, calcularFechaCarga, loadCargasLog,
 *   handleEntregasDrop, handleEntregasFile, confirmEntregas,
 *   handlePlanDrop, handlePlanFile
 * ─────────────────────────────────────────────────────────────
 */

// SUPERVISOR — CARGA DE EXCEL
// ============================================================
function handleDrop(e){
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag');
  const f=e.dataTransfer.files[0];
  if(f) handleFile(f);
}

async function handleFile(file){
  if(!file) return;
  const prog=document.getElementById('upload-progress');
  const fill=document.getElementById('upload-fill');
  const lbl=document.getElementById('upload-lbl');
  const preview=document.getElementById('upload-preview');
  prog.style.display='block';
  fill.style.width='10%';
  lbl.textContent='Leyendo archivo...';

  try{
    const data=await file.arrayBuffer();
    fill.style.width='30%';
    lbl.textContent='Procesando filas...';
    const wb=XLSX.read(data,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const json=XLSX.utils.sheet_to_json(ws,{defval:''});
    fill.style.width='50%';

    // Map columns
    const rows=[];
    const errUsers=new Set();
    json.forEach(r=>{
      const usuario=(r['_Usuario']||'').toString().trim().padStart(6,'0');
      const nombre=(r['Nombre Usuario']||'').toString().trim();
      const fechaRaw=(r['FechaEmbalaje']||r['ConfFecha']||'').toString().trim();
      const desc=(r['DescripcionArticulo']||'').toString().trim();
      const cant=parseInt(r['CantidadEmbalada'])||0;
      const hora=(r['HoraEmbalaje']||r['ConfHora']||'').toString().trim().slice(0,8);
      const canal=(r['Canal']||'').toString().trim();
      const ruta=(r['Ruta']||'').toString().trim();
      const mesa=(r['MesaEmbalaje']||'').toString().trim();
      const entrega=(r['Entrega']||r['entrega']||'').toString().trim();
      const tipoRaw=(r['Tipo_Producto']||'').toString().trim();
      const clientenombre=(r['ClienteNombre']||r['clientenombre']||r['Cliente']||'').toString().trim();

      if(!usuario||!cant) return;
      // Parse fecha robusta: serial Excel, "2026/04/21", "20260421", "2026-04-21"
      const fechaOrig = r['FechaEmbalaje']||r['ConfFecha']||'';
      let fecha='';
      if(typeof fechaOrig === 'number'){
        const d=new Date(Math.round((fechaOrig-25569)*86400*1000));
        fecha=d.toISOString().slice(0,10);
      } else {
        const fs=fechaOrig.toString().trim();
        if(fs.includes('/')) fecha=fs.replace(/\//g,'-').slice(0,10);
        else if(fs.length===8&&!fs.includes('-')) fecha=fs.slice(0,4)+'-'+fs.slice(4,6)+'-'+fs.slice(6,8);
        else fecha=fs.slice(0,10);
      }
      if(!fecha.match(/^\d{4}-\d{2}-\d{2}$/)) return;
      const tipo=classifyTipo(tipoRaw,desc);
      rows.push({usuario,nombre,fecha,descripcion:desc.slice(0,80),tipo,cantidad:cant,hora,canal,ruta,mesa,entrega,clientenombre});
    });

    fill.style.width='65%';
    lbl.textContent=`Preparando ${rows.length.toLocaleString()} registros...`;

    // Summary preview
    const fechas=[...new Set(rows.map(r=>r.fecha))].sort();
    const usuarios=[...new Set(rows.map(r=>r.usuario))];
    const totalUds=rows.reduce((s,r)=>s+r.cantidad,0);
    const byTipo={maleta:0,linea:0,otro:0};
    rows.forEach(r=>byTipo[r.tipo]+=r.cantidad);

    // Guardar datos pendientes en variable global (evita JSON gigante en onclick)
    window._pendingRows = rows;
    window._pendingFechas = fechas;

    // Show preview and confirm
    preview.innerHTML=`
    <div class="card" style="background:#EAF3DE;border-color:#9FE1CB">
      <div class="card-title" style="color:var(--green-t);margin-bottom:.75rem">Vista previa del archivo</div>
      <div class="kpi-grid" style="margin-bottom:.75rem">
        <div class="kpi"><div class="lbl">Filas</div><div class="val">${rows.length.toLocaleString()}</div></div>
        <div class="kpi"><div class="lbl">Operarias</div><div class="val">${usuarios.length}</div></div>
        <div class="kpi"><div class="lbl">Uds. total</div><div class="val">${fmtN(totalUds)}</div></div>
      </div>
      <div style="font-size:12px;color:var(--txt2);margin-bottom:.75rem">
        <strong>Fechas:</strong> ${fechas.map(fmtFecha).join(', ')}<br>
        <strong>Maletas:</strong> ${fmtN(byTipo.maleta)} · <strong>Línea:</strong> ${fmtN(byTipo.linea)} · <strong>Otro:</strong> ${fmtN(byTipo.otro)}
      </div>
      <button class="btn-main" onclick="confirmUpload()">
        Confirmar y subir a Supabase
      </button>
    </div>`;
    fill.style.width='100%';
    lbl.textContent='Listo — confirma para subir';
  }catch(e){
    prog.style.display='none';
    toast('Error al leer el archivo: '+e.message,4000);
  }
}

async function confirmUpload(rows, fechasStr){
  // Si se llama sin argumentos, leer desde variables globales (modo seguro)
  if(!rows){ rows = window._pendingRows || []; }
  if(!fechasStr){ fechasStr = (window._pendingFechas || []).join(','); }
  const prog=document.getElementById('upload-progress');
  const fill=document.getElementById('upload-fill');
  const lbl=document.getElementById('upload-lbl');
  const preview=document.getElementById('upload-preview');
  prog.style.display='block';
  fill.style.width='5%';
  preview.innerHTML='';

  const fechas=fechasStr.split(',');
  try{
    // Delete existing records for these dates first (upsert by date)
    lbl.textContent='Eliminando datos existentes de estas fechas...';
    for(const f of fechas){
      await deleteFecha(f);
    }
    fill.style.width='20%';

    // Insert in batches of 500
    const BATCH=500;
    const total=rows.length;
    for(let i=0;i<total;i+=BATCH){
      const batch=rows.slice(i,i+BATCH);
      await insertBatch(batch);
      const pct=Math.round(20+(i+BATCH)/total*70);
      fill.style.width=pct+'%';
      lbl.textContent=`Subiendo... ${Math.min(i+BATCH,total).toLocaleString()} / ${total.toLocaleString()}`;
    }

    // Log the upload
    await insertCarga({
      fecha_datos:fechas[0],
      archivo:'Excel cargado manualmente',
      filas:rows.length,
      total_uds:rows.reduce((s,r)=>s+r.cantidad,0)
    });

    fill.style.width='100%';
    lbl.textContent='¡Carga exitosa!';
    toast('✓ '+rows.length.toLocaleString()+' registros subidos correctamente');
    invalidarPlanCache(); // forzar recarga del tab Plan con datos frescos
    setTimeout(()=>{prog.style.display='none';loadCargasLog()},1500);
  }catch(e){
    prog.style.display='none';
    toast('Error al subir: '+e.message,5000);
  }
}

async function loadCargasLog(){
  const el=document.getElementById('cargas-log');
  try{
    const rows=await fetchCargas();
    if(!rows||!rows.length){el.innerHTML='<div class="empty">Sin cargas registradas</div>';return}
    el.innerHTML=`<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Fecha datos</th><th>Filas</th><th>Total uds.</th><th>Subido</th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td style="font-weight:500">${fmtFecha(r.fecha_datos)}</td>
        <td>${(r.filas||0).toLocaleString('es-CL')}</td>
        <td style="font-weight:700">${fmtN(r.total_uds||0)}</td>
        <td style="font-size:11px;color:var(--txt3)">${new Date(r.cargado_at).toLocaleString('es-CL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }catch(e){el.innerHTML='<div class="empty">Error: '+e.message+'</div>'}
}



// ============================================================
// IMPORTADOR ENTREGAS DEL SISTEMA (ConsultaSQL)
// ============================================================

// Calcular fecha del día según regla lunes/resto
function calcularFechaCarga(fechaArchivo){
  // fechaArchivo: Date object con la fecha/hora del registro
  // Regla: Lunes = registros del Vie 14:30 → Lun 17:30 → fecha_carga = Lunes
  //        Resto = registros del día anterior 17:30 → mismo día 17:30 → fecha_carga = mismo día
  // SIMPLIFICADO: la fecha_carga = fecha del día laboral al que pertenece el archivo
  // Lo determinamos por la fecha del archivo subido (hoy)
  const hoy = new Date();
  const diaSemana = hoy.getDay(); // 0=Dom, 1=Lun...5=Vie
  if(diaSemana === 1){
    // Lunes: la carga corresponde al lunes
    return fechaLocalStr(hoy);
  }
  return fechaLocalStr(hoy);
  // Nota: el usuario sube el archivo el día al que corresponde
  // La fecha_carga siempre = día de subida
}

function handleEntregasDrop(e){
  e.preventDefault();
  document.getElementById('entregas-drop-zone').classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if(f) handleEntregasFile(f);
}

async function handleEntregasFile(file){
  if(!file) return;
  const preview = document.getElementById('entregas-preview');
  const prog = document.getElementById('entregas-progress');
  const lbl = document.getElementById('entregas-lbl');
  const fill = document.getElementById('entregas-fill');
  preview.innerHTML = '';
  prog.style.display = 'block';
  lbl.textContent = 'Leyendo archivo...';
  fill.style.width = '10%';

  try{
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, {defval:''});

    lbl.textContent = `Procesando ${data.length.toLocaleString('es-CL')} filas...`;
    fill.style.width = '30%';

    // Fecha de carga = hoy (día al que corresponde el archivo)
    const fechaCarga = fechaLocalStr(new Date());
    const diaSemana = new Date().getDay();
    const lblDia = diaSemana === 1
      ? 'Lunes — incluye Vie+Lun'
      : new Date().toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});

    // Procesar filas y deduplicar por Concatenado
    const seen = new Set();
    const rows = [];
    let totalUds = 0;

    data.forEach(r => {
      const concat = (r['Concatenado']||r['concatenado']||'').toString().trim();
      if(!concat || seen.has(concat)) return;
      seen.add(concat);

      const idEntrega    = (r['IDEntrega']||r['id_entrega']||'').toString().trim();
      const fechaCreada  = (r['FechaCreada']||r['fecha_creada']||'').toString().trim().slice(0,10);
      const horaCreada   = (r['HoraCreada']||r['hora_creada']||'00:00:00').toString().trim().slice(0,8);
      const material     = (r['Material']||r['material']||'').toString().trim();
      const materialDesc = (r['MaterialDescripcion']||r['material_desc']||'').toString().trim();
      const cantidad     = parseInt(r['Cantidad']||r['cantidad']||1) || 1;
      const canal        = (r['Canal']||r['canal']||'').toString().trim();
      const tipo         = (r['TipoProducto']||r['tipo_producto']||'').toString().trim();
      const clientenombre  = (r['ClienteNombre']||r['clientenombre']||r['Cliente']||'').toString().trim();
      const ruta           = (r['Ruta']||r['ruta']||'').toString().trim();

      if(!idEntrega || !fechaCreada) return;

      // Usar fecha_creada como fecha_carga para que los registros queden en su semana correcta
      // aunque el archivo se suba días después
      rows.push({id_entrega:idEntrega, fecha_creada:fechaCreada, hora_creada:horaCreada,
        material, material_desc:materialDesc, cantidad, canal, tipo_producto:tipo,
        clientenombre, ruta, concatenado:concat, fecha_carga:fechaCreada});
      totalUds += cantidad;
    });

    fill.style.width = '60%';
    lbl.textContent = `${rows.length.toLocaleString('es-CL')} registros únicos · ${totalUds.toLocaleString('es-CL')} uds`;

    // Preview antes de confirmar
    const canales = {};
    const tipos = {};
    rows.forEach(r => {
      canales[r.canal] = (canales[r.canal]||0) + r.cantidad;
      tipos[r.tipo_producto] = (tipos[r.tipo_producto]||0) + r.cantidad;
    });

    preview.innerHTML = `
      <div style="margin-top:12px;padding:12px;background:#0A1628;border:1px solid #1E3A5F;border-radius:10px">
        <div style="font-size:13px;font-weight:700;color:#E8F1FF;margin-bottom:8px">
          📋 Previsualización — ${lblDia}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="background:#060E1A;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:10px;color:#4D7AAA;margin-bottom:4px">REGISTROS ÚNICOS</div>
            <div style="font-size:20px;font-weight:900;color:#3B8FFF">${rows.length.toLocaleString('es-CL')}</div>
          </div>
          <div style="background:#060E1A;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:10px;color:#4D7AAA;margin-bottom:4px">TOTAL UNIDADES</div>
            <div style="font-size:20px;font-weight:900;color:#2ECC8A">${totalUds.toLocaleString('es-CL')}</div>
          </div>
        </div>
        <div style="font-size:11px;color:#4D7AAA;margin-bottom:6px;font-weight:600">POR CANAL</div>
        ${Object.entries(canales).sort((a,b)=>b[1]-a[1]).map(([c,u])=>
          `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #0D1F38;font-size:12px">
            <span style="color:#C8D8EC">${c||'Sin canal'}</span>
            <span style="color:#3B8FFF;font-weight:700">${u.toLocaleString('es-CL')} uds</span>
          </div>`).join('')}
        <div style="font-size:11px;color:#4D7AAA;margin:10px 0 6px;font-weight:600">POR TIPO</div>
        ${Object.entries(tipos).sort((a,b)=>b[1]-a[1]).map(([t,u])=>
          `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #0D1F38;font-size:12px">
            <span style="color:#C8D8EC">${t||'Sin tipo'}</span>
            <span style="color:#2ECC8A;font-weight:700">${u.toLocaleString('es-CL')} uds</span>
          </div>`).join('')}
        <div style="margin-top:12px;display:flex;gap:8px">
          <button onclick="confirmEntregas(window._pendingEntregas)"
            style="flex:1;padding:11px;background:#1A4A9E;color:#E8F1FF;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif">
            ✓ Subir ${rows.length.toLocaleString('es-CL')} registros
          </button>
          <button onclick="document.getElementById('entregas-preview').innerHTML='';document.getElementById('entregas-progress').style.display='none'"
            style="padding:11px 16px;background:#0A1628;color:#8AAED4;border:1px solid #1E3A5F;border-radius:8px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif">
            Cancelar
          </button>
        </div>
      </div>`;

    window._pendingEntregas = rows;
    prog.style.display = 'none';
    document.getElementById('entregas-file-input').value = '';

  }catch(e){
    console.error('handleEntregasFile:', e);
    lbl.textContent = 'Error: ' + e.message;
    fill.style.width = '100%';
    fill.style.background = '#DC2626';
  }
}

async function confirmEntregas(rows){
  if(!rows||!rows.length){toast('Sin datos para subir');return;}
  const preview = document.getElementById('entregas-preview');
  const prog = document.getElementById('entregas-progress');
  const lbl = document.getElementById('entregas-lbl');
  const fill = document.getElementById('entregas-fill');
  prog.style.display = 'block';
  fill.style.width = '5%';
  fill.style.background = '';

  const CHUNK = 500;
  let insertados = 0, duplicados = 0, errores = 0;

  for(let i = 0; i < rows.length; i += CHUNK){
    const chunk = rows.slice(i, i + CHUNK);
    const pct = Math.round((i/rows.length)*90)+5;
    fill.style.width = pct + '%';
    lbl.textContent = `Subiendo... ${i.toLocaleString('es-CL')} / ${rows.length.toLocaleString('es-CL')}`;

    try{
      const resp = await fetch(SUPA_URL+'/rest/v1/entregas_carga', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPA_KEY,
          'Authorization': 'Bearer ' + SUPA_KEY,
          'Prefer': 'resolution=ignore-duplicates,return=representation'
        },
        body: JSON.stringify(chunk)
      });
      if(resp.ok){
        const data = await resp.json();
        insertados += data.length;
        duplicados += chunk.length - data.length;
      } else {
        const err = await resp.text();
        console.error('Error chunk:', err);
        errores += chunk.length;
      }
    }catch(e){
      console.error('Error chunk:', e);
      errores += chunk.length;
    }
  }

  fill.style.width = '100%';
  lbl.textContent = `✓ ${insertados.toLocaleString('es-CL')} insertados · ${duplicados.toLocaleString('es-CL')} duplicados omitidos${errores?` · ${errores} errores`:''}`;
  preview.innerHTML = `
    <div style="margin-top:10px;padding:12px;background:#0A1F12;border:1px solid #16A34A;border-radius:8px;font-size:13px;color:#4ade80">
      ✓ Carga completada — <strong>${insertados.toLocaleString('es-CL')}</strong> registros nuevos · 
      <strong>${duplicados.toLocaleString('es-CL')}</strong> ya existían (omitidos)
    </div>`;
  toast('✓ Entregas cargadas: '+insertados.toLocaleString('es-CL')+' registros');
  window._pendingEntregas = null;
}

async function borrarDia(){
  const fecha=document.getElementById('del-dia').value;
  const rel=document.getElementById('del-dia-resultado');
  if(!fecha){toast('Selecciona un día');return;}
  const dt=new Date(fecha+'T12:00:00');
  const nom=dt.toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const nomC=nom.charAt(0).toUpperCase()+nom.slice(1);
  if(!confirm('¿Seguro que quieres borrar TODOS los registros del '+nomC+'?\nEsta acción no se puede deshacer.')) return;
  rel.style.color='var(--txt2)'; rel.textContent='Borrando...';
  try{
    await sbFetch('produccion?fecha=eq.'+fecha,{method:'DELETE',prefer:'return=minimal'});
    await sbFetch('cargas_log?fecha_datos=eq.'+fecha,{method:'DELETE',prefer:'return=minimal'});
    rel.style.color='#2ECC8A'; rel.textContent='✓ '+nomC+' eliminado';
    toast('✓ Día '+fecha+' borrado'); loadCargasLog();
  }catch(e){ rel.style.color='#FF6B6B'; rel.textContent='Error: '+e.message; }
}
async function borrarMes(){
  const ms = document.getElementById('del-mes').value;
  const res_el = document.getElementById('del-resultado');
  if(!ms){toast('Selecciona un mes');return}
  const [y,m] = ms.split('-');
  const desde = ms+'-01';
  const last = new Date(+y,+m,0).getDate();
  const hasta = ms+'-'+String(last).padStart(2,'0');
  const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const nomMes = meses[+m-1]+' '+y;
  if(!confirm(`¿Seguro que quieres borrar TODOS los registros de ${nomMes}?\nEsta acción no se puede deshacer.`)) return;
  res_el.style.color='var(--txt2)';
  res_el.textContent='Borrando...';
  try{
    // Delete produccion for date range
    await sbFetch(`produccion?fecha=gte.${desde}&fecha=lte.${hasta}`,{method:'DELETE',prefer:'return=minimal'});
    // Delete cargas_log for that month
    await sbFetch(`cargas_log?fecha_datos=gte.${desde}&fecha_datos=lte.${hasta}`,{method:'DELETE',prefer:'return=minimal'});
    res_el.style.color='var(--green-t)';
    res_el.textContent=`✓ Mes de ${nomMes} eliminado correctamente`;
    toast(`✓ ${nomMes} borrado`);
    loadCargasLog();
  }catch(e){
    res_el.style.color='var(--red)';
    res_el.textContent='Error: '+e.message;
  }
}

// ============================================================

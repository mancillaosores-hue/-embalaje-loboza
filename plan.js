/**
 * email.js
 * ─────────────────────────────────────────────────────────────
 * Módulo de reportes por email: construcción del HTML del
 * informe semanal, envío via EmailJS, modales de configuración,
 * selector de remitente y carga de datos del reporte.
 *
 * Dependencias : config.js, supabase.js, helpers.js, ui.js
 * Exporta (global): enviarReporteEmail, buildEmailHTML,
 *   buildBloqueSemanalemail, cargarDatosReporte,
 *   abrirModalReporte, cerrarModalReporte, recargarRptFecha,
 *   abrirModalSelectorReporte, cerrarModalSelectorReporte,
 *   onRemitenteChange, getRemitenteConfig, guardarKeysEmailJS,
 *   toggleKeysPanel, fetchRptDatos
 * ─────────────────────────────────────────────────────────────
 */

function onRemitenteChange(){
  const val = document.getElementById('rpt-remitente').value;
  const panel = document.getElementById('rpt-keys-panel');
  if(val === 'custom') panel.classList.add('open');
  else panel.classList.remove('open');
}

function getRemitenteConfig(){
  const val = document.getElementById('rpt-remitente')?.value || 'diego';
  if(val === 'custom'){
    return {
      serviceID:  localStorage.getItem('ejs_sid') || EJS_SERVICE_ID,
      publicKey:  localStorage.getItem('ejs_pk')  || EJS_PUBLIC_KEY,
      templateID: localStorage.getItem('ejs_tid') || EJS_TEMPLATE_ID,
      from_name:  'CD Lo Boza',
    };
  }
  return { ...REMITENTES[val], publicKey: EJS_PUBLIC_KEY, templateID: EJS_TEMPLATE_ID };
}

function guardarKeysEmailJS(){
  const pk  = document.getElementById('rpt-input-pk').value.trim();
  const sid = document.getElementById('rpt-input-sid').value.trim();
  const tid = document.getElementById('rpt-input-tid').value.trim();
  if(pk)  localStorage.setItem('ejs_pk', pk);
  if(sid) localStorage.setItem('ejs_sid', sid);
  if(tid) localStorage.setItem('ejs_tid', tid);
  toast('✓ Credenciales guardadas');
  document.getElementById('rpt-keys-panel').classList.remove('open');
}

async function enviarReporteEmail(){
  const dest = document.getElementById('rpt-email-dest').value.trim();
  const cc   = document.getElementById('rpt-email-cc').value.trim();
  if(!dest){ toast('Ingresa un correo de destino'); return; }
  if(!rptDatos){ toast('Cargando datos, espera...'); return; }

  const cfg = getRemitenteConfig();
  const btn = document.getElementById('btn-rpt-enviar');
  const sta = document.getElementById('rpt-send-status');
  btn.disabled = true;
  sta.textContent = 'Construyendo...';

  const fd    = new Date(rptDatos.hoy+'T12:00:00').toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const fdCap = fd.charAt(0).toUpperCase()+fd.slice(1);

  try{
    const htmlReporte = await buildEmailHTML(rptDatos);
    const htmlMin = htmlReporte
      .replace(/<!--[\s\S]*?-->/g,'')
      .replace(/>\s+</g,'><')
      .replace(/\s{2,}/g,' ')
      .replace(/\n\s*/g,'')
      .trim();

    console.log('HTML size:', htmlMin.length, 'chars');
    sta.textContent = 'Enviando ('+(Math.round(htmlMin.length/1024))+'KB)...';

    const resp = await fetch(SUPA_URL+'/functions/v1/send-email',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        to: dest, cc: cc||'',
        subject: 'Reporte diario de producción · '+fdCap,
        html: htmlMin,
        fecha: fdCap,
        total_uds:   rptDatos.totalHoy.toLocaleString('es-CL'),
        offline_uds: rptDatos.offline.toLocaleString('es-CL'),
        online_uds:  rptDatos.online.toLocaleString('es-CL'),
        prom_14d:    rptDatos.prom.toLocaleString('es-CL'),
        ejs_pk:  cfg.publicKey,
        ejs_sid: cfg.serviceID,
        ejs_tid: cfg.templateID,
        ejs_prv: 'F-rhxRzTE3nXy7iXcdiKb',
      })
    });
    const result = await resp.json();
    if(!resp.ok) throw new Error(JSON.stringify(result?.error||result)+' ['+resp.status+']');
    toast('✓ Reporte enviado desde '+cfg.from_name+' a '+dest);
    sta.textContent = '✓ Enviado';
    setTimeout(()=>{ sta.textContent=''; btn.disabled=false; },3000);
  }catch(err){
    console.error('enviarReporteEmail error:', err);
    const msg = err.message||'Error desconocido';
    toast('Error: '+msg.slice(0,120));
    sta.textContent = '❌ '+msg.slice(0,60);
    btn.disabled = false;
  }
}

// Claves de embaladoras (codigo → clave personal)
// 000014 Javiera Acevedo y 000196 Valeria Díaz: desvinculadas — excluidas del sistema
const USER_PASS = {
  "000022":"susan22","000030":"evita30",
  "000036":"paola36","000039":"elena39","000043":"melissa43",
  "000055":"daniela55","000190":"norma190","000191":"paola191",
  "000193":"corina193","000198":"carolina198",
  "001632":"karen1632","001771":"aida1771"
};

const DB = {
  "000022":"Susan Liz Carrizo Sandoval",
  "000030":"Evita Arévalo","000036":"Paola del Carmen Marchant Cornejo",
  "000039":"Elena del Rosario Nahuelñir González","000043":"Melissa Pino Montenegro",
  "000055":"Daniela Acevedo","000190":"Norma Troncoso","000191":"Paola Cortés",
  "000193":"Corina San Martín","000198":"Carolina Carrasco",
  "001632":"Karen Sepúlveda","001771":"Aida Torres"
};

const META = {
  "000022":1215,"000030":300,"000036":350,"000039":1215,
  "000043":1215,"000055":1215,"000190":1215,"000191":350,"000193":1215,
  "000198":1215,"001632":250,"001771":250
};

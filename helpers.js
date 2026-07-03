/**
 * auth.js
 * ─────────────────────────────────────────────────────────────
 * Autenticación: login por código+contraseña, logout,
 * toggle de visibilidad de contraseña, actualización del hero
 * de login y frases motivacionales.
 *
 * Dependencias : config.js, supabase.js, helpers.js, ui.js
 * Exporta (global): doLogin, doLogout, togglePass,
 *   actualizarHeroLogin
 * ─────────────────────────────────────────────────────────────
 */

// ============================================================
// LOGIN
// ============================================================
function doLogin(){
  const raw = document.getElementById('l-cod').value.trim();
  const pass = document.getElementById('l-pass').value;
  const err = document.getElementById('l-err');

  if(raw.toUpperCase()==='GERENTE'){
    if(pass===GER_PASS){
      cUser=null;cIsSup=false;cIsGer=true;
      setScreen('ger');
      planSemActual=isoWeekActual();
      cargarPlanSemanal();
    } else {
      err.style.display='block';err.textContent='Clave de gerente incorrecta.';
    }
    return;
  }

  if(raw.toUpperCase()==='SUPERVISOR'){
    if(pass===SUP_PASS){
      cUser=null;cIsSup=true;
      setScreen('sup');
      loadCargasLog();
    // Prefetch plan en background (sin bloquear la vista inicial)
    setTimeout(()=>{
      const semPre = isoWeekActual();
      const anioPre = new Date().getFullYear();
      if(!(_planCache.sem===semPre && _planCache.data)){
        planSemActual = semPre;
        cargarPlanSemanal();
      }
    }, 1500);
      document.getElementById('eq-fecha').value=today();
    } else {
      err.style.display='block';err.textContent='Clave de supervisor incorrecta.';
    }
    return;
  }
  const cod=raw.replace(/^0*/,'').padStart(6,'0');
  if(!DB[cod]){err.style.display='block';err.textContent='Código no encontrado.';return}
  if(USER_PASS[cod]!==pass){err.style.display='block';err.textContent='Contraseña incorrecta.';return}
  err.style.display='none';
  cUser=cod; cIsSup=false;
  // ── Precarga historial en background — listo cuando la operaria llegue al tab ──
  getHistorialCache();
  const primerNombre = DB[cod].trim().split(/\s+/)[0];
  document.getElementById('h-name').textContent='¡Hola, '+primerNombre+'! 👋';
  actualizarHeroLogin&&actualizarHeroLogin(cod);
  setScreen('dash');
  const t=today();
  document.getElementById('fil-dia').value=t;
  document.getElementById('fil-semana').value=currentWeek();
  document.getElementById('fil-mes').value=currentMonth();
  // Inicializar hero meta
  const heroMeta=document.getElementById('dash-hero-meta');
  if(heroMeta) heroMeta.innerHTML='<div style="font-size:11px;color:rgba(255,255,255,.35);text-align:center;padding:6px">Cargando datos del día...</div>';
  // Mostrar tab Hoy activo
  document.querySelectorAll('.dtab').forEach(b=>b.classList.remove('on'));
  const dtabHoy=document.getElementById('dtab-hoy');
  if(dtabHoy) dtabHoy.classList.add('on');
  ['dt-semana','dt-mes','dt-historial'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display='none';
  });
  document.getElementById('dt-dia').style.display='block';
  // Welcome + carga paralela
  mostrarWelcome();
  loadDia();
}
function doLogout(){cUser=null;cIsSup=false;cIsGer=false;invalidarCache();setScreen('login')}
function togglePass(){
  const inp=document.getElementById('l-pass');
  const icon=document.getElementById('eye-icon');
  if(inp.type==='password'){
    inp.type='text';
    icon.innerHTML='<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    inp.type='password';
    icon.innerHTML='<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}
document.getElementById('l-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});

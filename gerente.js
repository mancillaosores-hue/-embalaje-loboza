/**
 * supabase.js
 * ─────────────────────────────────────────────────────────────
 * Capa de acceso a datos: wrappers de fetch para la API REST
 * de Supabase, paginación, caché de historial, inserción y
 * borrado de registros de producción y entregas.
 *
 * Dependencias : config.js
 * Exporta (global): sbFetch, sbFetchAll, insertBatch,
 *   deleteFecha, fetchProd, fetchProdAll, fetchCargas,
 *   insertCarga, clearCaches, getHistorialCache, invalidarCache
 * ─────────────────────────────────────────────────────────────
 */

// ============================================================
// SUPABASE
// ============================================================
async function sbFetch(path, opts={}){
  const res = await fetch(SUPA_URL+'/rest/v1/'+path,{
    ...opts,
    headers:{
      'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,
      'Content-Type':'application/json',
      'Prefer':opts.prefer||'return=representation',
      'Range':'0-9999',
      ...opts.headers
    }
  });
  if(!res.ok) throw new Error(await res.text());
  const ct = res.headers.get('content-type')||'';
  return ct.includes('json') ? res.json() : null;
}

// Fetch ALL rows paginando de a 1000
async function sbFetchAll(path){
  let all=[], from=0, size=1000;
  while(true){
    const res = await fetch(SUPA_URL+'/rest/v1/'+path,{
      headers:{
        'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,
        'Content-Type':'application/json',
        'Prefer':'count=none',
        'Range':`${from}-${from+size-1}`
      }
    });
    if(!res.ok) throw new Error(await res.text());
    const batch = await res.json();
    if(!batch||!batch.length) break;
    all = all.concat(batch);
    if(batch.length < size) break;
    from += size;
  }
  return all;
}

// ── Filtrar solo usuarios registrados en DB ──────────────────
function filtrarUsuariosValidos(rows){
  return rows.filter(r => r.usuario && DB.hasOwnProperty(r.usuario));
}

// ── Normalizar solo fecha y cantidad ────────────────────────
function normalizarRow(r){
  return {
    ...r,
    cantidad: Number(r.cantidad)||0,
    fecha: (r.fecha||'').slice(0,10),
    canal: (r.canal||'Sin canal').toString().trim(),
  };
}

async function fetchProd(usuario, desde, hasta){
  const rows = await sbFetchAll(
    `produccion?usuario=eq.${usuario}&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.asc,id.asc`
  );
  return rows.map(normalizarRow);
}

// ── CACHÉ DE HISTORIAL ──
// Se carga una vez al entrar y se reutiliza en loadDia, loadSemana, loadMes, loadHistorial
const _cache = { uid: null, rows: null, gfAll: null, loading: false, promise: null };

async function getHistorialCache(){
  if(_cache.uid === cUser && _cache.rows) return _cache; // HIT
  if(_cache.loading) return _cache.promise;              // Ya cargando, esperar
  _cache.uid = cUser;
  _cache.loading = true;
  _cache.promise = (async()=>{
    const hoy = today();
    const rows = await fetchProd(cUser, '2024-01-01', hoy);
    _cache.rows = rows;
    _cache.gfAll = groupByFecha(rows);
    _cache.loading = false;
    return _cache;
  })();
  return _cache.promise;
}

function invalidarCache(){ _cache.uid = null; _cache.rows = null; _cache.gfAll = null; }

async function fetchProdAll(desde, hasta){
  const rows = await sbFetchAll(
    `produccion?fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.asc,usuario.asc,id.asc`
  );
  return filtrarUsuariosValidos(rows.map(normalizarRow));
}
async function insertBatch(rows){
  return sbFetch('produccion',{method:'POST',body:JSON.stringify(rows),prefer:'return=minimal'});
}
async function deleteFecha(fecha){
  return sbFetch(`produccion?fecha=eq.${fecha}`,{method:'DELETE',prefer:'return=minimal'});
}
async function fetchCargas(){
  return sbFetch('cargas_log?order=cargado_at.desc&limit=10');
}
async function insertCarga(row){
  return sbFetch('cargas_log',{method:'POST',body:JSON.stringify(row),prefer:'return=minimal'});
}

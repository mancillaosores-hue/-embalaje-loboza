# Productividad Embaladoras — CD Lo Boza
**Samsonite Chile · Sistema de gestión de productividad**

PWA para supervisores, embaladoras y gerentes del CD Lo Boza.  
Publicada en GitHub Pages · Backend: Supabase · Reportes: EmailJS

---

## Estructura del proyecto

```
/
├── index.html              ← HTML limpio: solo estructura y enlaces
├── manifest.json           ← Configuración PWA
├── sw.js                   ← Service Worker (cache offline)
├── icons/                  ← Íconos 192x192 y 512x512
│
├── css/
│   ├── variables.css       ← Design tokens: colores, tipografía
│   ├── animations.css      ← Keyframes y transiciones
│   ├── base.css            ← Reset, layout global, .app, .sc
│   ├── login.css           ← Pantalla de login
│   ├── components.css      ← Cards, botones, tabs, toasts, badges
│   ├── dashboard.css       ← Dashboard embaladora, heatmap, ring
│   ├── modals.css          ← Modales de reporte y arrastre
│   └── responsive.css      ← Media queries y @media print
│
└── js/
    ├── config.js           ← Constantes globales (credenciales, DB, META)
    ├── helpers.js          ← Utilidades puras (fechas, formato, agrupación)
    ├── supabase.js         ← Capa de datos (fetch, insert, delete, cache)
    ├── ui.js               ← Componentes UI (toast, nav, screen, cyber)
    ├── auth.js             ← Autenticación (login, logout, togglePass)
    ├── upload.js           ← Carga de Excel (producción, entregas, plan)
    ├── dashboard.js        ← Vista embaladora (día, semana, mes, historial)
    ├── supervisor.js       ← Vista supervisor (equipo, semana, mes)
    ├── plan.js             ← Plan semanal (backlog, arrastre, canales)
    ├── email.js            ← Reportes por email (EmailJS)
    ├── pdf.js              ← Exportación PDF (jsPDF + AutoTable)
    └── gerente.js          ← Dashboard gerencial + detalle arrastre
```

---

## Arquitectura

### Capas

```
[HTML] index.html
   ↓ carga
[CSS] variables → animations → base → login → components → dashboard → modals → responsive
   ↓ luego
[JS] config → helpers → supabase → ui → auth → upload → dashboard → supervisor → plan → email → pdf → gerente
```

### Dependencias JS (orden de carga)

| Módulo | Depende de |
|--------|-----------|
| `config.js` | ninguno |
| `helpers.js` | config |
| `supabase.js` | config |
| `ui.js` | config, helpers |
| `auth.js` | config, supabase, helpers, ui |
| `upload.js` | config, supabase, helpers, ui |
| `dashboard.js` | config, supabase, helpers, ui |
| `supervisor.js` | config, supabase, helpers, ui |
| `plan.js` | config, supabase, helpers, ui, supervisor |
| `email.js` | config, supabase, helpers, ui |
| `pdf.js` | config, helpers, supabase |
| `gerente.js` | config, supabase, helpers, ui, plan |

---

## Dependencias externas (CDN)

| Librería | Versión | Uso |
|----------|---------|-----|
| SheetJS (xlsx) | 0.18.5 | Lectura de archivos Excel |
| jsPDF | 2.5.1 | Generación de PDFs |
| jsPDF AutoTable | 3.8.2 | Tablas en PDFs |
| EmailJS Browser | 4 | Envío de reportes por correo |
| Chart.js | 4.4.1 | Gráficos de tendencia |

---

## Backend

- **Supabase** proyecto: `rftjrigcngwhzhxfnrja`
- Tablas: `produccion`, `entregas_carga`
- Edge Function: `send-email` (para bypass de límite EmailJS)

---

## Roles de acceso

| Rol | Acceso | Pantalla |
|-----|--------|---------|
| Embaladora | Código + clave personal | `sc-dash` |
| Supervisor | `supervisor2025` | `sc-sup` |
| Gerente | `gerente2025` | `sc-ger` |

---

## Cómo agregar una nueva función

1. Identifica a qué módulo JS pertenece según la tabla de arquitectura.
2. Agrega la función al archivo correspondiente.
3. Si necesita constantes nuevas, agrégalas a `config.js`.
4. Si afecta la UI, revisa `components.css` o el CSS específico de la pantalla.
5. Si usa Supabase, usa los helpers existentes: `sbFetch`, `sbFetchAll`, `insertBatch`.

---

## Cómo actualizar la versión

1. Modifica el archivo JS correspondiente.
2. Actualiza el `CACHE_NAME` en `sw.js` (ej: `v2-39`) para forzar recarga en dispositivos.
3. Sube los archivos modificados a GitHub.
4. Espera el check verde ✅ en el repo (1-2 minutos).

---

## Despliegue

**URL de producción:**  
`https://mancillaosores-hue.github.io/-embalaje-loboza/`

**Repositorio:**  
`https://github.com/mancillaosores-hue/-embalaje-loboza`

Desplegado via **GitHub Pages** desde la rama `main`, carpeta raíz.

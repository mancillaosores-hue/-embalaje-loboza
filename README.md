# Productividad Embaladoras — CD Lo Boza

PWA para gestión de productividad de embaladoras, Samsonite Chile.

## 🚀 Subir a GitHub Pages (paso a paso)

### 1. Crear el repositorio
1. Entra a https://github.com/new
2. Nombre sugerido: `productividad-embaladoras`
3. Visibilidad: **Privado** (recomendado, ya que el código tiene la URL de tu proyecto Supabase) o Público si no te importa que se vea el código fuente.
4. NO marques "Add a README" (ya tenemos uno).
5. Clic en **Create repository**.

### 2. Subir los archivos
Tienes 2 opciones:

**Opción A — Web (sin terminal, más fácil):**
1. En la página del repo recién creado, clic en **uploading an existing file**.
2. Arrastra TODOS los archivos de esta carpeta (`index.html`, `manifest.json`, `sw.js`, `icons/`, `README.md`) manteniendo la estructura de carpetas.
3. Clic en **Commit changes**.

**Opción B — Terminal (si tienes git instalado):**
```bash
cd ruta/a/esta/carpeta
git init
git add .
git commit -m "Primera versión - v2-38 PWA"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/productividad-embaladoras.git
git push -u origin main
```

### 3. Activar GitHub Pages
1. En el repo, ve a **Settings** → **Pages** (menú izquierdo).
2. En "Build and deployment" → **Source**, selecciona **Deploy from a branch**.
3. En **Branch**, elige `main` y carpeta `/ (root)`.
4. Clic en **Save**.
5. Espera 1-2 minutos. GitHub te dará la URL pública, algo como:
   `https://TU-USUARIO.github.io/productividad-embaladoras/`

### 4. Verificar el PWA
1. Abre la URL en Chrome (idealmente desde el celular o desde Chrome en PC).
2. Deberías ver el ícono de "Instalar app" en la barra de direcciones (PC) o la opción "Agregar a pantalla de inicio" (Android/iPhone).
3. Una vez instalada, la app abre en pantalla completa, sin la barra del navegador, como una app nativa.

## 📁 Estructura de archivos
```
/
├── index.html        ← La app completa (v2-38)
├── manifest.json      ← Configuración del PWA (nombre, íconos, colores)
├── sw.js              ← Service worker (permite funcionar offline / cache)
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

## 🔄 Actualizar la app en el futuro
Cada vez que tengas una nueva versión del HTML:
1. Reemplaza `index.html` en el repo (web: clic en el archivo → ícono de lápiz para editar, o sube el nuevo y borra el viejo).
2. **Importante:** sube también una nueva versión de `sw.js` cambiando el número en `CACHE_NAME` (por ejemplo, de `v2-38` a `v2-39`), o los usuarios seguirán viendo la versión vieja cacheada en su celular hasta que limpien caché.
3. Espera 1-2 minutos para que GitHub Pages despliegue el cambio.

## ⚠️ Nota de seguridad
Este HTML contiene la URL pública de tu proyecto Supabase (`rftjrigcngwhzhxfnrja`) y la lógica de login. Si el repositorio es público, cualquiera puede ver ese código fuente (aunque no las contraseñas reales si usas RLS de Supabase correctamente). Si prefieres mantenerlo privado, GitHub Pages también funciona con repos privados en planes de GitHub Pro/Team/Enterprise — en el plan gratuito personal, Pages solo publica desde repos públicos. Si necesitas que sea privado y gratis, una alternativa es Netlify o Vercel (también gratuitos y soportan repos privados).

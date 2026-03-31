# SHidalgo Kué'in — App Usuario
**Sitios Hidalgo A.C. | Nochixtlán, Oaxaca**

App web para que los clientes pidan taxi desde su celular.
Conectada en tiempo real con Firebase Realtime Database.

---

## 📁 Estructura de archivos

```
APP_USUARIO/
│
├── index.html              ← Archivo principal (abrir en navegador)
│
├── css/
│   └── styles.css          ← Todos los estilos de la app
│
├── js/
│   ├── app.js              ← Lógica principal (Firebase, solicitudes, UI)
│   ├── mapa.js             ← Módulo Leaflet (marcadores, bases, GPS)
│   └── utils.js            ← Funciones compartidas (dist, toast, historial)
│
├── config/
│   ├── firebase.js         ← Credenciales Firebase
│   └── bases.js            ← Coordenadas de las 7 bases
│
└── assets/
    ├── logo.png            ← Logo Sitios Hidalgo (agregar manualmente)
    └── logo_fallback.svg   ← Logo de respaldo si falta el PNG
```

---

## 🖼️ Logo

Copia el logo oficial como:
```
APP_USUARIO/assets/logo.png
```
Si no existe, la app mostrará automáticamente el logo SVG de respaldo (letras "SH" en azul).

---

## 🚀 Cómo usar

### Opción 1 — Netlify (recomendado para producción)
1. Arrastra la carpeta `APP_USUARIO` completa a [netlify.com/drop](https://netlify.com/drop)
2. Netlify genera un enlace como `https://xxxxxx.netlify.app`
3. Comparte ese enlace con los clientes

### Opción 2 — Abrir local (solo pruebas, no funciona con módulos ES)
> ⚠️ Los módulos ES (`type="module"`) requieren servidor HTTP.
> Usar Live Server en VS Code o similar.

### Opción 3 — Servidor local con Python
```bash
# Dentro de la carpeta APP_USUARIO:
python -m http.server 5500
# Abrir: http://localhost:5500
```

---

## 🔧 Configuración

### Cambiar credenciales Firebase
Edita `config/firebase.js`:
```js
export const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY",
  databaseURL: "TU_DATABASE_URL",
  // ...
};
```

### Cambiar o agregar bases
Edita `config/bases.js`:
```js
export const BASES = [
  { id: "B1", nombre: "Base Central", lat: 17.4572, lng: -97.2311, radio: 150 },
  // Agregar más aquí...
];
```

### Cambiar radio "cerca de ti"
En `config/bases.js`:
```js
export const RADIO_CERCA = 500; // metros
```

---

## ✅ Funcionalidades

| Función | Estado |
|---------|--------|
| Mapa en tiempo real con taxis | ✅ |
| GPS del usuario en mapa | ✅ |
| Contadores: Libres / Ocupados / Cerca | ✅ |
| Solicitar taxi (taxi más cercano) | ✅ |
| Cancelar solicitud | ✅ |
| Historial de viajes (persiste) | ✅ |
| Calificación del conductor | ✅ |
| 7 bases visibles en mapa | ✅ |
| Navegación entre bases (chips) | ✅ |
| Indicador GPS activo/inactivo | ✅ |
| Logo con fallback automático | ✅ |
| Protección XSS en historial | ✅ |

---

## 📱 Compatibilidad

- Chrome / Edge / Safari (móvil y escritorio)
- Requiere conexión a internet (Firebase + OSM tiles)
- Funciona como PWA (puede agregarse a pantalla de inicio)

---

## 🔑 Firebase — Rutas usadas

| Ruta | Uso |
|------|-----|
| `/unidades` | Lectura en tiempo real de taxis |
| `/solicitudes_clientes` | Escritura al pedir taxi |
| `/unidades/{id}/viaje` | Escritura del viaje activo |
| `/calificaciones` | Escritura de ratings |

---

*Versión 3 — Producción | Sitios Hidalgo A.C.*

// ══════════════════════════════════════════════════════
//  SITIOS HIDALGO GPS — Módulo Mapa (Leaflet)
// ══════════════════════════════════════════════════════

import { BASES, CENTRO } from "../config/bases.js";

let map    = null;
let myMark = null;
let mks    = {};        // marcadores de unidades  { id: L.Marker }

/* ─── INICIALIZAR MAPA ────────────────────────────── */
export function initMap() {
  map = L.map("map", { zoomControl: false, attributionControl: false })
          .setView([CENTRO.lat, CENTRO.lng], CENTRO.zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);

  _dibujarBases();

  // Fix dimensiones tras mostrar header y nav
  setTimeout(() => map.invalidateSize(), 100);
  setTimeout(() => map.invalidateSize(), 400);

  return map;
}

/* ─── DIBUJAR CÍRCULOS Y ETIQUETAS DE BASES ──────── */
function _dibujarBases() {
  BASES.forEach(b => {
    L.circle([b.lat, b.lng], {
      radius:      b.radio,
      color:       "#1a56db",
      fillColor:   "#1a56db",
      fillOpacity: 0.06,
      weight:      1.5,
      dashArray:   "4"
    }).addTo(map);

    L.marker([b.lat, b.lng], {
      icon: L.divIcon({
        html: `<div style="background:#1a56db;color:#fff;padding:2px 8px;border-radius:20px;
               font-size:9px;font-weight:700;white-space:nowrap;
               box-shadow:0 2px 8px rgba(0,0,0,0.2)">${b.nombre}</div>`,
        className:  "",
        iconAnchor: [0, 0]
      })
    }).addTo(map);
  });
}

/* ─── ACTUALIZAR POSICIÓN DEL USUARIO ────────────── */
export function actualizarMiPosicion(lat, lng) {
  if (!map) return;

  if (!myMark) {
    myMark = L.marker([lat, lng], {
      icon: L.divIcon({
        html: `<div style="width:14px;height:14px;background:#1a56db;border-radius:50%;
               border:3px solid #fff;box-shadow:0 0 0 4px rgba(26,86,219,0.25)"></div>`,
        className:  "",
        iconSize:   [14, 14],
        iconAnchor: [7, 7]
      })
    }).addTo(map);
    map.setView([lat, lng], 16);
  } else {
    myMark.setLatLng([lat, lng]);
  }
}

/* ─── ACTUALIZAR MARCADORES DE UNIDADES ──────────── */
export function actualizarMarcadores(unidades) {
  if (!map) return;

  console.log("🗺️  Actualizando marcadores en mapa. Total unidades:", Object.keys(unidades).length);

  // Eliminar marcadores de unidades que ya no existen en Firebase
  Object.keys(mks).forEach(id => {
    if (!unidades[id]) {
      map.removeLayer(mks[id]);
      delete mks[id];
      console.log("  ❌ Marcador removido:", id);
    }
  });

  // Crear o actualizar marcadores
  Object.entries(unidades).forEach(([id, u]) => {
    // Validar coordenadas
    if (!u.lat || !u.lng || typeof u.lat !== 'number' || typeof u.lng !== 'number') {
      console.log("  ⚠️  Unidad", id, "sin coordenadas válidas");
      return;
    }

    // Normalizar status
    const st = String(u.status || "").toUpperCase();
    const libre = st === "LIBRE" && u.online !== false;
    const sz    = libre ? 28 : 20;
    const color = libre ? "#16a34a" : "#9ca3af";
    const op    = u.online !== false ? 1 : 0.4;

    if (libre) {
      console.log(`  ✅ Unidad ${id} LIBRE en mapa - Lat: ${u.lat}, Lng: ${u.lng}`);
    }

    const ic = L.divIcon({
      html: `<div style="background:${color};width:${sz}px;height:${sz}px;
             border-radius:50%;display:flex;align-items:center;justify-content:center;
             font-size:${libre?13:10}px;border:2px solid #fff;
             box-shadow:0 2px 8px rgba(0,0,0,0.18);opacity:${op}">🚖</div>`,
      className:  "",
      iconSize:   [sz, sz],
      iconAnchor: [sz/2, sz/2]
    });

    if (mks[id]) {
      mks[id].setLatLng([u.lat, u.lng]).setIcon(ic);
    } else {
      mks[id] = L.marker([u.lat, u.lng], { icon: ic })
        .addTo(map)
        .bindPopup(`<b>${id}</b><br>${u.conductor || ""}<br><b>${st}</b>`);
    }
  });
}

/* ─── CENTRAR EN BASE ────────────────────────────── */
export function centrarEnBase(baseId) {
  if (!baseId || !BASES) return;
  const b = BASES.find(x => x.id === baseId);
  if (b && map && typeof b.lat === 'number' && typeof b.lng === 'number') {
    map.setView([b.lat, b.lng], 17);
    console.log(`📍 Mapa centrado en base ${baseId}`);
  } else {
    console.warn(`⚠️ Base ${baseId} no encontrada o coordenadas inválidas`);
  }
}

/* ─── INVALIDAR TAMAÑO (al volver al mapa) ───────── */
export function refrescarMapa() {
  if (map) requestAnimationFrame(() => map.invalidateSize());
}

/* ─── GETTER ─────────────────────────────────────── */
export function getMap() { return map; }

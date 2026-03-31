// ══════════════════════════════════════════════════════
//  SITIOS HIDALGO GPS — Utilidades
// ══════════════════════════════════════════════════════

/**
 * Distancia Haversine entre dos coordenadas (metros)
 */
export function dist(lat1, lng1, lat2, lng2) {
  const R  = 6371000;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dG = (lng2 - lng1) * Math.PI / 180;
  const x  = Math.sin(dL/2)**2 +
              Math.cos(lat1 * Math.PI/180) *
              Math.cos(lat2 * Math.PI/180) *
              Math.sin(dG/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

/**
 * Escapar HTML para prevenir XSS
 */
export function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Formatear timestamp a fecha legible
 */
export function formatFecha(ts) {
  return new Date(ts).toLocaleString("es", {
    day:    "numeric",
    month:  "short",
    hour:   "2-digit",
    minute: "2-digit"
  });
}

/**
 * Toast singleton (evita superposición)
 */
let _toastTimer = null;
export function showToast(msg, duracion = 3000) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), duracion);
}

/**
 * Historial persistente en localStorage
 */
export function cargarHistorial() {
  try { return JSON.parse(localStorage.getItem("sh_historial") || "[]"); }
  catch { return []; }
}
export function guardarHistorial(arr) {
  try { localStorage.setItem("sh_historial", JSON.stringify(arr)); }
  catch (e) { console.warn("No se pudo guardar historial:", e); }
}

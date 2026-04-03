// ══════════════════════════════════════════════════════
//  SITIOS HIDALGO GPS — Compartir Viaje en Tiempo Real
//  App Usuario (SHidalgo Kué'in)
// ══════════════════════════════════════════════════════

import { ref, push, set, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let viajeCompartidoId = null;
let viajeCompartidoRef = null;
let updateInterval = null;

const TRACKING_DOMAIN = "https://sitios-hidalgo-track.web.app"; // Cambiar por tu dominio
const TRACKING_TIMEOUT = 3600000; // 1 hora en ms

/* ─── INICIAR VIAJE COMPARTIDO ────────────────────– */
export function iniciarCompartirViaje() {
  if (viajeCompartidoId) {
    console.warn("⚠️ Viaje ya está siendo compartido");
    return viajeCompartidoId;
  }

  if (!window.activeViaje) {
    alert("❌ No hay viaje activo");
    return null;
  }

  console.log("📤 Iniciando viaje compartido...");

  try {
    const sharePayload = {
      usuario: window.myName,
      telefono: window.myPhone,
      nroUnidad: window.activeViaje.unitId,
      destino: window.activeViaje.destino,
      conductor: window.activeViaje.conductor,
      latInicial: window.myLat,
      lngInicial: window.myLng,
      ts: Date.now(),
      activo: true
    };

    viajeCompartidoRef = ref(window.db, "viajes_compartidos");
    const result = push(viajeCompartidoRef, sharePayload);
    viajeCompartidoId = result.key;

    console.log("✅ Viaje compartido con ID:", viajeCompartidoId);

    // Iniciar actualización de ubicación
    actualizarUbicacionCompartida();

    return viajeCompartidoId;

  } catch (err) {
    console.error("❌ Error al compartir viaje:", err);
    return null;
  }
}

/* ─── ACTUALIZAR UBICACIÓN EN TIEMPO REAL ────────– */
function actualizarUbicacionCompartida() {
  if (!viajeCompartidoId || !viajeCompartidoRef) return;

  // Actualizar cada 5 segundos
  updateInterval = setInterval(() => {
    if (!viajeCompartidoId) {
      clearInterval(updateInterval);
      return;
    }

    try {
      set(ref(window.db, `viajes_compartidos/${viajeCompartidoId}/ubicacionActual`), {
        lat: window.myLat,
        lng: window.myLng,
        ts: Date.now()
      });
    } catch (err) {
      console.error("Error actualizando ubicación compartida:", err);
    }
  }, 5000);
}

/* ─── GENERAR ENLACE COMPARTIBLE ─────────────────– */
export function generarEnlaceCompartido() {
  if (!viajeCompartidoId) {
    console.warn("⚠️ Viaje no está siendo compartido");
    return null;
  }

  return `${TRACKING_DOMAIN}/track?id=${viajeCompartidoId}`;
}

/* ─── COMPARTIR POR WHATSAPP ─────────────────────– */
export function compartirPorWhatsApp() {
  const enlace = generarEnlaceCompartido();
  if (!enlace) {
    alert("❌ Error generando enlace de compartir");
    return;
  }

  const mensaje = `Hola, te comparto mi ubicación de taxi en tiempo real: ${enlace}`;
  const urlWhatsApp = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

  // Intentar abrir WhatsApp
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    window.location.href = urlWhatsApp;
  } else {
    window.open(urlWhatsApp, "_blank");
  }
}

/* ─── COMPARTIR USANDO WEB SHARE API ─────────────– */
export async function compartirViaje() {
  const enlace = generarEnlaceCompartido();
  if (!enlace) {
    alert("❌ Error generando enlace de compartir");
    return;
  }

  const titulo = "Mi Viaje en Taxi";
  const texto = `Hola, te comparto mi ubicación de taxi en tiempo real: ${enlace}`;

  // Intentar usar Web Share API
  if (navigator.share) {
    try {
      await navigator.share({
        title: titulo,
        text: texto,
        url: enlace
      });
      console.log("✅ Comparti exitosamente");
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error al compartir:", err);
        mostrarOpcionesCompartir(enlace, texto);
      }
    }
  } else {
    // Fallback: mostrar opciones manuales
    mostrarOpcionesCompartir(enlace, texto);
  }
}

/* ─── UI: OPCIONES DE COMPARTIR ──────────────────– */
function mostrarOpcionesCompartir(enlace, texto) {
  const modal = document.getElementById("modal-share") || crearModalCompartir();

  document.getElementById("share-link").value = enlace;
  document.getElementById("share-msg").textContent = texto;

  // Botones de compartir
  document.getElementById("btn-whatsapp-direct").onclick = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  document.getElementById("btn-copy-link").onclick = () => {
    copiarAlPortapapeles(enlace);
  };

  document.getElementById("btn-copy-msg").onclick = () => {
    copiarAlPortapapeles(texto);
  };

  modal.classList.add("show");
}

/* ─── CREAR MODAL DE COMPARTIR ───────────────────– */
function crearModalCompartir() {
  const modal = document.createElement("div");
  modal.id = "modal-share";
  modal.className = "modal-share-bg";
  modal.innerHTML = `
    <div class="modal-share-box">
      <div class="modal-handle"></div>
      <div class="modal-title">📤 Compartir Viaje</div>
      
      <div class="share-section">
        <div class="share-label">Mensaje:</div>
        <div id="share-msg" class="share-message-preview"></div>
      </div>

      <div class="share-section">
        <div class="share-label">Enlace:</div>
        <div class="share-input-group">
          <input id="share-link" type="text" class="share-input" readonly>
          <button id="btn-copy-link" class="btn-copy">📋 Copiar enlace</button>
        </div>
      </div>

      <div class="share-divider">O compartir por:</div>

      <button id="btn-whatsapp-direct" class="btn-share-whatsapp">
        💬 WhatsApp
      </button>

      <button id="btn-copy-msg" class="btn-share-copy">
        📋 Copiar mensaje completo
      </button>

      <div style="text-align:center;margin-top:16px">
        <span class="share-close" onclick="document.getElementById('modal-share')?.classList.remove('show')">
          Cerrar
        </span>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

/* ─── COPIAR AL PORTAPAPELES ─────────────────────– */
function copiarAlPortapapeles(texto) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(texto).then(() => {
      mostrarToastCompartir("✅ Copiado al portapapeles");
    }).catch(() => {
      mostrarToastCompartir("❌ Error copiando");
    });
  } else {
    // Fallback para navegadores antiguos
    const textarea = document.createElement("textarea");
    textarea.value = texto;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    mostrarToastCompartir("✅ Copiado al portapapeles");
  }
}

/* ─── DETENER COMPARTIR VIAJE ────────────────────– */
export function detenerCompartirViaje() {
  if (!viajeCompartidoId) return;

  console.log("⛔ Deteniendo viaje compartido:", viajeCompartidoId);

  try {
    // Marcar como inactivo
    set(ref(window.db, `viajes_compartidos/${viajeCompartidoId}/activo`), false);

    // Detener actualizaciones
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }

    if (viajeCompartidoRef) off(viajeCompartidoRef);
    
    viajeCompartidoId = null;
    viajeCompartidoRef = null;

    console.log("✅ Viaje compartido detenido");

  } catch (err) {
    console.error("Error deteniendo compartir:", err);
  }
}

/* ─── TOAST DE NOTIFICACIÓN ──────────────────────– */
function mostrarToastCompartir(mensaje) {
  let toast = document.getElementById("toast-share");
  
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-share";
    toast.className = "toast-share";
    document.body.appendChild(toast);
  }

  toast.textContent = mensaje;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

/* ─── EXPORTAR FUNCIONES GLOBALES ────────────────– */
window.iniciarCompartirViaje = iniciarCompartirViaje;
window.generarEnlaceCompartido = generarEnlaceCompartido;
window.compartirPorWhatsApp = compartirPorWhatsApp;
window.compartirViaje = compartirViaje;
window.detenerCompartirViaje = detenerCompartirViaje;

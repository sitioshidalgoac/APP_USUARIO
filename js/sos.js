// ══════════════════════════════════════════════════════
//  SITIOS HIDALGO GPS — Sistema de SOS
//  App Usuario (SHidalgo Kué'in)
// ══════════════════════════════════════════════════════

import { ref, push, set, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let sosActivo = false;
let sosRef = null;
let sosId = null;

/* ─── INICIAR SOS ────────────────────────────────── */
export function activarSOS() {
  if (sosActivo) {
    console.warn("⚠️ SOS ya está activo");
    return;
  }

  // Validar GPS activo
  if (!window.myLat || !window.myLng || !window.gpsOk) {
    alert("❌ GPS no disponible. Active GPS primero.");
    return;
  }

  sosActivo = true;
  console.log("🚨 SOS ACTIVADO");
  console.log("📍 Ubicación:", window.myLat, window.myLng);
  console.log("👤 Usuario:", window.myName);
  console.log("📱 Teléfono:", window.myPhone);

  // Determinar número de unidad (si está en un viaje)
  const nroUnidad = window.activeViaje?.unitId || "USUARIO_" + Date.now();

  // Crear alerta SOS en Firebase
  try {
    const sosPayload = {
      tipo: "SOS",
      usuario: window.myName,
      telefono: window.myPhone,
      lat: window.myLat,
      lng: window.myLng,
      nroUnidad: nroUnidad,
      ts: Date.now(),
      estado: "ACTIVO"
    };

    sosRef = ref(window.db, "alertas_sos");
    const result = push(sosRef, sosPayload);
    sosId = result.key;

    console.log("✅ SOS guardado en BD con ID:", sosId);

    // UI Feedback
    mostrarSOSActivo();
    reproducirSonidoSOS();

  } catch (err) {
    console.error("❌ Error al enviar SOS:", err);
    sosActivo = false;
    alert("Error al enviar SOS. Intenta de nuevo.");
  }
}

/* ─── DESACTIVAR SOS ────────────────────────────── */
export function desactivarSOS() {
  if (!sosActivo || !sosId) return;

  console.log("🛑 SOS DESACTIVADO");
  sosActivo = false;

  try {
    // Marcar como atendido en Firebase
    set(ref(window.db, `alertas_sos/${sosId}/estado`), "ATENDIDO");

    // Limpiar referencia
    if (sosRef) off(sosRef);
    sosRef = null;
    sosId = null;

  } catch (err) {
    console.error("❌ Error al desactivar SOS:", err);
  }

  ocultarSOSActivo();
  detenerSonidoSOS();
}

/* ─── UI: MOSTRAR SOS ACTIVO ─────────────────────── */
function mostrarSOSActivo() {
  let sosDiv = document.getElementById("sos-active");
  
  if (!sosDiv) {
    sosDiv = document.createElement("div");
    sosDiv.id = "sos-active";
    sosDiv.className = "sos-active-banner";
    sosDiv.innerHTML = `
      <div class="sos-content">
        <span class="sos-icon">🚨</span>
        <div class="sos-text">
          <div class="sos-title">¡SOS ACTIVO!</div>
          <div class="sos-subtitle">Tu ubicación se envía a la base</div>
        </div>
        <button class="sos-btn-deactivate" onclick="window.desactivarSOS?.()">ATENDIDO</button>
      </div>
    `;
    document.body.appendChild(sosDiv);
  }

  sosDiv.classList.add("show");
}

/* ─── UI: OCULTAR SOS ────────────────────────────– */
function ocultarSOSActivo() {
  const sosDiv = document.getElementById("sos-active");
  if (sosDiv) sosDiv.classList.remove("show");
}

/* ─── SONIDO SOS ─────────────────────────────────– */
let sosAudio = null;

function reproducirSonidoSOS() {
  // Usar Web Audio API para crear sonido de alarma
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    function playAlarmBeep() {
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.value = 800;
      osc.type = "sine";
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      
      osc.start(now);
      osc.stop(now + 0.3);
    }

    // Bip cada 500ms mientras SOS esté activo
    sosAudio = setInterval(() => {
      if (sosActivo) playAlarmBeep();
      else clearInterval(sosAudio);
    }, 500);

  } catch (err) {
    console.warn("⚠️ No se puede reproducir audio de SOS:", err);
  }
}

function detenerSonidoSOS() {
  if (sosAudio) {
    clearInterval(sosAudio);
    sosAudio = null;
  }
}

/* ─── EXPORTAR FUNCIONES GLOBALES ────────────────– */
window.activarSOS = activarSOS;
window.desactivarSOS = desactivarSOS;

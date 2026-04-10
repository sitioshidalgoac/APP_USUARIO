// ══════════════════════════════════════════════════════
//  SITIOS HIDALGO GPS — App Principal
//  App Usuario (SHidalgo Kué'in)
// ══════════════════════════════════════════════════════

import { initializeApp }                         from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, off, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import { FIREBASE_CONFIG }                          from "../config/firebase.js";
import { BASES, RADIO_CERCA }                       from "../config/bases.js";
import { dist, escHtml, formatFecha, showToast,
         cargarHistorial, guardarHistorial }         from "./utils.js";
import { initMap, actualizarMiPosicion,
         actualizarMarcadores, centrarEnBase,
         refrescarMapa }                            from "./mapa.js";
import { activarSOS, desactivarSOS }                from "./sos.js";
import { iniciarCompartirViaje, compartirViaje,
         compartirPorWhatsApp, detenerCompartirViaje,
         copiarAlPortapapeles }                      from "./share.js";
import { mostrarModalCalificacion, enviarCalificacion,
         inicializarCalificacion, obtenerPerfilConductor,
         escucharPerfilConductor }                   from "./rating.js";
import { initializeMessaging, requestNotificationPermission,
         startProximityMonitoring, stopProximityMonitoring,
         setupServiceWorkerMessageListener }         from "./notifications.js";

/* ─── FIREBASE ───────────────────────────────────── */
const fapp = initializeApp(FIREBASE_CONFIG);
const db   = getDatabase(fapp);

/* ─── ESTADO GLOBAL ──────────────────────────────── */
let myName  = "Usuario";
let myPhone = "";
let myLat   = 17.4572;
let myLng   = -97.2311;
let gpsOk   = false;
let watchId = null;

let unidades    = {};       // snapshot de todas las unidades
let activeViaje = null;     // viaje activo
let rateData    = null;     // datos para calificación
let star        = 5;        // estrellas seleccionadas
let fbRef       = null;     // referencia Firebase activa

let historial = cargarHistorial();

/* ─── EXPONER VARIABLES GLOBALES A WINDOW ────────– */
window.fapp = fapp;
window.db = db;

Object.defineProperties(window, {
  'myName':    { get: () => myName,    set: (v) => myName = v },
  'myPhone':   { get: () => myPhone,   set: (v) => myPhone = v },
  'myLat':     { get: () => myLat,     set: (v) => myLat = v },
  'myLng':     { get: () => myLng,     set: (v) => myLng = v },
  'gpsOk':     { get: () => gpsOk,     set: (v) => gpsOk = v },
  'activeViaje': { get: () => activeViaje, set: (v) => activeViaje = v },
  'showToast': { get: () => showToast }
});

/* ══════════════════════════════════════════════════
   SPLASH → LOGIN
   ══════════════════════════════════════════════════ */
setTimeout(() => {
  const splash = document.getElementById("splash");
  splash.classList.add("hide");
  splash.addEventListener("transitionend", () => splash.remove(), { once: true });
  setTimeout(() => document.getElementById("login-screen").classList.add("show"), 500);
}, 2300);

/* ══════════════════════════════════════════════════
   LOGIN
   ══════════════════════════════════════════════════ */
window.doLogin = function(skip = false) {
  myName  = skip ? "Usuario"
                 : (document.getElementById("login-name").value.trim()  || "Usuario");
  myPhone = skip ? ""
                 : (document.getElementById("login-phone").value.trim() || "");

  document.getElementById("login-screen").classList.remove("show");
  document.getElementById("app-header").style.display = "flex";
  document.getElementById("bottom-nav").style.display  = "flex";
  document.getElementById("hdr-user").textContent      = myName;

  initMap();
  _initFirebase();
  _startGPS();
  _renderBases();
  _renderHist();
  inicializarCalificacion();
  
  // Inicializar notificaciones push
  initializeMessaging(fapp);
  requestNotificationPermission(db, myPhone || myName);
  setupServiceWorkerMessageListener();
};

/* ══════════════════════════════════════════════════
   GPS
   ══════════════════════════════════════════════════ */
function _startGPS() {
  if (!navigator.geolocation) {
    _setGPSBadge(false, "GPS no disponible");
    return;
  }

  const ERRORES = { 1: "Sin permiso GPS", 2: "GPS no disponible", 3: "GPS: tiempo agotado" };

  watchId = navigator.geolocation.watchPosition(
    pos => {
      myLat = pos.coords.latitude;
      myLng = pos.coords.longitude;

      if (!gpsOk) {
        gpsOk = true;
        _setGPSBadge(true, "GPS activo");
      }
      actualizarMiPosicion(myLat, myLng);
      _updCerca();
    },
    err => _setGPSBadge(false, ERRORES[err.code] || "GPS: error"),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

function _setGPSBadge(ok, texto) {
  document.getElementById("gps-dot").classList.toggle("ok", ok);
  document.getElementById("gps-txt").textContent = texto;
}

/* ══════════════════════════════════════════════════
   FIREBASE — LISTENER UNIDADES
   ══════════════════════════════════════════════════ */
function _initFirebase() {
  if (fbRef) off(fbRef);   // limpiar listener anterior
  fbRef = ref(db, "unidades");

  onValue(fbRef, snap => {
    const d = snap.val() || {};
    unidades = {};
    Object.entries(d).forEach(([id, u]) => { unidades[id] = { ...u, id }; });

    console.log("🚖 Conductores recibidos desde Firebase:", unidades);
    console.log("🔍 Total de unidades:", Object.keys(unidades).length);
    
    const lib = Object.values(unidades).filter(u => {
      const st = String(u.status || "").toUpperCase();
      return st === "LIBRE" && u.online !== false;
    });
    const ocp = Object.values(unidades).filter(u => {
      const st = String(u.status || "").toUpperCase();
      return st === "OCUPADO";
    });
    
    console.log("✅ Taxis LIBRES:", lib.length, lib);
    console.log("🔴 Taxis OCUPADOS:", ocp.length);

    document.getElementById("cnt-libres").textContent   = lib.length;
    document.getElementById("cnt-ocupados").textContent = ocp.length;
    document.getElementById("btn-solicitar").disabled   = lib.length === 0;

    _updCerca();
    actualizarMarcadores(unidades);
  });
}

/* ─── Taxis cerca ────────────────────────────────── */
function _updCerca() {
  const c = Object.values(unidades)
    .filter(u => {
      const st = String(u.status || "").toUpperCase();
      return st === "LIBRE" && u.lat && u.lng &&
                 dist(myLat, myLng, u.lat, u.lng) < RADIO_CERCA;
    })
    .length;
  console.log("📍 Taxis cercanos (radio " + RADIO_CERCA + "m):", c);
  document.getElementById("cnt-cerca").textContent = c;
}

/* ══════════════════════════════════════════════════
   BASES — CHIPS
   ══════════════════════════════════════════════════ */
function _renderBases() {
  document.getElementById("bases-row").innerHTML =
    BASES.map(b =>
      `<div class="base-chip" onclick="selBase('${b.id}',this)">${b.nombre}</div>`
    ).join("");
}

window.selBase = function(id, el) {
  document.querySelectorAll(".base-chip").forEach(c => c.classList.remove("sel"));
  el.classList.add("sel");
  centrarEnBase(id);
};

/* ══════════════════════════════════════════════════
   MODAL SOLICITAR
   ══════════════════════════════════════════════════ */
window.abrirSolicitud = function() {
  document.getElementById("sol-destino").value = "";
  document.getElementById("sol-ref").value     = "";
  document.getElementById("modal-sol").classList.add("open");
  document.getElementById("sol-destino").focus();
};

window.cerrarModal = function() {
  document.getElementById("modal-sol").classList.remove("open");
};

/* ══════════════════════════════════════════════════
   SOLICITAR TAXI
   ══════════════════════════════════════════════════ */
window.solicitarTaxi = function() {
  const dest   = document.getElementById("sol-destino").value.trim();
  const refTxt = document.getElementById("sol-ref").value.trim();

  if (!dest) { showToast("📍 Escribe tu destino"); return; }

  const libres = Object.values(unidades)
    .filter(u => {
      const st = String(u.status || "").toUpperCase();
      return st === "LIBRE" && u.online !== false && u.lat && u.lng;
    });
  console.log("🔎 Buscando taxis LIBRES...");
  console.log("   Criterios: status='LIBRE', online=true, lat y lng válidos");
  console.log("   Taxis LIBRES encontrados:", libres.length);
  console.log("   Detalles:", libres);

  if (!libres.length) { 
    console.warn("⚠️ No hay taxis disponibles - mostrando mensaje al usuario");
    showToast("😔 No hay taxis disponibles ahora"); 
    return;
  }

  // Taxi más cercano al usuario
  const cerca = libres.reduce((mejor, u) =>
    dist(myLat, myLng, u.lat, u.lng) < dist(myLat, myLng, mejor.lat, mejor.lng) ? u : mejor
  );

  const destFull = dest + (refTxt ? ` (${refTxt})` : "");

  try {
    push(ref(db, "solicitudes_clientes"), {
      cliente:    myName,
      telefono:   myPhone,
      destino:    dest,
      referencia: refTxt,
      unitId:     cerca.id,
      lat:        myLat,
      lng:        myLng,
      ts:         serverTimestamp(),
      estado:     "ENVIADA"
    });
    set(ref(db, `unidades/${cerca.id}/viaje`), {
      destino:  destFull,
      cliente:  myName,
      telefono: myPhone,
      estado:   "PENDIENTE",
      ts:       serverTimestamp()
    });
  } catch {
    showToast("⚠️ Error de conexión. Intenta de nuevo."); return;
  }

  activeViaje = { unitId: cerca.id, destino: dest, conductor: cerca.conductor };
  historial.push({ destino: dest, conductor: cerca.conductor, unitId: cerca.id, ts: Date.now() });
  guardarHistorial(historial);

  cerrarModal();
  
  // Iniciar compartir viaje
  try {
    iniciarCompartirViaje();
  } catch (e) {
    console.warn("⚠️ Error al iniciar compartir viaje:", e);
  }
  
  // Mostrar información del viaje en el banner
  const viajeInf = document.getElementById("viaje-banner");
  if (viajeInf) {
    viajeInf.innerHTML = `🚖 <strong>${cerca.id}</strong> - ${cerca.conductor || "Conductor"} hacia <strong>${dest}</strong>`;
    viajeInf.classList.add("show");
  }

  const metros = Math.round(dist(myLat, myLng, cerca.lat, cerca.lng));
  showToast(`✅ Taxi ${cerca.id} asignado — ${metros}m aprox.`);
  
  // 🔔 Iniciar monitoreo de proximidad para notificaciones
  _setupProximityNotifications(cerca.id);

  // Rating automático después de 30 segundos (ID guardado para poder cancelar)
  if (ratingTimeoutId) clearTimeout(ratingTimeoutId);
  ratingTimeoutId = setTimeout(() => { if (activeViaje) _mostrarRating(); }, 30000);
};

/* ══════════════════════════════════════════════════
   CANCELAR SOLICITUD
   ══════════════════════════════════════════════════ */
window.cancelarSolicitud = function() {
  // Cancelar rating pendiente para que no aparezca tras cancelar el viaje
  if (ratingTimeoutId) { clearTimeout(ratingTimeoutId); ratingTimeoutId = null; }
  if (activeViaje) {
    try { set(ref(db, `unidades/${activeViaje.unitId}/viaje`), null); } catch {}
    try { detenerCompartirViaje(); } catch (e) { console.warn("⚠️ Error al detener compartir:", e); }
    try { _stopProximityNotifications(); } catch (e) { console.warn("⚠️ Error al detener notificaciones:", e); }
    activeViaje = null;
  }
  const viajeBanner = document.getElementById("viaje-banner");
  if (viajeBanner) viajeBanner.classList.remove("show");
  showToast("❌ Solicitud cancelada");
};

// Alias para compatibilidad con HTML
window.cancelarViaje = window.cancelarSolicitud;

/* ══════════════════════════════════════════════════
   MONITOREO DE PROXIMIDAD PARA NOTIFICACIONES
   ══════════════════════════════════════════════════ */
let driverLocationListener = null;
let ratingTimeoutId        = null;   // Fix: permitir cancelar el rating si viaje se cancela

function _setupProximityNotifications(unitId) {
  try {
    console.log("🔔 Configurando monitoreo de proximidad para:", unitId);

    // Escuchar ubicación del conductor en tiempo real
    driverLocationListener = onValue(
      ref(db, `unidades/${unitId}`),
      (snapshot) => {
        const driverData = snapshot.val();
        
        if (
          !driverData ||
          !driverData.lat ||
          !driverData.lng ||
          !activeViaje
        ) {
          return;
        }

        // Datos del conductor
        const driverLocation = {
          lat: driverData.lat,
          lng: driverData.lng
        };

        // Calcular distancia actual
        const distanceToDriver = dist(myLat, myLng, driverLocation.lat, driverLocation.lng);
        console.log(`📍 Distancia actual al conductor: ${Math.round(distanceToDriver)}m`);

        // Iniciar monitoreo si aún no está activo
        if (!window.notificationState?.isMonitoring) {
          // Estimar tiempo de llegada (simplificado: ~1 km por minuto promedio en ciudad)
          const estimatedSpeed = 1000 / 60; // metros/segundo
          const estimatedArrivalTime = Date.now() + (distanceToDriver / estimatedSpeed) * 1000;

          startProximityMonitoring(db, driverLocation, estimatedArrivalTime);
        }
      },
      (error) => {
        console.error("❌ Error escuchando ubicación del conductor:", error);
      }
    );
  } catch (error) {
    console.error("❌ Error en _setupProximityNotifications:", error);
  }
}

function _stopProximityNotifications() {
  try {
    if (driverLocationListener) {
      off(driverLocationListener);
      driverLocationListener = null;
    }
    stopProximityMonitoring();
    console.log("🛑 Monitoreo de proximidad detenido");
  } catch (error) {
    console.error("❌ Error deteniendo monitoreo:", error);
  }
}

/* ══════════════════════════════════════════════════
   RATING
   ══════════════════════════════════════════════════ */
function _mostrarRating() {
  if (!activeViaje) return;
  rateData    = { ...activeViaje };
  activeViaje = null;
  try { detenerCompartirViaje(); } catch (e) { console.warn("⚠️ Error al detener compartir:", e); }
  try { _stopProximityNotifications(); } catch (e) { console.warn("⚠️ Error al detener notificaciones:", e); }
  const viajeBanner = document.getElementById("viaje-banner");
  if (viajeBanner) viajeBanner.classList.remove("show");
  
  // Mostrar modal mejorado de calificación
  mostrarModalCalificacion(rateData);
}

window.rateStar = function(n) { 
  // Mantener para compatibilidad
  window.setStar?.(n);
};

function _syncStars() {
  // Compatibilidad (ahora manejado en rating.js)
  document.querySelectorAll(".rate-star").forEach((s, i) => s.classList.toggle("on", i < 5));
}

window.enviarCalif = window.enviarRating = function() {
  // Nueva lógica mejorada
  enviarCalificacion(db, myName, myPhone).catch(err => {
    console.error("Error en enviarCalificacion:", err);
  });
};

// Alias para compatibilidad con HTML
window.enviarCalif = window.enviarRating;

// Asignar listeners a estrellas
document.querySelectorAll(".rate-star").forEach((s, i) => {
  s.onclick = () => window.rateStar(i + 1);
});

/* ══════════════════════════════════════════════════
   HISTORIAL
   ══════════════════════════════════════════════════ */
function _renderHist() {
  document.getElementById("hist-list").innerHTML = historial.length
    ? historial.slice().reverse().map(h => `
        <div class="hist-item">
          <div class="hist-dest">📍 ${escHtml(h.destino)}</div>
          <div class="hist-meta">🚖 ${h.unitId} — ${h.conductor || "Conductor"} · ${formatFecha(h.ts)}</div>
        </div>`
    ).join("")
    : `<div style="text-align:center;color:#9ca3af;padding:40px;font-size:14px">Sin viajes aún 🚖</div>`;
}

/* ══════════════════════════════════════════════════
   NAVEGACIÓN
   ══════════════════════════════════════════════════ */
window.switchNav = function(screen, btn) {
  // Para compatibilidad con selectores que pueden no existir
  const screens = document.querySelectorAll(".screen");
  const navBtns = document.querySelectorAll(".nav-btn");
  
  screens.forEach(x => x.classList.remove("active"));
  navBtns.forEach(b => b.classList.remove("active"));
  
  const screenEl = document.getElementById(`screen-${screen}`);
  if (screenEl) screenEl.classList.add("active");
  if (btn) btn.classList.add("active");

  if (screen === "historial") _renderHist();
  if (screen === "inicio")    refrescarMapa();
};

/* ══════════════════════════════════════════════════
   SHARE TRIP (Compartir Viaje)
   ══════════════════════════════════════════════════ */
window.compartirViaje = compartirViaje;
window.compartirPorWhatsApp = compartirPorWhatsApp;
window.detenerCompartirViaje = detenerCompartirViaje;
window.copiarAlPortapapeles = copiarAlPortapapeles;
window.iniciarCompartirViaje = iniciarCompartirViaje;

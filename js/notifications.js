// ══════════════════════════════════════════════════════════════════════════════
//  📬 NOTIFICATIONS SYSTEM — Notificaciones Push con Firebase
//  Gestiona solicitud de permisos, tokens FCM y alertas de proximidad
// ══════════════════════════════════════════════════════════════════════════════

import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";
import { ref, set, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let messaging = null;
let fcmToken = null;
let proximityWatcher = null;
const PROXIMITY_RADIUS = 150; // metros
const ARRIVAL_TIME_THRESHOLD = 60000; // 1 minuto en ms

export const notificationState = {
  enabled: false,
  token: null,
  lastNotification: null,
  proximityAlertSent: false,
  arrivalAlertSent: false,
  isMonitoring: false
};

const NOTIFICATION_SOUNDS = {
  proximity: "/sounds/proximity.mp3",
  arrival: "/sounds/arrival.mp3",
  default: "/sounds/notification.mp3"
};

/* ─────────────────────────────────────────────────────────────────────────────
   INICIALIZAR FIREBASE MESSAGING
   ───────────────────────────────────────────────────────────────────────────── */
export function initializeMessaging(firebaseApp) {
  try {
    messaging = getMessaging(firebaseApp);
    console.log("✅ Firebase Messaging inicializado");
    
    // Escuchar mensajes cuando la app está en primer plano
    setupForegroundMessageHandler();
    
    return messaging;
  } catch (error) {
    console.error("❌ Error inicializando Firebase Messaging:", error);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SOLICITAR PERMISO DE NOTIFICACIONES Y OBTENER TOKEN
   ───────────────────────────────────────────────────────────────────────────── */
export async function requestNotificationPermission(db, userId) {
  try {
    // Verificar soporte del navegador
    if (!("Notification" in window)) {
      console.warn("⚠️ Notificaciones no soportadas en este navegador");
      return null;
    }

    // Verificar si el navegador soporta Service Workers
    if (!navigator.serviceWorker) {
      console.warn("⚠️ Service Workers no soportados");
      return null;
    }

    // Registrar Service Worker
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      console.log("✅ Service Worker registrado:", registration.scope);
    } catch (swError) {
      console.warn("⚠️ Error registrando SW:", swError);
    }

    // Solicitar permiso
    const permission = await Notification.requestPermission();
    
    if (permission === "denied") {
      console.log("❌ Usuario denegó notificaciones");
      notificationState.enabled = false;
      showToast("❌ Notificaciones deshabilitadas");
      return null;
    }

    if (permission !== "granted") {
      console.log("⚠️ Estado de notificaciones: " + permission);
      return null;
    }

    console.log("✅ Permiso de notificaciones otorgado");

    // Obtener token FCM
    if (!messaging) {
      console.error("❌ Firebase Messaging no inicializado");
      return null;
    }

    // VAPID key: obtener desde Firebase Console → Project Settings → Cloud Messaging
    // → Web Push certificates → Generate key pair → copiar el valor de "Key pair"
    const vapidKey = import.meta.env?.VITE_VAPID_KEY || window.APP_VAPID_KEY || null;

    if (!vapidKey) {
      console.error(
        "❌ VAPID key no configurada. Las notificaciones push están desactivadas.\n" +
        "   → Firebase Console → Project Settings → Cloud Messaging → Web Push certificates"
      );
      return null;
    }

    fcmToken = await getToken(messaging, { vapidKey });
    
    if (fcmToken) {
      console.log("✅ Token FCM obtenido:", fcmToken);
      notificationState.enabled = true;
      notificationState.token = fcmToken;

      // Guardar token en Firebase (para poder enviar notificaciones desde el servidor)
      if (db && userId) {
        await saveFCMToken(db, userId, fcmToken);
      }

      showToast("✅ Notificaciones push activadas", 3000);
      return fcmToken;
    } else {
      console.warn("⚠️ No se pudo obtener token FCM");
      return null;
    }

  } catch (error) {
    console.error("❌ Error solicitando permiso de notificaciones:", error);
    showToast("❌ Error al activar notificaciones", 2000);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   GUARDAR TOKEN FCM EN FIREBASE
   ───────────────────────────────────────────────────────────────────────────── */
export async function saveFCMToken(db, userId, token) {
  try {
    const tokenRef = ref(db, `usuarios/${userId}/fcmToken`);
    await set(tokenRef, {
      token: token,
      deviceType: navigator.userAgent.includes("Mobile") ? "mobile" : "desktop",
      timestamp: Date.now()
    });
    console.log("✅ Token FCM guardado en Firebase");
  } catch (error) {
    console.error("❌ Error guardando token FCM:", error);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   MANEJAR MENSAJES EN PRIMER PLANO
   ───────────────────────────────────────────────────────────────────────────── */
function setupForegroundMessageHandler() {
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    console.log("📬 Mensaje Push recibido (primer plano):", payload);

    const title = payload.notification?.title || "Notificación";
    const body = payload.notification?.body || "";
    const data = payload.data || {};

    // Mostrar notificación incluso en primer plano
    showLocalNotification(title, body, data);

    // Reproducir sonido según tipo
    if (data.type === "proximity") {
      playNotificationSound("proximity");
    } else if (data.type === "arrival") {
      playNotificationSound("arrival");
    }

    // Guardar en estado
    notificationState.lastNotification = {
      title,
      body,
      data,
      timestamp: Date.now()
    };
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   MOSTRAR NOTIFICACIÓN LOCAL (CUANDO APP ESTÁ ABIERTA)
   ───────────────────────────────────────────────────────────────────────────── */
export function showLocalNotification(title, body, data = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    console.log("⚠️ No se puede mostrar notificación (sin permiso)");
    return;
  }

  try {
    // En primer plano, usar la API de Notification directa
    const notification = new Notification(title, {
      body: body,
      icon: "/assets/icon-192x192.png",
      badge: "/assets/badge-72x72.png",
      tag: data.tag || "app-notification",
      requireInteraction: data.requireInteraction || false,
      data: data,
      vibrate: [200, 100, 200]
    });

    notification.onclick = () => {
      console.log("🖱️ Usuario clickeó notificación en primer plano");
      notification.close();
      window.focus();
      
      // Procesar según tipo de notificación
      if (data.type === "proximity") {
        console.log("📍 Proximidad: Conductor cerca");
      } else if (data.type === "arrival") {
        console.log("🚖 Llegada: Conductor está llegando");
      }
    };

    console.log("✅ Notificación local mostrada");
  } catch (error) {
    console.error("❌ Error mostrando notificación:", error);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   REPRODUCIR SONIDO DE NOTIFICACIÓN
   ───────────────────────────────────────────────────────────────────────────── */
export function playNotificationSound(type = "default") {
  try {
    const soundPath = NOTIFICATION_SOUNDS[type] || NOTIFICATION_SOUNDS.default;
    const audio = new Audio(soundPath);
    audio.volume = 0.7;
    audio.play().catch(err => console.warn("⚠️ Error reproduciendo sonido:", err));
  } catch (error) {
    console.error("❌ Error con sonido de notificación:", error);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   MONITOREAR PROXIMIDAD DEL CONDUCTOR
   ───────────────────────────────────────────────────────────────────────────── */
export function startProximityMonitoring(db, driverLocation, estimatedArrivalTime) {
  if (proximityWatcher) {
    console.log("⚠️ Ya hay un monitoreo activo");
    return;
  }

  notificationState.isMonitoring = true;
  notificationState.proximityAlertSent = false;
  notificationState.arrivalAlertSent = false;

  console.log("🔍 Iniciando monitoreo de proximidad del conductor");

  // Iniciar geolocalización con seguimiento continuo
  proximityWatcher = navigator.geolocation.watchPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      // Calcular distancia al conductor
      const distance = calculateDistance(
        userLat,
        userLng,
        driverLocation.lat,
        driverLocation.lng
      );

      // Calcular tiempo estimado de llegada
      const timeRemaining = estimatedArrivalTime - Date.now();

      console.log(`📍 Distancia al conductor: ${Math.round(distance)}m, ETA: ${Math.round(timeRemaining / 1000)}s`);

      // ALERTA 1: Proximidad < 150m
      if (
        distance < PROXIMITY_RADIUS &&
        !notificationState.proximityAlertSent
      ) {
        notificationState.proximityAlertSent = true;
        sendProximityNotification(distance);
      }

      // ALERTA 2: Tiempo < 1 minuto
      if (
        timeRemaining < ARRIVAL_TIME_THRESHOLD &&
        timeRemaining > 0 &&
        !notificationState.arrivalAlertSent
      ) {
        notificationState.arrivalAlertSent = true;
        sendArrivalNotification(Math.round(timeRemaining / 1000));
      }

      // Detener si llegó
      if (distance < 50) {
        stopProximityMonitoring();
        sendArrivalCompleteNotification();
      }
    },
    (error) => {
      console.error("❌ Error obteniendo ubicación:", error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    }
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ENVIAR NOTIFICACIÓN DE PROXIMIDAD
   ───────────────────────────────────────────────────────────────────────────── */
function sendProximityNotification(distance) {
  const title = "🚖 El conductor está cerca";
  const body = `Tu conductor está a ${Math.round(distance)}m de distancia`;
  
  console.log("📍 ALERTA: Conductor a menos de 150m");
  
  showLocalNotification(title, body, {
    type: "proximity",
    distance: Math.round(distance),
    requireInteraction: true,
    tag: "proximity-alert"
  });

  playNotificationSound("proximity");
  vibrateDevice([200, 100, 200, 100, 500]); // Patrón de vibración
}

/* ─────────────────────────────────────────────────────────────────────────────
   ENVIAR NOTIFICACIÓN DE LLEGADA
   ───────────────────────────────────────────────────────────────────────────── */
function sendArrivalNotification(secondsRemaining) {
  const title = "⏰ El conductor está por llegar";
  const body = `Llegada estimada en ${secondsRemaining} segundos`;
  
  console.log("⏰ ALERTA: Falta 1 minuto para llegada");
  
  showLocalNotification(title, body, {
    type: "arrival",
    secondsRemaining: secondsRemaining,
    requireInteraction: true,
    tag: "arrival-alert"
  });

  playNotificationSound("arrival");
  vibrateDevice([300, 150, 300]); // Patrón diferente de vibración
}

/* ─────────────────────────────────────────────────────────────────────────────
   ENVIAR NOTIFICACIÓN DE LLEGADA COMPLETADA
   ───────────────────────────────────────────────────────────────────────────── */
function sendArrivalCompleteNotification() {
  const title = "✅ Conductor ha llegado";
  const body = "Tu conductor está aquí. Por favor prepárate para el viaje.";
  
  console.log("✅ Conductor ha llegado al destino de recogida");
  
  showLocalNotification(title, body, {
    type: "arrival-complete",
    requireInteraction: true,
    tag: "arrival-complete"
  });

  playNotificationSound("arrival");
  vibrateDevice([300, 100, 300, 100, 300]);
}

/* ─────────────────────────────────────────────────────────────────────────────
   DETENER MONITOREO DE PROXIMIDAD
   ───────────────────────────────────────────────────────────────────────────── */
export function stopProximityMonitoring() {
  // watchPosition puede devolver 0 como ID válido, usar isMonitoring como fuente de verdad
  if (notificationState.isMonitoring || proximityWatcher !== null) {
    if (proximityWatcher !== null) {
      navigator.geolocation.clearWatch(proximityWatcher);
      proximityWatcher = null;
    }
    notificationState.isMonitoring = false;
    console.log("🛑 Monitoreo de proximidad detenido");
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   VIBRAR DISPOSITIVO
   ───────────────────────────────────────────────────────────────────────────── */
function vibrateDevice(pattern) {
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.warn("⚠️ Vibración no soportada:", error);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   CALCULAR DISTANCIA (HAVERSINE)
   ───────────────────────────────────────────────────────────────────────────── */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radio de la Tierra en metros
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ESCUCHAR MENSAJES DEL SERVICE WORKER
   ───────────────────────────────────────────────────────────────────────────── */
export function setupServiceWorkerMessageListener() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const { type, data } = event.data;

      if (type === "NOTIFICATION_CLICK") {
        console.log("📲 Notificación clickeada desde segundo plano:", data);
        // Procesar según el tipo de notificación
        if (data.type === "proximity") {
          console.log("Abriendo modal de confirmación...");
        }
      }
    });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   UTILS - Toast
   ───────────────────────────────────────────────────────────────────────────── */
function showToast(message, duration = 2000) {
  const toast = document.getElementById("toast") || createToastElement();
  toast.textContent = message;
  toast.style.transform = "translateX(-50%) translateY(0)";
  
  setTimeout(() => {
    toast.style.transform = "translateX(-50%) translateY(-100px)";
  }, duration);
}

function createToastElement() {
  const toast = document.createElement("div");
  toast.id = "toast";
  toast.style.cssText = `
    position: fixed; top: 80px; left: 50%; z-index: 1000;
    transform: translateX(-50%) translateY(-100px);
    padding: 12px 20px; border-radius: 12px;
    background: var(--accent); color: #000;
    font-size: 13px; font-weight: 700;
    white-space: nowrap; pointer-events: none;
    transition: transform 0.35s cubic-bezier(0.22,1,0.36,1);
    box-shadow: 0 4px 20px rgba(0,201,255,0.4);
  `;
  document.body.appendChild(toast);
  return toast;
}

/* ─────────────────────────────────────────────────────────────────────────────
   WINDOW EXPORTS
   ───────────────────────────────────────────────────────────────────────────── */
window.initializeMessaging = initializeMessaging;
window.requestNotificationPermission = requestNotificationPermission;
window.startProximityMonitoring = startProximityMonitoring;
window.stopProximityMonitoring = stopProximityMonitoring;
window.showLocalNotification = showLocalNotification;
window.notificationState = notificationState;

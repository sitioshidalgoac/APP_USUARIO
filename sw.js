// ══════════════════════════════════════════════════════════════════════════════
//  📱 SERVICE WORKER v2.0 — LIMPIO + Firebase Cloud Messaging
//  ⚠️  PRIMERO limpia caches viejos, LUEGO gestiona notificaciones push
// ══════════════════════════════════════════════════════════════════════════════

const SW_VERSION = 'v2.0-clean';

// ─── PASO 1: Al instalarse, FORZAR activación inmediata ─────────────────────
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Instalando — forzando activación`);
  self.skipWaiting();
});

// ─── PASO 2: Al activarse, BORRAR TODOS los caches viejos ──────────────────
self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activando — limpiando caches`);
  event.waitUntil(
    caches.keys().then((keys) => {
      console.log(`[SW] Caches encontrados: ${keys.length}`, keys);
      return Promise.all(
        keys.map((key) => {
          console.log(`[SW] ❌ Eliminando cache: ${key}`);
          return caches.delete(key);
        })
      );
    }).then(() => {
      console.log('[SW] ✅ Todos los caches eliminados');
      return self.clients.claim();
    }).then(() => {
      return self.clients.matchAll({ type: 'window' });
    }).then((windowClients) => {
      windowClients.forEach((client) => {
        console.log(`[SW] 🔄 Recargando: ${client.url}`);
        client.navigate(client.url);
      });
    })
  );
});

// ─── PASO 3: NO hay evento 'fetch' = sin cache = siempre fresco ────────────

// ══════════════════════════════════════════════════════════════════════════════
//  FIREBASE CLOUD MESSAGING — Notificaciones Push
// ══════════════════════════════════════════════════════════════════════════════

// ⚠️ IMPORTANTE: en Service Workers se DEBE usar las versiones -compat
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey:            "AIzaSyDEu6dOk9mUqXp52lyY6vBEm4GAsgU0ESU",
  authDomain:        "sitios-hidalgo-gps.firebaseapp.com",
  databaseURL:       "https://sitios-hidalgo-gps-default-rtdb.firebaseio.com",
  projectId:         "sitios-hidalgo-gps",
  storageBucket:     "sitios-hidalgo-gps.firebasestorage.app",
  messagingSenderId: "140903781731",
  appId:             "1:140903781731:web:2178219a57a3244db42f56"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("📲 Push en segundo plano:", payload);
  const title = payload.notification?.title || "Notificación";
  const options = {
    body:               payload.notification?.body || "Tienes una actualización",
    icon:               "/assets/icon-192x192.png",
    badge:              "/assets/badge-72x72.png",
    tag:                payload.data?.tag || "notification",
    requireInteraction: payload.data?.requireInteraction === "true",
    data:               payload.data || {},
    actions: [
      { action: "open",  title: "Abrir"  },
      { action: "close", title: "Cerrar" }
    ],
    vibrate: [200, 100, 200]
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  const data   = event.notification.data || {};
  const action = event.action;
  event.notification.close();
  if (action === "close") return;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({ type: "NOTIFICATION_CLICK", data });
          return client;
        }
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});

self.addEventListener("notificationclose", (event) => {
  console.log("❌ Notificación cerrada:", event.notification.tag);
});

console.log(`✅ Service Worker ${SW_VERSION} — sin cache, con FCM`);

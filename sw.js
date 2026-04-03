// ══════════════════════════════════════════════════════════════════════════════
//  📱 SERVICE WORKER — Notificaciones Push en Segundo Plano
//  Gestiona Firebase Cloud Messaging y notificaciones push
// ══════════════════════════════════════════════════════════════════════════════

// Importar Firebase Messaging
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js");

/* ─────────────────────────────────────────────────────────────────────────────
   INICIALIZAR FIREBASE EN SERVICE WORKER
   ───────────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────────
   MANEJAR MENSAJES EN SEGUNDO PLANO
   ───────────────────────────────────────────────────────────────────────────── */
messaging.onBackgroundMessage((payload) => {
  console.log("📲 Mensaje push recibido en segundo plano:", payload);

  const notificationTitle = payload.notification?.title || "Notificación";
  const notificationOptions = {
    body: payload.notification?.body || "Tienes una actualización",
    icon: "/assets/icon-192x192.png",
    badge: "/assets/badge-72x72.png",
    tag: payload.data?.tag || "notification",
    requireInteraction: payload.data?.requireInteraction === "true", // Requiere acción del usuario
    data: payload.data || {},
    actions: [
      {
        action: "open",
        title: "Abrir"
      },
      {
        action: "close",
        title: "Cerrar"
      }
    ],
    vibrate: [200, 100, 200], // Patrón de vibración
    sound: "/sounds/notification.mp3"
  };

  // Mostrar notificación
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

/* ─────────────────────────────────────────────────────────────────────────────
   MANEJAR CLICK EN NOTIFICACIÓN
   ───────────────────────────────────────────────────────────────────────────── */
self.addEventListener("notificationclick", (event) => {
  console.log("👆 Usuario clickeó notificación:", event.notification.tag);

  const notificationData = event.notification.data || {};
  const action = event.action;

  if (action === "close") {
    event.notification.close();
    return;
  }

  // Abrir la app en la ventana del navegador
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta, enfocarla
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === "/" && "focus" in client) {
          client.focus();
          // Enviar mensaje a la app que la notificación fue clickeada
          client.postMessage({
            type: "NOTIFICATION_CLICK",
            data: notificationData
          });
          return client;
        }
      }
      // Si no hay ventana, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow("/").then((client) => {
          if (client) {
            client.postMessage({
              type: "NOTIFICATION_CLICK",
              data: notificationData
            });
          }
          return client;
        });
      }
    })
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
   MANEJAR CIERRE DE NOTIFICACIÓN
   ───────────────────────────────────────────────────────────────────────────── */
self.addEventListener("notificationclose", (event) => {
  console.log("❌ Notificación cerrada:", event.notification.tag);
  // Aquí se puede hacer tracking si es necesario
});

/* ─────────────────────────────────────────────────────────────────────────────
   SYNC TAGS PARA ACTUALIZAR EN BACKGROUND
   ───────────────────────────────────────────────────────────────────────────── */
self.addEventListener("sync", (event) => {
  if (event.tag === "update-viaje") {
    event.waitUntil(
      fetch("/api/check-viaje")
        .then((response) => response.json())
        .then((data) => {
          console.log("✅ Viaje actualizado en sync:", data);
        })
        .catch((err) => console.error("❌ Error en sync:", err))
    );
  }
});

console.log("✅ Service Worker registrado para Firebase Messaging");

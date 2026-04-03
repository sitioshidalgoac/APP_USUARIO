// ══════════════════════════════════════════════════════════════════════════════
//  🌟 RATING SYSTEM — Calificación de Viajes
//  Módulo: Gestión de calificaciones, perfiles de conductores y promedios
// ══════════════════════════════════════════════════════════════════════════════

import { ref, set, push, update, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let pendingRating = null;
let ratingState = {
  stars: 5,
  comment: "",
  viajeData: null
};

const FEEDBACK = {
  5: { text: "¡Excelente servicio! 🤩", class: "excellent" },
  4: { text: "Muy bueno, gracias 😊", class: "good" },
  3: { text: "Servicio regular", class: "okay" },
  2: { text: "Podría mejorar", class: "bad" },
  1: { text: "Mala experiencia 😞", class: "bad" }
};

/* ─────────────────────────────────────────────────────────────────────────────
   INICIALIZAR INTERFAZ DE CALIFICACIÓN
   ───────────────────────────────────────────────────────────────────────────── */
export function inicializarCalificacion() {
  // Crear estrellas interactivas
  const rateStars = document.getElementById("rate-stars");
  if (!rateStars) return;

  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += `<span class="rate-star" data-stars="${i}" onclick="window.setStar?.(${i})">⭐</span>`;
  }
  rateStars.innerHTML = html;

  // Listeners para cambio de estrellas
  document.querySelectorAll(".rate-star").forEach(star => {
    star.addEventListener("click", function (e) {
      const newStars = parseInt(this.getAttribute("data-stars"));
      actualizarEstrellas(newStars);
      e.stopPropagation();
    });

    star.addEventListener("mouseenter", function () {
      const stars = parseInt(this.getAttribute("data-stars"));
      previewEstrellas(stars);
    });
  });

  // Preview en hover
  const rateContainer = document.querySelector(".rate-container");
  if (rateContainer) {
    rateContainer.addEventListener("mouseleave", () => {
      mostrarEstrellas(ratingState.stars);
    });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   MOSTRAR MODAL DE CALIFICACIÓN
   ───────────────────────────────────────────────────────────────────────────── */
export function mostrarModalCalificacion(viajeData) {
  if (!viajeData) return;

  pendingRating = viajeData;
  ratingState = {
    stars: 5,
    comment: "",
    viajeData: viajeData
  };

  // Actualizar información del viaje
  const rateUnit = document.getElementById("rate-unit");
  if (rateUnit) {
    rateUnit.innerHTML = `<b>${viajeData.conductor || "Conductor"}</b> — ${viajeData.unitId || "Taxi"}`;
  }

  // Reset de campos
  document.getElementById("rate-comment-input").value = "";
  
  // Inicializar interfaz
  mostrarEstrellas(5);
  actualizarFeedback(5);

  // Abrir modal
  const modal = document.getElementById("modal-rate");
  if (modal) {
    modal.classList.add("open");
    inicializarCalificacion();
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ACTUALIZAR ESTRELLAS
   ───────────────────────────────────────────────────────────────────────────── */
function actualizarEstrellas(numStars) {
  ratingState.stars = numStars;
  mostrarEstrellas(numStars);
  actualizarFeedback(numStars);
}

function mostrarEstrellas(numStars) {
  document.querySelectorAll(".rate-star").forEach((star, i) => {
    star.classList.toggle("on", i + 1 <= numStars);
  });

  // Actualizar contador
  const scoreEl = document.getElementById("rate-score");
  if (scoreEl) scoreEl.textContent = `${numStars}/5`;
}

function previewEstrellas(numStars) {
  document.querySelectorAll(".rate-star").forEach((star, i) => {
    star.classList.toggle("on", i + 1 <= numStars);
  });
}

function actualizarFeedback(stars) {
  const feedback = FEEDBACK[stars] || FEEDBACK[5];
  const feedbackEl = document.getElementById("rate-feedback");
  if (feedbackEl) {
    feedbackEl.textContent = feedback.text;
    feedbackEl.className = `rate-feedback ${feedback.class}`;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ENVIAR CALIFICACIÓN
   ───────────────────────────────────────────────────────────────────────────── */
export async function enviarCalificacion(db, myName, myPhone) {
  if (!pendingRating || !db) {
    console.warn("⚠️ No hay viaje pendiente para calificar");
    return;
  }

  try {
    // Recolectar datos de calificación
    const comentario = document.getElementById("rate-comment-input")?.value?.trim() || "";
    const rating = ratingState.stars;
    const unitId = pendingRating.unitId;
    const conductor = pendingRating.conductor;
    const timestamp = Date.now();

    // 1️⃣ GUARDAR CALIFICACIÓN EN COLECCIÓN GLOBAL
    const calificacionData = {
      unitId: unitId,
      conductor: conductor,
      cliente: myName,
      telefono: myPhone,
      rating: rating,
      comentario: comentario,
      ts: timestamp,
      destino: pendingRating.destino
    };

    const calRef = await push(ref(db, "calificaciones"), calificacionData);
    console.log("✅ Calificación guardada:", calRef.key);

    // 2️⃣ ACTUALIZAR PERFIL DEL CONDUCTOR (Nombre, Total, Suma, Promedio)
    await actualizarPerfilConductor(db, unitId, conductor, rating, comentario, timestamp);

    // 3️⃣ GUARDAR EN HISTORIAL DEL CONDUCTOR
    await guardarEnHistorial(db, unitId, calificacionData);

    // Cerrar modal
    const modal = document.getElementById("modal-rate");
    if (modal) modal.classList.remove("open");

    // Toast confirmación
    const toast = document.getElementById("toast") || crearToastElement();
    mostrarToast(toast, "⭐ ¡Gracias por tu calificación!", 3000);

    console.log("✅ Calificación completada exitosamente");
    console.log("   📊 Rating:", rating);
    console.log("   💬 Comentario:", comentario);
    console.log("   👤 Conductor:", conductor);

    // Resetear
    pendingRating = null;
    ratingState = { stars: 5, comment: "", viajeData: null };

  } catch (error) {
    console.error("❌ Error al enviar calificación:", error);
    const toast = document.getElementById("toast") || crearToastElement();
    mostrarToast(toast, "❌ Error al guardar calificación", 2000);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ACTUALIZAR PERFIL DEL CONDUCTOR
   ───────────────────────────────────────────────────────────────────────────── */
async function actualizarPerfilConductor(db, unitId, conductorNombre, rating, comentario, ts) {
  try {
    const perfilRef = ref(db, `conductores/${unitId}`);

    // Obtener estado actual del perfil
    const snapshot = await get(perfilRef);
    let perfil = snapshot.val() || {
      nombre: conductorNombre,
      totalCalificaciones: 0,
      sumaRatings: 0,
      promedioRating: 0,
      ultimaCalificacion: null,
      comentarios: []
    };

    // Calcular nuevo promedio
    perfil.totalCalificaciones = (perfil.totalCalificaciones || 0) + 1;
    perfil.sumaRatings = (perfil.sumaRatings || 0) + rating;
    perfil.promedioRating = parseFloat((perfil.sumaRatings / perfil.totalCalificaciones).toFixed(2));
    perfil.ultimaCalificacion = {
      rating: rating,
      comentario: comentario,
      ts: ts
    };

    // Mantener últimos comentarios
    if (comentario) {
      if (!perfil.comentarios) perfil.comentarios = [];
      perfil.comentarios.unshift({
        texto: comentario,
        rating: rating,
        ts: ts
      });
      // Limitar a últimos 10 comentarios
      perfil.comentarios = perfil.comentarios.slice(0, 10);
    }

    // Actualizar en Firebase
    await set(perfilRef, perfil);

    console.log(`✅ Perfil actualizado: ${conductorNombre}`);
    console.log(`   📊 Promedio: ${perfil.promedioRating} (${perfil.totalCalificaciones} calificaciones)`);

  } catch (error) {
    console.error("❌ Error al actualizar perfil del conductor:", error);
    throw error;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   GUARDAR EN HISTORIAL DEL CONDUCTOR
   ───────────────────────────────────────────────────────────────────────────── */
async function guardarEnHistorial(db, unitId, calificacionData) {
  try {
    const histRef = ref(db, `conductores/${unitId}/historialCalificaciones`);
    await push(histRef, calificacionData);
    console.log("✅ Guardado en historial del conductor");
  } catch (error) {
    console.warn("⚠️ No se pudo guardar en historial:", error);
    // No es crítico, continuar
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   OBTENER PERFIL DEL CONDUCTOR
   ───────────────────────────────────────────────────────────────────────────── */
export async function obtenerPerfilConductor(db, unitId) {
  try {
    const snapshot = await get(ref(db, `conductores/${unitId}`));
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return null;
  } catch (error) {
    console.warn("⚠️ Error al obtener perfil del conductor:", error);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ESCUCHAR CAMBIOS EN PERFIL (REAL-TIME)
   ───────────────────────────────────────────────────────────────────────────── */
export function escucharPerfilConductor(db, unitId, callback) {
  const perfilRef = ref(db, `conductores/${unitId}`);
  return onValue(perfilRef, (snapshot) => {
    const perfil = snapshot.val();
    if (callback) callback(perfil);
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   WINDOW EXPORTS
   ───────────────────────────────────────────────────────────────────────────── */
window.setStar = function(n) {
  actualizarEstrellas(n);
};

window.mostrarModalCalificacion = mostrarModalCalificacion;
window.enviarCalificacion = enviarCalificacion;
window.inicializarCalificacion = inicializarCalificacion;
window.obtenerPerfilConductor = obtenerPerfilConductor;
window.escucharPerfilConductor = escucharPerfilConductor;

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────────────────────── */
function crearToastElement() {
  if (document.getElementById("toast")) return document.getElementById("toast");
  const toast = document.createElement("div");
  toast.id = "toast";
  toast.style.cssText = `
    position: fixed; top: 80px; left: 50%; z-index: 1000;
    transform: translateX(-50%) translateY(-100px);
    padding: 10px 16px; border-radius: 12px;
    background: var(--accent); color: #000;
    font-size: 13px; font-weight: 700;
    white-space: nowrap; pointer-events: none;
    transition: transform 0.35s cubic-bezier(0.22,1,0.36,1);
    box-shadow: 0 4px 20px rgba(0,201,255,0.4);
  `;
  document.body.appendChild(toast);
  return toast;
}

function mostrarToast(toast, msg, duration = 2000) {
  if (!toast) return;
  toast.textContent = msg;
  toast.style.transform = "translateX(-50%) translateY(0)";
  setTimeout(() => {
    toast.style.transform = "translateX(-50%) translateY(-100px)";
  }, duration);
}

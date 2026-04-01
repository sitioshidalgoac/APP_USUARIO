/**
 * crear-usuarios-panel.js  — MODO FUERZA BRUTA
 * ─────────────────────────────────────────────
 * 1. Si el usuario existe → lo ELIMINA completamente
 * 2. Lo RECREA con las credenciales definidas abajo
 *
 * Esto garantiza que la contraseña quede exactamente como se define aquí,
 * sin depender de ningún estado anterior en Firebase Auth.
 *
 * Uso:  node crear-usuarios-panel.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

/* ══════════════════════════════════════════════════════════
   CREDENCIALES FINALES — Modifica aquí si quieres cambiarlas
   ══════════════════════════════════════════════════════════ */
const USUARIOS_PANEL = [
  { email: 'base@sitios-hidalgo.com',        password: 'Base2024SH!',  displayName: 'Base Central'  },
  { email: 'admin@sitios-hidalgo.com',       password: 'Admin2024SH!', displayName: 'Administrador' },
  { email: 'despachador@sitios-hidalgo.com', password: 'Desp2024SH!',  displayName: 'Despachador'   },
];

/* ══════════════════════════════════════════════════════════
   LÓGICA PRINCIPAL
   ══════════════════════════════════════════════════════════ */
async function resetearUsuariosPanel() {
  console.log('\n══════════════════════════════════════════════');
  console.log('   RESET FUERZA BRUTA — USUARIOS DE PANEL');
  console.log('   Proyecto: sitios-hidalgo-gps');
  console.log('══════════════════════════════════════════════\n');

  for (const u of USUARIOS_PANEL) {
    console.log(`▶ Procesando: ${u.email}`);

    // PASO 1: Intentar eliminar si existe
    try {
      const existing = await auth.getUserByEmail(u.email);
      await auth.deleteUser(existing.uid);
      console.log(`   🗑️  Eliminado (UID anterior: ${existing.uid})`);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log('   ℹ️  No existía previamente, se creará nuevo.');
      } else {
        console.error(`   ❌ Error al eliminar:`, e.message);
        console.log('   ⚠️  Intentando continuar con la creación de todas formas...\n');
      }
    }

    // PASO 2: Crear usuario nuevo con contraseña correcta
    try {
      const record = await auth.createUser({
        email:         u.email,
        password:      u.password,
        displayName:   u.displayName,
        emailVerified: true,
        disabled:      false
      });
      console.log(`   ✅ CREADO EXITOSAMENTE`);
      console.log(`      UID:         ${record.uid}`);
      console.log(`      Email:       ${u.email}`);
      console.log(`      Contraseña:  ${u.password}`);
      console.log(`      DisplayName: ${u.displayName}\n`);
    } catch (e) {
      console.error(`   ❌ ERROR al crear ${u.email}:`, e.message, '\n');
    }
  }

  console.log('══════════════════════════════════════════════');
  console.log('   ✅ PROCESO COMPLETADO');
  console.log('');
  console.log('   Credenciales para entrar al panel:');
  console.log('');
  for (const u of USUARIOS_PANEL) {
    console.log(`   ${u.email.padEnd(35)} → ${u.password}`);
  }
  console.log('══════════════════════════════════════════════\n');

  process.exit(0);
}

resetearUsuariosPanel();

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

async function crearConductores() {
  const total = 75;
  const pin   = '1972SH';
  let ok = 0, fail = 0;

  for (let i = 1; i <= total; i++) {
    const num   = String(i).padStart(3, '0');
    const unit  = 'SH-' + num;
    const email = 'sh' + num + '@sitios-hidalgo.com';

    try {
      await auth.createUser({
        email:         email,
        password:      pin,
        displayName:   unit,
        emailVerified: true,
        disabled:      false
      });
      console.log('✅ Creado:', unit, '→', email);
      ok++;
    } catch(e) {
      if (e.code === 'auth/email-already-exists') {
        console.log('⏭️  Ya existe:', unit);
        ok++;
      } else {
        console.error('❌ Error en', unit, ':', e.message);
        fail++;
      }
    }
  }

  console.log('\n══════════════════════════════');
  console.log('✅ Creados/existentes:', ok);
  console.log('❌ Errores:', fail);
  console.log('══════════════════════════════');
  process.exit(0);
}

crearConductores();

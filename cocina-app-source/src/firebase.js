/* ============================================================
   INICIALIZACIÓN DE FIREBASE
   Proyecto: cocina-juanlc

   La configuración web de Firebase es pública por diseño (va en el
   bundle): quien protege los datos son las reglas de Firestore,
   no esta clave. Ver FIRESTORE_RULES.txt.
   ============================================================ */
import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCr_QE5yjd07td1w0gKFtUNnsKs5LKiIdI',
  authDomain: 'cocina-juanlc.firebaseapp.com',
  projectId: 'cocina-juanlc',
  storageBucket: 'cocina-juanlc.firebasestorage.app',
  messagingSenderId: '709474289924',
  appId: '1:709474289924:web:120a1f53f8021d75f56851',
}

const app = initializeApp(firebaseConfig)

/* Caché persistente en IndexedDB.

   Es lo que permite abrir la lista de la compra dentro de un
   supermercado sin cobertura: los datos ya están en el móvil y lo
   que se marque allí se sincroniza al recuperar la señal.
   El gestor multipestaña evita que dos pestañas se peleen por la
   caché; si el navegador no la soporta, se cae con elegancia a la
   caché en memoria y la app sigue funcionando online. */
let firestore
try {
  firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
} catch (e) {
  console.warn('Sin caché persistente, se sigue solo online:', e?.message || e)
  firestore = initializeFirestore(app, {})
}

export const db = firestore
export const auth = getAuth(app)

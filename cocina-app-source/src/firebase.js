// Firebase inicialización
// Config de Juan - proyecto: cocina-juanlc
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
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
export const db = getFirestore(app)
export const auth = getAuth(app)

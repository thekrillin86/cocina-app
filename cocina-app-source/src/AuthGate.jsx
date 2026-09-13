import React, { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth'
import { auth } from './firebase'

/* ============================================================
   ENTRADA A LA APP

   Cuentas de verdad, una por persona. Antes se entraba con un PIN
   que se comparaba en el cliente contra un documento de Firestore:
   eso no protegía nada, porque la sesión era anónima y cualquiera
   podía pedir una. Ahora quien manda son las reglas de Firestore,
   que solo dejan entrar a estos usuarios por su identificador.

   Firebase guarda la sesión en el propio navegador, así que el
   correo y la contraseña se piden una sola vez por móvil.
   ============================================================ */

// Resto de la versión del PIN: se limpia al entrar
const CLAVE_ANTIGUA = 'cocina_authed'

function mensajeDeError(err) {
  switch (err?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.'
    case 'auth/invalid-email':
      return 'Ese correo no está bien escrito.'
    case 'auth/user-disabled':
      return 'Esa cuenta está desactivada.'
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'
    case 'auth/network-request-failed':
      return 'Sin conexión. Comprueba el wifi o los datos.'
    case 'auth/operation-not-allowed':
      return 'Falta activar «Correo electrónico/contraseña» en la consola de Firebase.'
    default:
      return 'No se ha podido entrar: ' + (err?.code || err?.message || 'error desconocido')
  }
}

export async function cerrarSesion() {
  await signOut(auth)
}

export function AuthGate({ children }) {
  const [estado, setEstado] = useState('comprobando') // comprobando | fuera | dentro
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {})

    const unsub = onAuthStateChanged(auth, (user) => {
      /* Las sesiones anónimas de la versión del PIN no valen: quien
         siguiera con una se encuentra la pantalla de entrada. */
      if (user && !user.isAnonymous) {
        try {
          localStorage.removeItem(CLAVE_ANTIGUA)
        } catch {}
        setEstado('dentro')
      } else {
        setEstado('fuera')
      }
    })

    return unsub
  }, [])

  async function entrar(e) {
    e?.preventDefault?.()
    const c = correo.trim()
    if (!c || !clave) return

    setEntrando(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, c, clave)
      setClave('')
      // onAuthStateChanged se encarga de dejar pasar
    } catch (err) {
      console.error('Error al entrar:', err)
      setError(mensajeDeError(err))
      setClave('')
    } finally {
      setEntrando(false)
    }
  }

  if (estado === 'comprobando') {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terracotta-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (estado === 'fuera') {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <div className="card w-full max-w-sm p-8">
          <p className="font-display italic text-terracotta-600 text-lg text-center mb-1">
            Cocina Juan &amp; Magda
          </p>
          <h1 className="font-display text-2xl text-ink-900 text-center mb-2">Hola 👋</h1>
          <p className="text-sm text-ink-500 text-center mb-6">
            Entra con tu correo y tu contraseña
          </p>

          <form onSubmit={entrar}>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="input mb-3"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Contraseña"
              className="input mb-4"
            />

            {error && <p className="text-sm text-terracotta-600 mb-3 text-center">{error}</p>}

            <button
              type="submit"
              disabled={entrando || !correo.trim() || !clave}
              className="btn-primary w-full disabled:opacity-40"
            >
              {entrando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-xs text-ink-500/70 text-center mt-6">
            Solo la primera vez en este dispositivo
          </p>
        </div>
      </div>
    )
  }

  return children
}

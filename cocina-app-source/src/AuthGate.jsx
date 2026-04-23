import React, { useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInAnonymously,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

// ── localStorage helpers ──────────────────────────────────────
const LS_KEY = 'cocina_authed'
const isAuthed = () => { try { return localStorage.getItem(LS_KEY) === '1' } catch { return false } }
const setAuthed = () => { try { localStorage.setItem(LS_KEY, '1') } catch {} }

export function AuthGate({ children }) {
  const [state, setState] = useState('checking') // checking | needs-pin | allowed
  const [pin, setPin] = useState('')
  const [trying, setTrying] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    let cancelled = false

    async function init() {
      // 1. Forzar persistencia localStorage
      try { await setPersistence(auth, browserLocalPersistence) } catch {}

      // 2. Si ya estaba autenticado previamente → entrar directo
      if (isAuthed()) {
        // Asegurar que Firebase Auth también tiene sesión
        if (!auth.currentUser) await signInAnonymously(auth)
        if (!cancelled) setState('allowed')
        return
      }

      // 3. Primera vez → autenticar anónimamente y pedir PIN
      try {
        if (!auth.currentUser) await signInAnonymously(auth)
        if (!cancelled) setState('needs-pin')
      } catch (e) {
        console.error('signInAnonymously error:', e)
        if (!cancelled) setState('needs-pin')
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e) {
    e?.preventDefault?.()
    const trimmed = pin.trim()
    if (!trimmed) return
    setTrying(true)
    setErrMsg('')

    try {
      // Asegurar sesión activa
      if (!auth.currentUser) await signInAnonymously(auth)
      await auth.currentUser.getIdToken(true)

      // Leer el PIN correcto de Firestore (el usuario ya está autenticado)
      const snap = await getDoc(doc(db, 'config', 'auth'))
      if (!snap.exists()) throw new Error('config-missing')

      const stored = snap.data()?.pin
      // Comparar como string en ambos lados
      if (String(stored) !== String(trimmed)) {
        setErrMsg('PIN incorrecto. Vuelve a intentarlo.')
        setPin('')
        setTrying(false)
        return
      }

      // PIN correcto
      setAuthed()
      setState('allowed')
    } catch (err) {
      console.error('Auth error:', err)
      if (err.message === 'config-missing') {
        setErrMsg('Error de configuración. Contacta con Juan.')
      } else if (err?.code === 'permission-denied') {
        setErrMsg('Error de permisos. Revisa las reglas de Firestore.')
      } else {
        setErrMsg('Error: ' + (err?.message || err?.code || 'desconocido'))
      }
      setPin('')
    } finally {
      setTrying(false)
    }
  }

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terracotta-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (state === 'needs-pin') {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <div className="card w-full max-w-sm p-8">
          <p className="font-display italic text-terracotta-600 text-lg text-center mb-1">
            Cocina Juan &amp; Magda
          </p>
          <h1 className="font-display text-2xl text-ink-900 text-center mb-2">
            Hola 👋
          </h1>
          <p className="text-sm text-ink-500 text-center mb-6">
            Introduce el PIN familiar para entrar
          </p>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="input text-center text-2xl font-display tracking-[0.4em] mb-4"
              maxLength={8}
            />
            {errMsg && (
              <p className="text-sm text-terracotta-600 mb-3 text-center">{errMsg}</p>
            )}
            <button
              type="submit"
              disabled={trying || !pin.trim()}
              className="btn-primary w-full disabled:opacity-40"
            >
              {trying ? 'Entrando…' : 'Entrar'}
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

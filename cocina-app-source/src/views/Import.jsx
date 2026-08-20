import React, { useState } from 'react'
import { Header } from '../components/ui'
import { importMenuToFirestore } from '../lib/db'

export function ImportView({ onDone }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState(null)

  const handleImport = async () => {
    setStatus(null)
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      setStatus({ type: 'err', msg: 'JSON inválido: ' + e.message })
      return
    }
    if (!parsed.week || !parsed.year || !Array.isArray(parsed.days)) {
      setStatus({
        type: 'err',
        msg: 'Faltan campos obligatorios (week, year, days).',
      })
      return
    }
    try {
      await importMenuToFirestore(parsed)
      setStatus({ type: 'ok', msg: `Semana ${parsed.week} guardada ✓` })
      setText('')
      setTimeout(onDone, 1200)
    } catch (e) {
      setStatus({ type: 'err', msg: 'Error al guardar: ' + e.message })
    }
  }

  return (
    <div className="animate-fade-in-up">
      <Header />
      <div className="px-6">
        <h1 className="font-display text-3xl text-ink-900 mb-2">Importar</h1>
        <p className="text-sm text-ink-500 mb-6">
          Pega el JSON que te genere Claude en el chat. Se sincronizará
          automáticamente en los dos móviles.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{ "week": 17, "year": 2026, ... }'
          rows={14}
          className="input font-mono text-xs resize-none"
        />

        {status && (
          <p
            className={`mt-3 text-sm ${
              status.type === 'ok' ? 'text-sage-700' : 'text-terracotta-600'
            }`}
          >
            {status.msg}
          </p>
        )}

        <button
          onClick={handleImport}
          disabled={!text.trim()}
          className="btn-primary w-full mt-4 disabled:opacity-40"
        >
          Importar semana
        </button>
      </div>
    </div>
  )
}

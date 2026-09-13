import React, { useState } from 'react'
import { Header, useConfirm, useToast } from '../components/ui'
import { importMenuToFirestore, bulkSaveRecipes } from '../lib/db'
import { detectPayload, parseRecipesPayload } from '../lib/recipesImport'
import { weekId } from '../lib/dates'
import { countMeals } from '../lib/plan'
import { listaLegible } from '../lib/format'

const EJEMPLO = `[
  {
    "name": "Frittata de pollo",
    "type": "comida",
    "category": "huevos",
    "calories": 260,
    "recipe": {
      "ingredients": ["Huevo 4ud", "Pimiento rojo 200g"],
      "steps": ["🔧 Método: Thermomix TM6", "Batir los huevos"]
    }
  }
]`

export function ImportView({ recipes = [], menus = [], onDone }) {
  const [text, setText] = useState('')
  const [errores, setErrores] = useState([])
  const [guardando, setGuardando] = useState(false)
  const confirmar = useConfirm()
  const avisar = useToast()

  async function importar() {
    setErrores([])

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      setErrores([{ etiqueta: 'El texto', problema: 'no es un JSON válido — ' + e.message }])
      return
    }

    if (detectPayload(parsed) === 'menu') await importarMenu(parsed)
    else await importarRecetas(parsed)
  }

  async function importarMenu(menu) {
    /* Importar un menú reemplaza el documento de esa semana entero.
       Si ya hay algo planificado conviene decirlo antes, que si no se
       pierde sin avisar. */
    const existente = (menus || []).find((m) => m.id === weekId(menu.year, menu.week))
    if (existente) {
      const platos = countMeals(existente)
      const ok = await confirmar({
        title: `La semana ${menu.week} ya existe`,
        message: platos
          ? `Se reemplaza entera y se pierden los ${platos} platos que tiene ahora. Esto no se puede deshacer.`
          : 'Se reemplaza entera. Esto no se puede deshacer.',
        confirmLabel: 'Reemplazar',
        danger: true,
      })
      if (!ok) return
    }

    setGuardando(true)
    try {
      await importMenuToFirestore(menu)
      avisar(`Semana ${menu.week} guardada`, 'ok')
      setText('')
      setTimeout(() => onDone('today'), 900)
    } catch (e) {
      avisar('No se ha podido guardar la semana: ' + (e?.message || e), 'error')
    } finally {
      setGuardando(false)
    }
  }

  async function importarRecetas(json) {
    const lote = parseRecipesPayload(json, recipes)
    if (!lote.ok) {
      setErrores(lote.errors)
      return
    }

    const partes = []
    if (lote.nuevas) partes.push(`${lote.nuevas} ${lote.nuevas === 1 ? 'nueva' : 'nuevas'}`)
    if (lote.colisiones.length) {
      partes.push(
        `${lote.colisiones.length} que ya ${lote.colisiones.length === 1 ? 'está' : 'están'} en el recetario`
      )
    }

    const aviso = lote.colisiones.length
      ? ` Las repetidas se fusionan con la ficha que ya tienes —se conserva la valoración y todo lo que el JSON no traiga—: ${listaLegible(lote.colisiones)}.`
      : ''

    const ok = await confirmar({
      title: `Importar ${lote.recipes.length} ${lote.recipes.length === 1 ? 'receta' : 'recetas'}`,
      message: `${partes.join(' y ')}.${aviso}`,
      confirmLabel: 'Importar',
    })
    if (!ok) return

    setGuardando(true)
    try {
      await bulkSaveRecipes(lote.recipes)
      avisar(
        lote.colisiones.length
          ? `${lote.nuevas} añadidas y ${lote.colisiones.length} actualizadas`
          : `${lote.recipes.length} recetas añadidas al recetario`,
        'ok'
      )
      setText('')
      setTimeout(() => onDone('recipes'), 900)
    } catch (e) {
      avisar('No se ha podido importar: ' + (e?.message || e), 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="animate-fade-in-up">
      <Header />
      <div className="px-6">
        <h1 className="font-display text-3xl text-ink-900 mb-2">Importar</h1>
        <p className="text-sm text-ink-500 mb-4">
          Pega aquí el JSON que te genere Claude. Se reconoce solo lo que sea y se sincroniza en
          los dos móviles.
        </p>

        <div className="card p-4 mb-5 space-y-2 text-sm">
          <p className="text-ink-700">
            <span className="label-caps text-teal-700 mr-2">Recetas</span>
            una lista <code className="text-xs">[…]</code> o un objeto con{' '}
            <code className="text-xs">recipes</code>. Van al recetario.
          </p>
          <p className="text-ink-700">
            <span className="label-caps text-teal-700 mr-2">Menú</span>
            un objeto con <code className="text-xs">week</code>,{' '}
            <code className="text-xs">year</code> y <code className="text-xs">days</code>. Va a la
            planificación semanal.
          </p>
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (errores.length) setErrores([])
          }}
          placeholder={EJEMPLO}
          rows={14}
          className="input font-mono text-xs resize-none"
        />

        {errores.length > 0 && (
          <div className="card p-4 mt-3 border border-terracotta-300">
            <p className="label-caps text-terracotta-700 mb-2">
              No se ha guardado nada · {errores.length}{' '}
              {errores.length === 1 ? 'problema' : 'problemas'}
            </p>
            <ul className="space-y-1.5 text-sm text-ink-700">
              {errores.map((e, i) => (
                <li key={i}>
                  <span className="font-medium">{e.etiqueta}</span> {e.problema}
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-500 mt-3">
              Corrige el JSON y vuelve a pulsar: o entra todo, o no entra nada.
            </p>
          </div>
        )}

        <button
          onClick={importar}
          disabled={!text.trim() || guardando}
          className="btn-primary w-full mt-4 disabled:opacity-40"
        >
          {guardando ? 'Importando…' : 'Importar'}
        </button>
      </div>
    </div>
  )
}

import React, { useState, useMemo } from 'react'
import { Header, Loading, EmptyState, Sheet, Tag, useConfirm, useToast } from '../components/ui'
import { RecipeBody } from '../components/meals'
import { bulkSaveRecipes, markInboxDone, deleteInboxBatch } from '../lib/db'
import { parseRecipesPayload, MAX_RECETAS_POR_LOTE } from '../lib/recipesImport'
import { normalize } from '../lib/ingredients'
import { formatProteins, listaLegible } from '../lib/format'
import { CATEGORY_META, guessCategory } from '../lib/catalog'

/* ============================================================
   BUZÓN DE RECETAS

   Aquí llega lo que el asistente deja en /inbox desde fuera de la
   app. Es contenido de origen externo: se enseña para revisarlo y
   no se aplica nada hasta que se aprueba a mano. Los textos del lote
   son datos, nunca instrucciones.
   ============================================================ */

function fechaLegible(iso) {
  if (!iso) return 'sin fecha'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16)
  return d.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* Cuántas recetas trae, sin fiarse de lo que venga en el documento */
function cuantasTrae(lote) {
  return Array.isArray(lote?.recipes) ? lote.recipes.length : 0
}

export function InboxView({ batches, loading, error, recipes = [] }) {
  const [abierto, setAbierto] = useState(null)

  if (loading) return <Loading />

  const lote = batches.find((b) => b.id === abierto)

  return (
    <div className="animate-fade-in-up">
      <Header />
      <div className="px-6">
        <h1 className="font-display text-3xl text-ink-900 mb-2">Buzón</h1>
        <p className="text-sm text-ink-500 mb-5">
          Lotes de recetas que ha dejado el asistente. No entra nada en el recetario hasta que lo
          apruebes.
        </p>

        {error ? (
          <EmptyState
            title="No se puede leer el buzón"
            hint={
              error.code === 'permission-denied'
                ? 'Faltan las reglas de Firestore para la colección /inbox. Están escritas en FIRESTORE_RULES.txt, hay que publicarlas en la consola de Firebase.'
                : 'Error: ' + (error.message || error.code)
            }
          />
        ) : !batches.length ? (
          <EmptyState
            title="El buzón está vacío"
            hint="Cuando el asistente deje un lote de recetas, aparecerá aquí para que lo revises."
          />
        ) : (
          <div className="space-y-3 pb-6">
            {batches.map((b) => (
              <button
                key={b.id}
                onClick={() => setAbierto(b.id)}
                className="card w-full text-left p-4 active:bg-cream-200"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="label-caps text-terracotta-600">
                      {b.batch || 'Lote'} · {b.source || 'origen desconocido'}
                    </p>
                    <p className="font-display text-lg text-ink-900 mt-0.5">
                      {cuantasTrae(b)} {cuantasTrae(b) === 1 ? 'receta' : 'recetas'}
                    </p>
                  </div>
                  <p className="text-xs text-ink-500 shrink-0 text-right">
                    {fechaLegible(b.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {lote && <LoteSheet lote={lote} recipes={recipes} onClose={() => setAbierto(null)} />}
    </div>
  )
}

function LoteSheet({ lote, recipes, onClose }) {
  const crudas = Array.isArray(lote.recipes) ? lote.recipes : []
  const [marcadas, setMarcadas] = useState(() => new Set(crudas.map((_, i) => i)))
  const [desplegada, setDesplegada] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const confirmar = useConfirm()
  const avisar = useToast()

  // Nombres que ya están en el recetario, para avisar antes de aprobar
  const yaExisten = useMemo(() => {
    const set = new Set(recipes.map((r) => normalize(r.name)))
    return new Set(
      crudas.filter((r) => r?.name && set.has(normalize(r.name))).map((r) => normalize(r.name))
    )
  }, [crudas, recipes])

  const elegidas = crudas.filter((_, i) => marcadas.has(i))
  const lote_ = useMemo(
    () => parseRecipesPayload(elegidas, recipes, { maxRecipes: MAX_RECETAS_POR_LOTE }),
    [elegidas, recipes]
  )

  function alternar(i) {
    setMarcadas((previa) => {
      const s = new Set(previa)
      if (s.has(i)) s.delete(i)
      else s.add(i)
      return s
    })
  }

  async function aprobar() {
    if (!lote_.ok) return
    const aviso = lote_.colisiones.length
      ? ` ${lote_.colisiones.length} ${
          lote_.colisiones.length === 1 ? 'se fusiona' : 'se fusionan'
        } con la ficha que ya tienes: ${listaLegible(lote_.colisiones)}.`
      : ''
    const ok = await confirmar({
      title: `Añadir ${lote_.recipes.length} al recetario`,
      message: `${lote_.nuevas} ${lote_.nuevas === 1 ? 'nueva' : 'nuevas'}.${aviso} El lote quedará marcado como revisado.`,
      confirmLabel: 'Añadir',
    })
    if (!ok) return

    setTrabajando(true)
    try {
      await bulkSaveRecipes(lote_.recipes)
      await markInboxDone(lote.id)
      avisar(`${lote_.recipes.length} recetas añadidas al recetario`, 'ok')
      onClose()
    } catch (e) {
      avisar('No se ha podido añadir: ' + (e?.message || e), 'error')
    } finally {
      setTrabajando(false)
    }
  }

  async function descartar() {
    const ok = await confirmar({
      title: 'Descartar el lote',
      message: `Se borra el lote entero con sus ${crudas.length} recetas, sin añadir nada. Esto no se puede deshacer.`,
      confirmLabel: 'Descartar',
      danger: true,
    })
    if (!ok) return

    setTrabajando(true)
    try {
      await deleteInboxBatch(lote.id)
      avisar('Lote descartado')
      onClose()
    } catch (e) {
      avisar('No se ha podido descartar: ' + (e?.message || e), 'error')
      setTrabajando(false)
    }
  }

  return (
    <Sheet
      title={`${lote.batch || 'Lote'} · ${crudas.length} recetas`}
      onClose={onClose}
      onCloseLabel="Cerrar"
      tall
    >
      <div className="p-5 space-y-4">
        <p className="text-xs text-ink-500">
          Enviado por «{String(lote.source || 'desconocido')}» el {fechaLegible(lote.createdAt)}.
          Revisa lo que entra: desmarca lo que no quieras.
        </p>

        {!lote_.ok && marcadas.size > 0 && (
          <div className="card p-4 border border-terracotta-300">
            <p className="label-caps text-terracotta-700 mb-2">
              Este lote tiene {lote_.errors.length}{' '}
              {lote_.errors.length === 1 ? 'problema' : 'problemas'}
            </p>
            <ul className="space-y-1.5 text-sm text-ink-700">
              {lote_.errors.map((e, i) => (
                <li key={i}>
                  <span className="font-medium">{e.etiqueta}</span> {e.problema}
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-500 mt-3">
              Desmarca las que fallan, o descarta el lote entero.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {crudas.map((r, i) => (
            <RecetaDelLote
              key={i}
              cruda={r}
              indice={i}
              marcada={marcadas.has(i)}
              repetida={r?.name && yaExisten.has(normalize(r.name))}
              desplegada={desplegada === i}
              onAlternar={() => alternar(i)}
              onDesplegar={() => setDesplegada(desplegada === i ? null : i)}
            />
          ))}
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={aprobar}
            disabled={!lote_.ok || !marcadas.size || trabajando}
            className="btn-primary w-full disabled:opacity-40"
          >
            {trabajando
              ? 'Añadiendo…'
              : `Añadir al recetario (${marcadas.size})`}
          </button>
          <button
            onClick={descartar}
            disabled={trabajando}
            className="w-full py-3 text-terracotta-700 text-sm font-medium border border-terracotta-300 rounded-2xl active:bg-terracotta-50"
          >
            Descartar el lote
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function RecetaDelLote({
  cruda,
  marcada,
  repetida,
  desplegada,
  onAlternar,
  onDesplegar,
}) {
  const nombre = String(cruda?.name || '(sin nombre)')
  const cat = CATEGORY_META[cruda?.category] || CATEGORY_META[guessCategory(nombre)] || CATEGORY_META.otro

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <button onClick={onAlternar} aria-label={marcada ? `Quitar ${nombre}` : `Incluir ${nombre}`}>
          <span
            className={`shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
              marcada ? 'bg-terracotta-500 border-terracotta-500' : 'border-cream-400'
            }`}
          >
            {marcada && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12l5 5L20 7"
                  stroke="#FDFBF7"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        </button>

        <button onClick={onDesplegar} className="flex-1 min-w-0 text-left">
          <p className={`font-display text-lg leading-tight ${marcada ? 'text-ink-900' : 'text-ink-500'}`}>
            {cat.icon} {nombre}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <Tag tone="soft">{cruda?.type === 'cena' ? '🌙 Cena' : '☀️ Comida'}</Tag>
            {cruda?.calories && <Tag tone="soft">🔥 {cruda.calories} kcal</Tag>}
            {cruda?.proteins && <Tag tone="soft">🥩 {formatProteins(cruda.proteins)}</Tag>}
            {repetida && <Tag tone="warn">Ya está en el recetario</Tag>}
          </div>
          <p className="text-xs text-terracotta-600 mt-1.5">
            {desplegada ? 'Ocultar receta ▲' : 'Ver receta ▼'}
          </p>
        </button>
      </div>

      {desplegada && (
        <div className="mt-3 pt-3 border-t border-cream-200 text-sm space-y-3">
          <RecipeBody recipe={cruda?.recipe} />
          {cruda?.source && (
            <p className="text-xs text-ink-500">
              <span className="label-caps text-teal-700 mr-2">Fuente</span>
              {String(cruda.source)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

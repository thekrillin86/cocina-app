import React, { useState, useMemo, useCallback } from 'react'
import {
  Header,
  Loading,
  EmptyState,
  Sheet,
  Field,
  Chip,
  Tag,
  useConfirm,
  useToast,
} from '../components/ui'
import { RecipeRow, RecipeBody } from '../components/meals'
import { asMultiline, formatProteins, listaLegible } from '../lib/format'
import { saveRecipe, deleteRecipe, bulkSaveRecipes, bulkDeleteRecipes } from '../lib/db'
import { SEED_RECIPES } from '../data/seedRecipes'
import {
  DISH_CATEGORIES,
  CATEGORY_META,
  MEAL_TYPES,
  RATINGS,
  SORT_MODES,
  sortRecipes,
  statsFor,
  lastCookedLabel,
  guessCategory,
  mealToRecipe,
  hasRecipeBody,
  isNewRecipe,
  DIAS_NUEVA,
  menuReferences,
  isRecipeUsed,
} from '../lib/catalog'
import { normalize } from '../lib/ingredients'
import { forEachDish } from '../lib/dishes'

export default function CatalogView({ recipes, loading, menus, stats }) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('todos')
  const [category, setCategory] = useState('todas')
  const [soloSinReceta, setSoloSinReceta] = useState(false)
  const [soloNuevas, setSoloNuevas] = useState(false)
  const [sort, setSort] = useState('sugerido')
  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null) // 'new' | recipe
  const [completar, setCompletar] = useState(false)
  const [syncing, setSyncing] = useState(false)
  // null = modo selección apagado; si no, el conjunto de identificadores marcados
  const [seleccion, setSeleccion] = useState(null)
  const [borrando, setBorrando] = useState(false)
  const confirmar = useConfirm()
  const avisar = useToast()

  const enSeleccion = seleccion !== null
  const marcadas = seleccion || new Set()

  const referencias = useMemo(() => menuReferences(menus), [menus])
  const conReceta = useMemo(() => recipes.filter(hasRecipeBody).length, [recipes])
  const sinReceta = recipes.length - conReceta
  const nuevas = useMemo(() => recipes.filter((r) => isNewRecipe(r)).length, [recipes])

  const list = useMemo(() => {
    let l = recipes
    if (type !== 'todos') l = l.filter((r) => (r.type || 'comida') === type)
    if (category !== 'todas') l = l.filter((r) => (r.category || guessCategory(r.name)) === category)
    if (soloSinReceta) l = l.filter((r) => !hasRecipeBody(r))
    if (soloNuevas) l = l.filter((r) => isNewRecipe(r))
    if (search.trim()) {
      const q = normalize(search)
      l = l.filter(
        (r) => normalize(r.name).includes(q) || normalize(formatProteins(r.proteins)).includes(q)
      )
    }
    // Al filtrar por nuevas, lo natural es verlas de más reciente a
    // más antigua, salvo que se haya elegido otro orden a propósito
    return sortRecipes(l, soloNuevas && sort === 'sugerido' ? 'nuevas' : sort, stats)
  }, [recipes, type, category, soloSinReceta, soloNuevas, search, sort, stats])

  /* ============================================================
     COMPLETAR EL RECETARIO

     Calcula qué haría, sin escribir nada. Dos fuentes: el repertorio
     que trae la app y los platos que ya aparecen en semanas
     guardadas. Nunca borra ni pisa una receta existente; como mucho
     le rellena la que le faltaba.

     `incluirSinReceta` es lo que evita que el recetario se vuelva a
     llenar de nombres sueltos: desmarcado, solo entran los platos
     que traen ingredientes o pasos. Afecta a las dos fuentes, porque
     el repertorio base también trae muchos que son solo un nombre y
     si no volverían todos en cuanto se pulsara el botón.

     Compara por nombre sin acentos ni mayúsculas, así que un plato
     escrito de dos formas distintas cuenta como dos.
     ============================================================ */
  const calcularCompletado = useCallback(
    (incluirSinReceta) => {
      const byName = new Map(recipes.map((r) => [normalize(r.name), r]))
      const toSave = []
      let delRepertorio = 0
      let deMisMenus = 0
      let completadas = 0
      let omitidos = 0

      for (const seed of SEED_RECIPES) {
        if (byName.has(normalize(seed.name))) continue
        if (!incluirSinReceta && !hasRecipeBody(seed)) {
          omitidos++
          continue
        }
        toSave.push({ ...seed, createdAt: new Date().toISOString() })
        delRepertorio++
        byName.set(normalize(seed.name), seed)
      }

      for (const menu of menus || []) {
        forEachDish(menu, (meal, { mealType }) => {
          const key = normalize(meal.name)
          const existente = byName.get(key)

          if (!existente) {
            if (!incluirSinReceta && !hasRecipeBody(meal)) {
              omitidos++
              return
            }
            const r = mealToRecipe(meal, mealType)
            const safeId =
              'r-' +
              (key.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 52) ||
                Math.random().toString(36).slice(2, 8))
            const withId = { ...r, id: safeId, createdAt: new Date().toISOString() }
            toSave.push(withId)
            deMisMenus++
            byName.set(key, withId)
            return
          }

          // Rellenar una receta que falta siempre es útil, traiga de
          // donde traiga: eso no ensucia nada.
          if (!hasRecipeBody(existente) && hasRecipeBody(meal)) {
            toSave.push({
              id: existente.id,
              name: existente.name,
              recipe: meal.recipe,
              calories: existente.calories ?? meal.calories ?? null,
              proteins: existente.proteins ?? meal.proteins ?? null,
            })
            completadas++
            byName.set(key, { ...existente, recipe: meal.recipe })
          }
        })
      }

      return { toSave, delRepertorio, deMisMenus, completadas, omitidos }
    },
    [recipes, menus]
  )

  async function aplicarCompletado(plan) {
    setSyncing(true)
    try {
      await bulkSaveRecipes(plan.toSave)
      avisar(`${plan.toSave.length} platos añadidos o completados`, 'ok')
      setCompletar(false)
    } catch (e) {
      avisar('No se ha podido completar: ' + (e?.message || e), 'error')
    } finally {
      setSyncing(false)
    }
  }

  /* ============================================================
     BORRADO EN LOTE
     ============================================================ */

  function alternarMarca(id) {
    setSeleccion((previa) => {
      const siguiente = new Set(previa)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  async function borrarSeleccionadas() {
    const elegidas = recipes.filter((r) => marcadas.has(r.id))
    if (!elegidas.length) return

    const enUso = elegidas.filter((r) => isRecipeUsed(r, referencias))
    const aviso = enUso.length
      ? ` ${enUso.length} ${enUso.length === 1 ? 'aparece' : 'aparecen'} en alguna semana guardada (${listaLegible(
          enUso.map((r) => r.name)
        )}); esas semanas conservan su propia copia de la receta.`
      : ''

    const ok = await confirmar({
      title: `Eliminar ${elegidas.length} ${elegidas.length === 1 ? 'plato' : 'platos'}`,
      message: `Se borran del recetario. No se pierde el histórico: las veces que los has cocinado se calculan desde los menús, no desde aquí.${aviso}`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return

    setBorrando(true)
    try {
      await bulkDeleteRecipes(elegidas.map((r) => r.id))
      avisar(
        `${elegidas.length} ${elegidas.length === 1 ? 'plato eliminado' : 'platos eliminados'}`,
        'ok'
      )
      setSeleccion(null)
    } catch (e) {
      avisar('No se han podido eliminar: ' + (e?.message || e), 'error')
    } finally {
      setBorrando(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="animate-fade-in-up">
      <Header />
      <div className="px-6">
        <div className="flex items-center justify-between mb-1 gap-3">
          <h1 className="font-display text-3xl text-ink-900">Recetario</h1>
          <div className="flex items-center gap-4 shrink-0">
            {recipes.length > 0 && (
              <button
                onClick={() => setSeleccion(enSeleccion ? null : new Set())}
                className="text-ink-500 text-sm font-medium"
              >
                {enSeleccion ? 'Cancelar' : 'Seleccionar'}
              </button>
            )}
            {!enSeleccion && (
              <button
                onClick={() => setEditing('new')}
                className="text-terracotta-600 text-sm font-medium"
              >
                + Nueva
              </button>
            )}
          </div>
        </div>

        <p className="text-sm text-ink-500 mb-4">
          {recipes.length} platos · {conReceta} con receta ·{' '}
          <button
            onClick={() => setSoloSinReceta((v) => !v)}
            className={soloSinReceta ? 'text-terracotta-600 font-semibold' : 'underline'}
          >
            {sinReceta} sin receta
          </button>
          {nuevas > 0 && (
            <>
              {' · '}
              <button
                onClick={() => setSoloNuevas((v) => !v)}
                className={soloNuevas ? 'text-teal-700 font-semibold' : 'underline'}
              >
                {nuevas} {nuevas === 1 ? 'nueva' : 'nuevas'}
              </button>
            </>
          )}
        </p>

        {!enSeleccion && (
          <>
            <button
              onClick={() => setCompletar(true)}
              disabled={syncing}
              className="w-full py-2.5 rounded-2xl bg-teal-50 text-teal-700 text-sm font-medium active:bg-teal-100 disabled:opacity-50"
            >
              🔄 Completar el recetario
            </button>
            <p className="text-xs text-ink-500 mt-2 mb-5 leading-relaxed">
              Añade el repertorio que trae la app y los platos que ya usaste en semanas
              anteriores, y rellena las recetas que falten. Antes de hacer nada te dice qué va a
              añadir. No borra ni cambia lo que ya tienes.
            </p>
          </>
        )}

        {/* Filtros */}
        <div className="space-y-2.5 mb-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar plato…"
            className="input"
          />
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            <Chip active={type === 'todos'} onClick={() => setType('todos')}>
              Todo
            </Chip>
            {MEAL_TYPES.map((t) => (
              <Chip key={t.key} active={type === t.key} onClick={() => setType(t.key)}>
                {t.icon} {t.label}s
              </Chip>
            ))}
            <Chip active={soloNuevas} onClick={() => setSoloNuevas((v) => !v)} tone="teal">
              ✨ Nuevas
            </Chip>
            <Chip active={soloSinReceta} onClick={() => setSoloSinReceta((v) => !v)}>
              📄 Sin receta
            </Chip>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            <Chip active={category === 'todas'} onClick={() => setCategory('todas')} tone="teal">
              Todas
            </Chip>
            {DISH_CATEGORIES.map((c) => (
              <Chip
                key={c.key}
                active={category === c.key}
                onClick={() => setCategory(c.key)}
                tone="teal"
              >
                {c.icon} {c.label}
              </Chip>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input py-2.5 text-sm"
          >
            {SORT_MODES.map((m) => (
              <option key={m.key} value={m.key}>
                Orden: {m.label}
              </option>
            ))}
          </select>
        </div>

        {!list.length ? (
          <EmptyState
            title={recipes.length ? 'Sin resultados' : 'Recetario vacío'}
            hint={
              soloNuevas
                ? `Aquí salen las que se han añadido en los últimos ${DIAS_NUEVA} días.`
                : recipes.length
                  ? 'Prueba con otro filtro.'
                  : 'Pulsa «Completar el recetario» para cargar el repertorio de golpe.'
            }
          />
        ) : (
          <div className={`space-y-2 ${enSeleccion ? 'pb-24' : 'pb-6'}`}>
            {list.map((r) => (
              <RecipeRow
                key={r.id}
                recipe={r}
                stats={stats}
                onClick={() => (enSeleccion ? alternarMarca(r.id) : setDetail(r))}
                right={enSeleccion ? <Casilla marcada={marcadas.has(r.id)} /> : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {enSeleccion && (
        <BarraSeleccion
          marcadas={marcadas.size}
          filtradas={list.length}
          borrando={borrando}
          onSeleccionarTodas={() => setSeleccion(new Set(list.map((r) => r.id)))}
          onLimpiar={() => setSeleccion(new Set())}
          onBorrar={borrarSeleccionadas}
        />
      )}

      {completar && (
        <CompletarSheet
          calcular={calcularCompletado}
          trabajando={syncing}
          onClose={() => setCompletar(false)}
          onCompletar={aplicarCompletado}
        />
      )}

      {detail && (
        <RecipeDetail
          recipe={detail}
          stats={stats}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail)
            setDetail(null)
          }}
          onRate={async (value) => {
            await saveRecipe(detail.id, { name: detail.name, rating: value })
            setDetail({ ...detail, rating: value })
          }}
        />
      )}

      {editing && (
        <RecipeEditor
          recipe={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/* Marca de selección, igual que la de la lista de la compra */
function Casilla({ marcada }) {
  return (
    <span
      className={`shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
        marcada ? 'bg-terracotta-500 border-terracotta-500' : 'border-cream-400'
      }`}
      aria-hidden
    >
      {marcada && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
  )
}

function BarraSeleccion({
  marcadas,
  filtradas,
  borrando,
  onSeleccionarTodas,
  onLimpiar,
  onBorrar,
}) {
  const todasMarcadas = marcadas > 0 && marcadas === filtradas
  return (
    <div className="fixed inset-x-0 bottom-[4.5rem] z-40 px-4">
      <div className="card p-3 flex items-center gap-3 max-w-lg mx-auto shadow-card">
        <button
          onClick={todasMarcadas ? onLimpiar : onSeleccionarTodas}
          className="text-xs text-teal-700 font-medium shrink-0"
        >
          {todasMarcadas ? 'Ninguna' : `Todas (${filtradas})`}
        </button>
        <span className="text-sm text-ink-700 flex-1 text-center">
          {marcadas} {marcadas === 1 ? 'marcado' : 'marcados'}
        </span>
        <button
          onClick={onBorrar}
          disabled={!marcadas || borrando}
          className="shrink-0 px-4 py-2 rounded-full bg-terracotta-600 text-cream-50 text-sm font-medium active:bg-terracotta-700 disabled:opacity-40"
        >
          {borrando ? 'Borrando…' : 'Eliminar'}
        </button>
      </div>
    </div>
  )
}

/* ---------- HOJA DE «COMPLETAR EL RECETARIO» ---------- */
function CompletarSheet({ calcular, trabajando, onClose, onCompletar }) {
  const [incluirSinReceta, setIncluirSinReceta] = useState(false)
  const plan = useMemo(() => calcular(incluirSinReceta), [calcular, incluirSinReceta])

  const lineas = []
  if (plan.delRepertorio) {
    lineas.push(`${plan.delRepertorio} del repertorio que trae la app`)
  }
  if (plan.deMisMenus) {
    lineas.push(`${plan.deMisMenus} que ya usaste en semanas anteriores`)
  }
  if (plan.completadas) {
    lineas.push(`${plan.completadas} a ${plan.completadas === 1 ? 'la que le' : 'las que les'} falta la receta`)
  }

  return (
    <Sheet title="Completar el recetario" onClose={onClose} onCloseLabel="Cancelar">
      <div className="p-5 space-y-4">
        <button
          onClick={() => setIncluirSinReceta((v) => !v)}
          className="w-full flex items-start gap-3 text-left"
        >
          <Casilla marcada={incluirSinReceta} />
          <span className="flex-1 min-w-0">
            <span className="block text-ink-900 text-sm font-medium">
              Añadir también los platos que no traen receta
            </span>
            <span className="block text-xs text-ink-500 mt-0.5 leading-relaxed">
              Son nombres sueltos, sin ingredientes ni pasos. Si los borraste a propósito, deja
              esto sin marcar y no volverán.
            </span>
          </span>
        </button>

        <div className="card p-4">
          {plan.toSave.length ? (
            <>
              <p className="font-display text-xl text-ink-900 mb-2">
                {plan.toSave.length} {plan.toSave.length === 1 ? 'plato' : 'platos'}
              </p>
              <ul className="text-sm text-ink-700 space-y-1">
                {lineas.map((l) => (
                  <li key={l}>· {l}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-700">No hay nada que añadir ni completar.</p>
          )}

          {!incluirSinReceta && plan.omitidos > 0 && (
            <p className="text-xs text-ink-500 mt-3 pt-3 border-t border-cream-200">
              Se dejan fuera {plan.omitidos} platos que son solo un nombre. Marca la casilla de
              arriba si los quieres.
            </p>
          )}
        </div>

        <p className="text-xs text-ink-500">
          No se borra ni se cambia nada de lo que ya tienes: solo se añaden platos nuevos y se
          rellenan las recetas que falten.
        </p>

        <button
          onClick={() => onCompletar(plan)}
          disabled={!plan.toSave.length || trabajando}
          className="btn-primary w-full disabled:opacity-40"
        >
          {trabajando ? 'Completando…' : `Completar (${plan.toSave.length})`}
        </button>
      </div>
    </Sheet>
  )
}

/* ---------- FICHA ---------- */
function RecipeDetail({ recipe, stats, onClose, onEdit, onRate }) {
  const s = statsFor(stats, recipe.name)
  const cat = CATEGORY_META[recipe.category || guessCategory(recipe.name)] || CATEGORY_META.otro

  return (
    <Sheet
      title={recipe.name}
      onClose={onClose}
      action={
        <button onClick={onEdit} className="text-terracotta-600 text-sm font-semibold">
          Editar
        </button>
      }
    >
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Tag tone="teal">
            {cat.icon} {cat.label}
          </Tag>
          <Tag tone="soft">{recipe.type === 'cena' ? '🌙 Cena' : '☀️ Comida'}</Tag>
          {recipe.calories && <Tag tone="soft">🔥 {recipe.calories} kcal</Tag>}
          {recipe.proteins && <Tag tone="soft">🥩 {formatProteins(recipe.proteins)}</Tag>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="label-caps text-ink-500 mb-1">Última vez</p>
            <p className="font-display text-xl text-ink-900">{lastCookedLabel(s.daysAgo)}</p>
          </div>
          <div className="card p-4">
            <p className="label-caps text-ink-500 mb-1">Veces cocinado</p>
            <p className="font-display text-xl text-ink-900">{s.count}</p>
          </div>
        </div>

        <div>
          <p className="label-caps text-teal-700 mb-2">Valoración</p>
          <div className="flex flex-wrap gap-2">
            {RATINGS.map((r) => (
              <Chip
                key={r.value}
                active={(recipe.rating ?? 0) === r.value}
                onClick={() => onRate(r.value)}
              >
                {r.icon} {r.label}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-ink-500 mt-2">
            Los favoritos suben en la lista; lo que marcas «no repetir tanto» baja.
          </p>
        </div>

        {recipe.source && (
          <p className="text-xs text-ink-500">
            <span className="label-caps text-teal-700 mr-2">Fuente</span>
            {recipe.source}
          </p>
        )}

        <div className="border-t border-cream-200 pt-4 text-sm space-y-3">
          <RecipeBody recipe={recipe.recipe} />
        </div>
      </div>
    </Sheet>
  )
}

/* ---------- EDITOR ---------- */
function RecipeEditor({ recipe, onClose }) {
  const isNew = !recipe
  const [form, setForm] = useState(() => ({
    name: recipe?.name || '',
    type: recipe?.type || 'comida',
    category: recipe?.category || 'otro',
    proteins: formatProteins(recipe?.proteins),
    calories: recipe?.calories ?? '',
    rating: recipe?.rating ?? 0,
    source: recipe?.source || '',
    method: recipe?.recipe?.method || '',
    ingredients: asMultiline(recipe?.recipe?.ingredients),
    steps: asMultiline(recipe?.recipe?.steps),
  }))
  const [saving, setSaving] = useState(false)
  const confirmar = useConfirm()
  const avisar = useToast()
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await saveRecipe(recipe?.id || null, {
        name: form.name.trim(),
        type: form.type,
        category: form.category === 'otro' ? guessCategory(form.name) : form.category,
        proteins: form.proteins.trim() || null,
        calories: form.calories === '' ? null : parseInt(form.calories, 10),
        rating: form.rating,
        source: form.source.trim() || null,
        recipe:
          form.method || form.ingredients || form.steps
            ? {
                method: form.method.trim() || null,
                ingredients: form.ingredients.trim() || null,
                steps: form.steps.trim() || null,
              }
            : null,
      })
      onClose()
    } catch (e) {
      avisar('No se ha podido guardar: ' + (e?.message || e), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    const ok = await confirmar({
      title: `Eliminar «${recipe.name}»`,
      message: 'Se borrará del recetario. Los menús que ya lo usan conservan su copia.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setSaving(true)
    try {
      await deleteRecipe(recipe.id)
      onClose()
    } catch (e) {
      avisar('No se ha podido eliminar: ' + (e?.message || e), 'error')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title={isNew ? 'Nueva receta' : 'Editar receta'}
      onClose={onClose}
      onCloseLabel="Cancelar"
      action={
        <button
          onClick={save}
          disabled={saving || !form.name.trim()}
          className="text-terracotta-600 text-sm font-semibold disabled:opacity-40"
        >
          {saving ? '…' : 'Guardar'}
        </button>
      }
    >
      <div className="p-5 space-y-4">
        <Field label="Plato" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => up('name', e.target.value)}
            placeholder="Ej: Merluza al horno con pimientos"
            className="input"
          />
        </Field>

        <Field label="¿Comida o cena?">
          <div className="flex gap-2">
            {MEAL_TYPES.map((t) => (
              <Chip key={t.key} active={form.type === t.key} onClick={() => up('type', t.key)}>
                {t.icon} {t.label}
              </Chip>
            ))}
            <Chip active={form.type === 'ambas'} onClick={() => up('type', 'ambas')}>
              Las dos
            </Chip>
          </div>
        </Field>

        <Field label="Ingrediente principal">
          <select
            value={form.category}
            onChange={(e) => up('category', e.target.value)}
            className="input"
          >
            {DISH_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.icon} {c.label}
              </option>
            ))}
            <option value="otro">🍽️ Otros</option>
          </select>
        </Field>

        <Field label="Valoración">
          <div className="flex flex-wrap gap-2">
            {RATINGS.map((r) => (
              <Chip key={r.value} active={form.rating === r.value} onClick={() => up('rating', r.value)}>
                {r.icon} {r.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Proteína">
          <input
            type="text"
            value={form.proteins}
            onChange={(e) => up('proteins', e.target.value)}
            placeholder="Ej: Merluza + huevo"
            className="input"
          />
        </Field>

        <Field label="Calorías por persona">
          <input
            type="number"
            value={form.calories}
            onChange={(e) => up('calories', e.target.value)}
            placeholder="Ej: 480"
            className="input"
          />
        </Field>

        <div className="pt-3 border-t border-cream-200 space-y-4">
          <p className="label-caps text-teal-700">Receta</p>
          <Field label="Método">
            <input
              type="text"
              value={form.method}
              onChange={(e) => up('method', e.target.value)}
              placeholder="Ej: Thermomix TM6 + horno"
              className="input"
            />
          </Field>
          <Field
            label="Ingredientes"
            hint="Uno por línea, con cantidad. De aquí sale la lista de la compra."
          >
            <textarea
              value={form.ingredients}
              onChange={(e) => up('ingredients', e.target.value)}
              rows={8}
              placeholder={'800 g de lomo de merluza\n400 g de pimiento rojo\n45 g de aceite de oliva'}
              className="input resize-none"
            />
          </Field>
          <Field label="Pasos">
            <textarea
              value={form.steps}
              onChange={(e) => up('steps', e.target.value)}
              rows={8}
              placeholder="🔧 Método: …"
              className="input resize-none"
            />
          </Field>
          <Field label="Fuente">
            <input
              type="text"
              value={form.source}
              onChange={(e) => up('source', e.target.value)}
              placeholder="Ej: Cookidoo, Recetas de Rechupete…"
              className="input"
            />
          </Field>
        </div>

        {!isNew && (
          <button
            onClick={remove}
            disabled={saving}
            className="w-full py-3 text-terracotta-700 text-sm font-medium border border-terracotta-300 rounded-2xl active:bg-terracotta-50"
          >
            Eliminar del recetario
          </button>
        )}
      </div>
    </Sheet>
  )
}

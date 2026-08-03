import React, { useState, useMemo } from 'react'
import { Header, Loading, EmptyState, Sheet, Field, Chip, Tag } from '../components/ui'
import { RecipeRow, RecipeBody } from '../components/meals'
import { asMultiline, formatProteins } from '../lib/format'
import { saveRecipe, deleteRecipe, bulkSaveRecipes } from '../lib/db'
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
  ratingMeta,
} from '../lib/catalog'
import { normalize } from '../lib/ingredients'

export default function CatalogView({ recipes, loading, menus, stats }) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('todos')
  const [category, setCategory] = useState('todas')
  const [sort, setSort] = useState('sugerido')
  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null) // 'new' | recipe
  const [syncing, setSyncing] = useState(false)

  const list = useMemo(() => {
    let l = recipes
    if (type !== 'todos') l = l.filter((r) => (r.type || 'comida') === type)
    if (category !== 'todas') l = l.filter((r) => (r.category || guessCategory(r.name)) === category)
    if (search.trim()) {
      const q = normalize(search)
      l = l.filter(
        (r) => normalize(r.name).includes(q) || normalize(formatProteins(r.proteins)).includes(q)
      )
    }
    return sortRecipes(l, sort, stats)
  }, [recipes, type, category, search, sort, stats])

  /* Carga el repertorio inicial + completa recetas desde los menús guardados */
  async function syncAll() {
    setSyncing(true)
    try {
      const byName = new Map(recipes.map((r) => [normalize(r.name), r]))
      const toSave = []

      // 1. Repertorio base que aún no exista
      for (const seed of SEED_RECIPES) {
        if (!byName.has(normalize(seed.name))) {
          toSave.push(seed)
          byName.set(normalize(seed.name), seed)
        }
      }

      // 2. Platos que aparecen en menús guardados
      for (const menu of menus || []) {
        for (const d of menu.days || []) {
          for (const t of ['lunch', 'dinner']) {
            const meal = d[t]
            if (!meal || !meal.name) continue
            const key = normalize(meal.name)
            const existing = byName.get(key)
            if (!existing) {
              const r = mealToRecipe(meal, t)
              const safeId =
                'r-' +
                (key.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 52) ||
                  Math.random().toString(36).slice(2, 8))
              const withId = { ...r, id: safeId }
              toSave.push(withId)
              byName.set(key, withId)
            } else if (!existing.recipe && meal.recipe) {
              // Completa la receta que faltaba
              toSave.push({
                id: existing.id,
                name: existing.name,
                recipe: meal.recipe,
                calories: existing.calories ?? meal.calories ?? null,
                proteins: existing.proteins ?? meal.proteins ?? null,
              })
              byName.set(key, { ...existing, recipe: meal.recipe })
            }
          }
        }
      }

      if (!toSave.length) {
        alert('Todo estaba ya sincronizado.')
      } else {
        await bulkSaveRecipes(toSave)
        alert(`Listo: ${toSave.length} recetas añadidas o completadas.`)
      }
    } catch (e) {
      alert('Error al sincronizar: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <Loading />

  const withRecipe = recipes.filter((r) => r.recipe).length

  return (
    <div className="animate-fade-in-up">
      <Header />
      <div className="px-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display text-3xl text-ink-900">Recetario</h1>
          <button
            onClick={() => setEditing('new')}
            className="text-terracotta-600 text-sm font-medium"
          >
            + Nueva
          </button>
        </div>
        <p className="text-sm text-ink-500 mb-4">
          {recipes.length} platos · {withRecipe} con receta completa
        </p>

        <button
          onClick={syncAll}
          disabled={syncing}
          className="w-full mb-5 py-2.5 rounded-2xl bg-teal-50 text-teal-700 text-sm font-medium active:bg-teal-100 disabled:opacity-50"
        >
          {syncing ? 'Sincronizando…' : '🔄 Cargar repertorio y completar desde los menús'}
        </button>

        {/* Filtros */}
        <div className="space-y-2.5 mb-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar plato…"
            className="input"
          />
          <div className="flex gap-2">
            <Chip active={type === 'todos'} onClick={() => setType('todos')}>
              Todo
            </Chip>
            {MEAL_TYPES.map((t) => (
              <Chip key={t.key} active={type === t.key} onClick={() => setType(t.key)}>
                {t.icon} {t.label}s
              </Chip>
            ))}
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
              recipes.length
                ? 'Prueba con otro filtro.'
                : 'Pulsa el botón de arriba para cargar todo el repertorio de golpe.'
            }
          />
        ) : (
          <div className="space-y-2 pb-6">
            {list.map((r) => (
              <RecipeRow key={r.id} recipe={r} stats={stats} onClick={() => setDetail(r)} />
            ))}
          </div>
        )}
      </div>

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
      alert('Error al guardar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm(`¿Eliminar "${recipe.name}" del recetario?`)) return
    setSaving(true)
    try {
      await deleteRecipe(recipe.id)
      onClose()
    } catch (e) {
      alert('Error al eliminar: ' + e.message)
    } finally {
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

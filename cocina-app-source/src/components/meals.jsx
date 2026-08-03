import React, { useState, useMemo } from 'react'
import { asMultiline, formatProteins } from '../lib/format'
import { Sheet, Field, Chip, Tag, EmptyState } from './ui'
import {
  DISH_CATEGORIES,
  CATEGORY_META,
  SORT_MODES,
  sortRecipes,
  statsFor,
  lastCookedLabel,
  freshnessTone,
  ratingMeta,
  recipeToMeal,
  guessCategory,
} from '../lib/catalog'

export const MEAL_NOTES = ['Tupper niños', 'Del día anterior', 'Hacer el doble']

/* ============================================================
   TARJETA DE PLATO (vista Hoy)
   ============================================================ */
export function MealCard({ meal, label, onEdit }) {
  const [showRecipe, setShowRecipe] = useState(false)

  if (!meal) {
    return (
      <div className="card p-5 border-2 border-dashed border-cream-300 bg-transparent shadow-none">
        <p className="label-caps text-teal-700 mb-2">{label}</p>
        <p className="text-ink-500 italic">Sin plato asignado</p>
        {onEdit && (
          <button onClick={onEdit} className="mt-3 text-terracotta-600 text-sm font-medium">
            + Añadir plato
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="label-caps text-teal-700">{label}</p>
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-ink-500 text-xs font-medium px-3 py-1 rounded-full bg-cream-200 active:bg-cream-300"
            >
              Editar
            </button>
          )}
        </div>
        <h2 className="font-display text-2xl text-ink-900 leading-tight mb-2">{meal.name}</h2>
        <div className="space-y-1 text-sm">
          {meal.proteins && (
            <p className="text-ink-700">
              <span className="text-ink-500">Proteína: </span>
              {formatProteins(meal.proteins)}
            </p>
          )}
          {meal.calories && (
            <p className="text-ink-700">
              <span className="text-ink-500">Calorías: </span>
              {meal.calories} kcal / persona
            </p>
          )}
          {meal.notes && <p className="text-terracotta-600 italic">{meal.notes}</p>}
        </div>

        {meal.recipe && (
          <button
            onClick={() => setShowRecipe(!showRecipe)}
            className="mt-4 text-terracotta-600 text-sm font-medium"
          >
            {showRecipe ? 'Ocultar receta ▲' : 'Ver receta ▼'}
          </button>
        )}
      </div>

      {showRecipe && meal.recipe && (
        <div className="px-5 pb-5 pt-1 space-y-3 text-sm border-t border-cream-200">
          <RecipeBody recipe={meal.recipe} />
        </div>
      )}
    </div>
  )
}

export function RecipeBody({ recipe }) {
  if (!recipe) return <p className="text-ink-500 italic text-sm">Sin receta guardada todavía.</p>
  return (
    <>
      {recipe.method && (
        <p className="text-ink-700">
          <span className="label-caps text-teal-700 mr-2">Método</span>
          {recipe.method}
        </p>
      )}
      {recipe.ingredients && (
        <div>
          <p className="label-caps text-teal-700 mb-1.5 mt-3">Ingredientes</p>
          <div className="text-ink-700 whitespace-pre-line leading-relaxed">
            {asMultiline(recipe.ingredients)}
          </div>
        </div>
      )}
      {recipe.steps && (
        <div>
          <p className="label-caps text-teal-700 mb-1.5 mt-3">Pasos</p>
          <div className="text-ink-700 whitespace-pre-line leading-relaxed">
            {asMultiline(recipe.steps)}
          </div>
        </div>
      )}
    </>
  )
}

/* ============================================================
   SELECTOR DE PLATO DESDE EL RECETARIO
   ============================================================ */
export function MealPicker({ recipes, stats, mealType, dayLabel, onPick, onManual, onClose }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [sort, setSort] = useState('sugerido')
  const [onlyType, setOnlyType] = useState(true)

  const list = useMemo(() => {
    let l = recipes
    if (onlyType) {
      const want = mealType === 'lunch' ? 'comida' : 'cena'
      l = l.filter((r) => !r.type || r.type === want || r.type === 'ambas')
    }
    if (category !== 'todas') l = l.filter((r) => (r.category || guessCategory(r.name)) === category)
    if (search.trim()) {
      const q = search.toLowerCase()
      l = l.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          formatProteins(r.proteins).toLowerCase().includes(q)
      )
    }
    return sortRecipes(l, sort, stats)
  }, [recipes, stats, onlyType, mealType, category, search, sort])

  const usedCats = useMemo(() => {
    const set = new Set(recipes.map((r) => r.category || guessCategory(r.name)))
    return DISH_CATEGORIES.filter((c) => set.has(c.key))
  }, [recipes])

  return (
    <Sheet
      title={`${mealType === 'lunch' ? 'Comida' : 'Cena'}${dayLabel ? ' · ' + dayLabel : ''}`}
      onClose={onClose}
      onCloseLabel="Cancelar"
      action={
        <button onClick={onManual} className="text-terracotta-600 text-sm font-semibold">
          A mano
        </button>
      }
      tall
    >
      <div className="px-5 pt-4 pb-2 space-y-3 sticky top-[57px] bg-cream-50 z-10 border-b border-cream-200">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar plato…"
          className="input"
        />
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          <Chip active={category === 'todas'} onClick={() => setCategory('todas')} tone="teal">
            Todas
          </Chip>
          {usedCats.map((c) => (
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
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input py-2 text-sm flex-1"
          >
            {SORT_MODES.map((m) => (
              <option key={m.key} value={m.key}>
                Orden: {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setOnlyType((v) => !v)}
            className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium ${
              onlyType ? 'bg-teal-600 text-cream-50' : 'bg-cream-200 text-ink-700'
            }`}
          >
            {mealType === 'lunch' ? 'Solo comidas' : 'Solo cenas'}
          </button>
        </div>
      </div>

      <div className="p-5 pt-3 space-y-2">
        {!list.length ? (
          <EmptyState title="Sin resultados" hint="Prueba con otro filtro o crea el plato a mano." />
        ) : (
          list.map((r) => (
            <RecipeRow key={r.id} recipe={r} stats={stats} onClick={() => onPick(recipeToMeal(r))} />
          ))
        )}
      </div>
    </Sheet>
  )
}

/* Fila de plato con su historial de uso */
export function RecipeRow({ recipe, stats, onClick, right }) {
  const s = statsFor(stats, recipe.name)
  const cat = CATEGORY_META[recipe.category || guessCategory(recipe.name)] || CATEGORY_META.otro
  const rt = ratingMeta(recipe.rating)
  const tone = freshnessTone(s.daysAgo)
  const toneCls = {
    recent: 'text-terracotta-600',
    mid: 'text-ink-500',
    old: 'text-teal-700',
    new: 'text-teal-700',
  }[tone]

  return (
    <button onClick={onClick} className="card w-full text-left p-4 active:bg-cream-200">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5" aria-hidden>
          {cat.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="font-display text-lg text-ink-900 leading-tight flex-1">{recipe.name}</p>
            {rt.short && <span className="shrink-0 text-sm">{rt.short}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
            <span className={toneCls}>🕘 {lastCookedLabel(s.daysAgo)}</span>
            <span className="text-ink-500">
              🔁 {s.count} {s.count === 1 ? 'vez' : 'veces'}
            </span>
            {recipe.calories && <span className="text-ink-500">🔥 {recipe.calories} kcal</span>}
            {!recipe.recipe && <Tag tone="warn">Sin receta</Tag>}
          </div>
        </div>
        {right}
      </div>
    </button>
  )
}

/* ============================================================
   FICHA DEL PLATO YA ASIGNADO (con acciones)
   ============================================================ */
export function MealDetail({ meal, mealType, dayLabel, onClose, onChange, onSetNote, onManual, onRemove }) {
  return (
    <Sheet title={meal.name} onClose={onClose}>
      <div className="p-5 space-y-4">
        <p className="text-sm text-ink-500">
          {dayLabel} · {mealType === 'lunch' ? 'Comida' : 'Cena'}
        </p>

        <div className="flex flex-wrap gap-2">
          {meal.proteins && <Tag tone="soft">🥩 {formatProteins(meal.proteins)}</Tag>}
          {meal.calories && <Tag tone="soft">🔥 {meal.calories} kcal</Tag>}
          {meal.notes && <Tag tone="warn">{meal.notes}</Tag>}
        </div>

        <div>
          <p className="label-caps text-teal-700 mb-2">Nota del día</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={!meal.notes} onClick={() => onSetNote(null)}>
              Sin nota
            </Chip>
            {MEAL_NOTES.map((n) => (
              <Chip key={n} active={meal.notes === n} onClick={() => onSetNote(n)}>
                {n}
              </Chip>
            ))}
          </div>
        </div>

        <div className="border-t border-cream-200 pt-4 text-sm space-y-3">
          <RecipeBody recipe={meal.recipe} />
        </div>

        <div className="space-y-2 pt-2">
          <button onClick={onChange} className="btn-primary w-full">
            Cambiar plato
          </button>
          <button
            onClick={onManual}
            className="w-full py-3 rounded-2xl border border-cream-300 text-ink-700 font-medium active:bg-cream-200"
          >
            Editar receta de este día
          </button>
          <button
            onClick={onRemove}
            className="w-full py-3 text-terracotta-700 text-sm font-medium border border-terracotta-300 rounded-2xl active:bg-terracotta-50"
          >
            Quitar plato
          </button>
        </div>
      </div>
    </Sheet>
  )
}

/* ============================================================
   EDICIÓN MANUAL DE UN PLATO CONCRETO DEL MENÚ
   ============================================================ */
export function ManualMealEditor({ meal, mealType, dayLabel, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    name: meal?.name || '',
    proteins: formatProteins(meal?.proteins),
    calories: meal?.calories ?? '',
    notes: meal?.notes || '',
    method: meal?.recipe?.method || '',
    ingredients: asMultiline(meal?.recipe?.ingredients),
    steps: asMultiline(meal?.recipe?.steps),
  }))
  const [saving, setSaving] = useState(false)
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...(meal || {}),
        name: form.name.trim(),
        proteins: form.proteins.trim() || null,
        calories: form.calories === '' ? null : parseInt(form.calories, 10),
        notes: form.notes.trim() || null,
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

  return (
    <Sheet
      title={`${dayLabel} · ${mealType === 'lunch' ? 'Comida' : 'Cena'}`}
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
            placeholder="Ej: Merluza al horno"
            className="input"
          />
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
        <Field label="Nota">
          <div className="flex flex-wrap gap-2">
            <Chip active={!form.notes} onClick={() => up('notes', '')}>
              Sin nota
            </Chip>
            {MEAL_NOTES.map((n) => (
              <Chip key={n} active={form.notes === n} onClick={() => up('notes', n)}>
                {n}
              </Chip>
            ))}
          </div>
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
          <Field label="Ingredientes" hint="Uno por línea. Se usan para la lista de la compra.">
            <textarea
              value={form.ingredients}
              onChange={(e) => up('ingredients', e.target.value)}
              rows={7}
              placeholder={'600 g de merluza\n2 pimientos rojos\n1 cebolla'}
              className="input resize-none"
            />
          </Field>
          <Field label="Pasos">
            <textarea
              value={form.steps}
              onChange={(e) => up('steps', e.target.value)}
              rows={7}
              placeholder="🔧 Método: …"
              className="input resize-none"
            />
          </Field>
        </div>
      </div>
    </Sheet>
  )
}

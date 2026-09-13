import React, { useState, useMemo } from 'react'
import { asMultiline, formatProteins } from '../lib/format'
import { Sheet, Field, Chip, Tag, EmptyState, useToast } from './ui'
import {
  DISH_CATEGORIES,
  CATEGORY_META,
  SORT_MODES,
  RATINGS,
  sortRecipes,
  statsFor,
  lastCookedLabel,
  freshnessTone,
  ratingMeta,
  recipeToMeal,
  mealToRecipe,
  findRecipeForMeal,
  isNewRecipe,
  guessCategory,
} from '../lib/catalog'
import { asDishes, slotCalories } from '../lib/dishes'
import { saveRecipe } from '../lib/db'
import { normalize } from '../lib/ingredients'

export const MEAL_NOTES = ['Tupper niños', 'Del día anterior', 'Hacer el doble']

/* ============================================================
   TARJETA DE UN HUECO (vista Hoy)

   Un hueco puede llevar varios platos. Se enseñan todos, y las
   calorías que se muestran son la suma de los que las tengan.
   ============================================================ */
export function MealCard({ slot, label, onEdit }) {
  const [showRecipe, setShowRecipe] = useState(false)
  const platos = asDishes(slot)

  if (!platos.length) {
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

  const kcal = slotCalories(slot)
  const conReceta = platos.filter((p) => p.recipe)

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

        <div className="space-y-3">
          {platos.map((meal, i) => (
            <div key={i}>
              <h2 className="font-display text-2xl text-ink-900 leading-tight">{meal.name}</h2>
              <div className="space-y-0.5 text-sm mt-1">
                {meal.proteins && (
                  <p className="text-ink-700">
                    <span className="text-ink-500">Proteína: </span>
                    {formatProteins(meal.proteins)}
                  </p>
                )}
                {meal.notes && <p className="text-terracotta-600 italic">{meal.notes}</p>}
              </div>
            </div>
          ))}
        </div>

        {kcal != null && (
          <p className="text-sm text-ink-700 mt-3">
            <span className="text-ink-500">
              {platos.length > 1 ? 'Calorías en total: ' : 'Calorías: '}
            </span>
            {kcal} kcal / persona
          </p>
        )}

        {conReceta.length > 0 && (
          <button
            onClick={() => setShowRecipe(!showRecipe)}
            className="mt-4 text-terracotta-600 text-sm font-medium"
          >
            {showRecipe
              ? 'Ocultar receta ▲'
              : conReceta.length > 1
                ? 'Ver recetas ▼'
                : 'Ver receta ▼'}
          </button>
        )}
      </div>

      {showRecipe && conReceta.length > 0 && (
        <div className="px-5 pb-5 pt-1 space-y-4 text-sm border-t border-cream-200">
          {conReceta.map((meal, i) => (
            <div key={i} className="space-y-3">
              {conReceta.length > 1 && (
                <p className="font-display text-lg text-ink-900 pt-2">{meal.name}</p>
              )}
              <RecipeBody recipe={meal.recipe} />
            </div>
          ))}
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
export function MealPicker({
  recipes,
  stats,
  mealType,
  dayLabel,
  anadiendo,
  onPick,
  onManual,
  onClose,
}) {
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
      // normalize() quita acentos: "salmon" tiene que encontrar "Salmón"
      const q = normalize(search)
      l = l.filter(
        (r) =>
          normalize(r.name).includes(q) || normalize(formatProteins(r.proteins)).includes(q)
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
      title={
        anadiendo
          ? 'Añadir otro plato'
          : `${mealType === 'lunch' ? 'Comida' : 'Cena'}${dayLabel ? ' · ' + dayLabel : ''}`
      }
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
            {isNewRecipe(recipe) && <Tag tone="teal">✨ Nueva</Tag>}
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
   VALORACIÓN DE UN PLATO DESDE EL MENÚ

   La valoración vive en la receta del recetario, no en el plato del
   menú. Los platos elegidos del recetario llevan `recipeId`; los
   escritos a mano no, así que se busca por nombre y, si tampoco
   está, se ofrece guardarlo antes de poder valorarlo.
   ============================================================ */
function DishRating({ meal, mealType, recipes }) {
  const avisar = useToast()
  const [guardando, setGuardando] = useState(false)
  const receta = useMemo(() => findRecipeForMeal(meal, recipes), [meal, recipes])

  async function valorar(valor) {
    setGuardando(true)
    try {
      await saveRecipe(receta.id, { name: receta.name, rating: valor })
    } catch (e) {
      avisar('No se ha podido valorar: ' + (e?.message || e), 'error')
    } finally {
      setGuardando(false)
    }
  }

  async function guardarEnRecetario() {
    setGuardando(true)
    try {
      await saveRecipe(null, mealToRecipe(meal, mealType))
      avisar('Guardado en el recetario, ya puedes valorarlo', 'ok')
    } catch (e) {
      avisar('No se ha podido guardar: ' + (e?.message || e), 'error')
    } finally {
      setGuardando(false)
    }
  }

  if (!receta) {
    return (
      <div>
        <p className="label-caps text-teal-700 mb-1.5">Valoración</p>
        <p className="text-xs text-ink-500 mb-2">
          Este plato no está en el recetario, que es donde se guarda la valoración.
        </p>
        <button
          onClick={guardarEnRecetario}
          disabled={guardando}
          className="text-sm px-4 py-2 rounded-full bg-teal-50 text-teal-700 font-medium active:bg-teal-100 disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : '+ Guardar en el recetario'}
        </button>
      </div>
    )
  }

  const valor = receta.rating ?? 0

  return (
    <div>
      <p className="label-caps text-teal-700 mb-1.5">Valoración</p>
      <div className={`flex flex-wrap gap-2 ${guardando ? 'opacity-50' : ''}`}>
        {RATINGS.map((r) => (
          <Chip key={r.value} active={valor === r.value} onClick={() => valorar(r.value)}>
            {r.icon} {r.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   FICHA DE UN HUECO YA OCUPADO

   Lista los platos que tiene, con sus acciones por plato, y deja
   añadir otro: "carne torrada + ensalada de tomate".
   ============================================================ */
export function SlotDetail({
  slot,
  mealType,
  dayLabel,
  recipes,
  stats,
  onClose,
  onChangeDish,
  onAddDish,
  onEditDish,
  onSetNote,
  onRemoveDish,
}) {
  const platos = asDishes(slot)
  const kcal = slotCalories(slot)
  const titulo = mealType === 'lunch' ? 'Comida' : 'Cena'

  return (
    <Sheet title={`${titulo}${dayLabel ? ' · ' + dayLabel : ''}`} onClose={onClose} tall>
      <div className="p-5 space-y-4">
        {platos.length > 1 && kcal != null && (
          <p className="text-sm text-ink-500">
            {platos.length} platos · {kcal} kcal en total por persona
          </p>
        )}

        {platos.map((meal, index) => (
          <DishCard
            key={index}
            meal={meal}
            index={index}
            mealType={mealType}
            recipes={recipes}
            stats={stats}
            unico={platos.length === 1}
            onChange={() => onChangeDish(index)}
            onEdit={() => onEditDish(index)}
            onSetNote={(note) => onSetNote(index, note)}
            onRemove={() => onRemoveDish(index)}
          />
        ))}

        <button
          onClick={onAddDish}
          className="w-full py-3 rounded-2xl bg-teal-50 text-teal-700 font-medium active:bg-teal-100"
        >
          + Añadir otro plato a esta {titulo.toLowerCase()}
        </button>
      </div>
    </Sheet>
  )
}

function DishCard({ meal, mealType, recipes, stats, unico, onChange, onEdit, onSetNote, onRemove }) {
  const [verReceta, setVerReceta] = useState(false)
  const s = statsFor(stats, meal.name)

  return (
    <div className="card p-4 space-y-3">
      <div>
        <h3 className="font-display text-xl text-ink-900 leading-tight">{meal.name}</h3>
        <div className="flex flex-wrap gap-2 mt-2">
          {meal.proteins && <Tag tone="soft">🥩 {formatProteins(meal.proteins)}</Tag>}
          {meal.calories && <Tag tone="soft">🔥 {meal.calories} kcal</Tag>}
          <Tag>🕘 {lastCookedLabel(s.daysAgo)}</Tag>
          {meal.notes && <Tag tone="warn">{meal.notes}</Tag>}
        </div>
      </div>

      <DishRating meal={meal} mealType={mealType} recipes={recipes} />

      <div>
        <p className="label-caps text-teal-700 mb-1.5">Nota del día</p>
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

      {meal.recipe && (
        <div>
          <button
            onClick={() => setVerReceta((v) => !v)}
            className="text-terracotta-600 text-sm font-medium"
          >
            {verReceta ? 'Ocultar receta ▲' : 'Ver receta ▼'}
          </button>
          {verReceta && (
            <div className="mt-3 pt-3 border-t border-cream-200 text-sm space-y-3">
              <RecipeBody recipe={meal.recipe} />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={onChange}
          className="flex-1 min-w-[7rem] py-2.5 rounded-full bg-terracotta-500 text-cream-50 text-sm font-medium active:bg-terracotta-600"
        >
          Cambiar
        </button>
        <button
          onClick={onEdit}
          className="flex-1 min-w-[7rem] py-2.5 rounded-full border border-cream-300 text-ink-700 text-sm font-medium active:bg-cream-200"
        >
          Editar receta
        </button>
        <button
          onClick={onRemove}
          className="flex-1 min-w-[7rem] py-2.5 rounded-full border border-terracotta-300 text-terracotta-700 text-sm font-medium active:bg-terracotta-50"
        >
          {unico ? 'Quitar plato' : 'Quitar'}
        </button>
      </div>
    </div>
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
  const avisar = useToast()
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
      avisar('Error al guardar: ' + (e?.message || e), 'error')
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

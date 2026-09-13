/* ============================================================
   CATÁLOGO DE RECETAS
   Categorías por ingrediente principal, valoración, estadísticas
   de uso (veces cocinado / última vez) y ordenaciones.
   ============================================================ */
import { normalize } from './ingredients'
import { dateForDay, daysUntil } from './dates'
import { forEachDish } from './dishes'

/* ---------- TIPO DE COMIDA ---------- */
export const MEAL_TYPES = [
  { key: 'comida', label: 'Comida', icon: '☀️' },
  { key: 'cena', label: 'Cena', icon: '🌙' },
]

/* ---------- CATEGORÍA POR INGREDIENTE PRINCIPAL ---------- */
export const DISH_CATEGORIES = [
  {
    key: 'ensalada',
    label: 'Ensaladas',
    icon: '🥗',
    keywords: ['ensalada', 'ensaladilla', 'bowl', 'caprese', 'carpaccio', 'templada'],
  },
  {
    key: 'pescado',
    label: 'Pescado y marisco',
    icon: '🐟',
    keywords: ['salmón', 'salmon', 'merluza', 'bacalao', 'dorada', 'orada', 'lubina', 'rape', 'sepia', 'calamar', 'pulpo', 'gambas', 'atún', 'atun', 'moluscos', 'almejas', 'mejillones', 'brandada', 'pescado', 'vizcaína', 'vizcaina', 'mallorquina', 'papillote limón'],
  },
  {
    key: 'carne',
    label: 'Carne y aves',
    icon: '🍗',
    keywords: ['pollo', 'pavo', 'ternera', 'cerdo', 'conejo', 'carne', 'albóndigas', 'albondigas', 'hamburguesa', 'solomillo', 'contramuslo', 'muslito', 'jamoncito', 'boloñesa', 'bolonesa', 'shawarma', 'fajitas', 'tacos', 'pizzaiola', 'torrada'],
  },
  {
    key: 'pasta',
    label: 'Pasta',
    icon: '🍝',
    keywords: ['pasta', 'espagueti', 'espaguetis', 'macarrones', 'lasaña', 'lasana', 'fideos', 'canelones'],
  },
  {
    key: 'arroz',
    label: 'Arroz y cereales',
    icon: '🍚',
    keywords: ['arroz', 'quinoa', 'risotto', 'basmati', 'cuscús', 'cuscus'],
  },
  {
    key: 'legumbres',
    label: 'Legumbres',
    icon: '🫘',
    keywords: ['lenteja', 'garbanzo', 'alubia', 'judía blanca', 'judia blanca'],
  },
  {
    key: 'huevos',
    label: 'Huevos',
    icon: '🥚',
    keywords: ['huevo', 'tortilla', 'revuelto', 'pastel', 'hojaldre'],
  },
  {
    key: 'crema',
    label: 'Cremas y sopas',
    icon: '🥣',
    keywords: ['crema', 'sopa', 'puré', 'pure', 'gazpacho', 'caldo'],
  },
  {
    key: 'verduras',
    label: 'Verduras',
    icon: '🥦',
    keywords: ['verdura', 'pisto', 'salteado', 'calabacín', 'calabacin', 'musaka', 'pimientos rellenos', 'padrón', 'padron', 'espárrago', 'esparrago', 'espinacas'],
  },
]

export const CATEGORY_META = Object.fromEntries(
  DISH_CATEGORIES.map((c) => [c.key, c])
)
CATEGORY_META.otro = { key: 'otro', label: 'Otros', icon: '🍽️' }

/* Adivina la categoría a partir del nombre del plato */
export function guessCategory(name) {
  const n = normalize(name)
  if (!n) return 'otro'
  for (const c of DISH_CATEGORIES) {
    if (c.keywords.some((k) => n.includes(normalize(k)))) return c.key
  }
  return 'otro'
}

/* ---------- VALORACIÓN ---------- */
export const RATINGS = [
  { value: 2, label: 'Favorito', icon: '⭐', short: '⭐' },
  { value: 1, label: 'Nos gusta', icon: '👍', short: '👍' },
  { value: 0, label: 'Sin valorar', icon: '·', short: '' },
  { value: -1, label: 'No repetir tanto', icon: '👎', short: '👎' },
]

export function ratingMeta(value) {
  return RATINGS.find((r) => r.value === (value ?? 0)) || RATINGS[2]
}

/* ---------- ESTADÍSTICAS DE USO ---------- */

/* Recorre todos los menús guardados y calcula, por plato:
   - veces cocinado
   - fecha de la última vez
   - días desde entonces  */
export function computeUsageStats(menus) {
  const stats = new Map()
  const today = new Date()

  for (const menu of menus || []) {
    const wid = menu.id
    // Cada plato cuenta por separado: si un día hubo carne torrada y
    // ensalada, las dos se han cocinado ese día.
    forEachDish(menu, (meal, { dayIndex, mealType }) => {
      const key = normalize(meal.name)
      let when = null
      try {
        when = dateForDay(wid, dayIndex)
      } catch (e) {
        when = null
      }
      // No contar días futuros como "ya cocinado"
      if (when && when.getTime() > today.getTime() + 86400000) return

      const prev = stats.get(key) || { count: 0, last: null, lastType: null }
      prev.count += 1
      if (when && (!prev.last || when > prev.last)) {
        prev.last = when
        prev.lastType = mealType
      }
      stats.set(key, prev)
    })
  }

  for (const [, v] of stats) {
    // Días naturales, no milisegundos: restando las fechas en crudo,
    // un plato cocinado hoy pasaba a "Ayer" en cuanto se cumplían
    // doce horas desde la medianoche UTC de ese día.
    const dias = v.last ? -daysUntil(v.last) : null
    v.daysAgo = dias == null ? null : Math.max(0, dias)
  }
  return stats
}

export function statsFor(stats, name) {
  return stats.get(normalize(name)) || { count: 0, last: null, daysAgo: null }
}

/* Etiqueta legible del "hace cuánto" */
export function lastCookedLabel(daysAgo) {
  if (daysAgo == null) return 'Nunca'
  if (daysAgo <= 0) return 'Hoy'
  if (daysAgo === 1) return 'Ayer'
  if (daysAgo < 14) return `Hace ${daysAgo} días`
  const weeks = Math.round(daysAgo / 7)
  if (weeks < 9) return `Hace ${weeks} sem`
  const months = Math.round(daysAgo / 30)
  return `Hace ${months} mes${months === 1 ? '' : 'es'}`
}

/* Color del indicador de frescura: rojo = muy reciente */
export function freshnessTone(daysAgo) {
  if (daysAgo == null) return 'new'
  if (daysAgo <= 10) return 'recent'
  if (daysAgo <= 25) return 'mid'
  return 'old'
}

/* ---------- ORDENACIONES ---------- */
export const SORT_MODES = [
  { key: 'sugerido', label: 'Sugerido' },
  { key: 'antiguo', label: 'Hace más tiempo' },
  { key: 'reciente', label: 'Cocinado hace poco' },
  { key: 'frecuente', label: 'Más cocinado' },
  { key: 'raro', label: 'Menos cocinado' },
  { key: 'ranking', label: 'Mejor valorado' },
  { key: 'alfabetico', label: 'A – Z' },
  { key: 'kcal_asc', label: 'Menos calorías' },
  { key: 'kcal_desc', label: 'Más calorías' },
]

/* "Sugerido" = mezcla valoración con tiempo sin cocinarse.
   Sube lo que gusta y lleva tiempo sin salir; baja lo recién hecho. */
export function suggestionScore(recipe, s) {
  const rating = recipe.rating ?? 0
  const daysAgo = s.daysAgo == null ? 120 : Math.min(s.daysAgo, 120)
  let score = daysAgo / 7 // semanas sin cocinar
  score += rating * 3
  if (s.daysAgo != null && s.daysAgo < 10) score -= 12 // penaliza repetir muy seguido
  return score
}

export function sortRecipes(list, mode, stats) {
  const arr = [...list]
  const s = (r) => statsFor(stats, r.name)
  const az = (a, b) => (a.name || '').localeCompare(b.name || '', 'es')

  switch (mode) {
    case 'antiguo':
      return arr.sort((a, b) => {
        const da = s(a).daysAgo ?? 9999
        const db_ = s(b).daysAgo ?? 9999
        return db_ - da || az(a, b)
      })
    case 'reciente':
      return arr.sort((a, b) => {
        const da = s(a).daysAgo ?? 9999
        const db_ = s(b).daysAgo ?? 9999
        return da - db_ || az(a, b)
      })
    case 'frecuente':
      return arr.sort((a, b) => s(b).count - s(a).count || az(a, b))
    case 'raro':
      return arr.sort((a, b) => s(a).count - s(b).count || az(a, b))
    case 'ranking':
      return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || az(a, b))
    case 'alfabetico':
      return arr.sort(az)
    case 'kcal_asc':
      return arr.sort((a, b) => (a.calories ?? 99999) - (b.calories ?? 99999) || az(a, b))
    case 'kcal_desc':
      return arr.sort((a, b) => (b.calories ?? -1) - (a.calories ?? -1) || az(a, b))
    case 'sugerido':
    default:
      return arr.sort(
        (a, b) => suggestionScore(b, s(b)) - suggestionScore(a, s(a)) || az(a, b)
      )
  }
}

/* ---------- CONVERSIONES ---------- */

/* Receta del catálogo → objeto "meal" del menú semanal */
export function recipeToMeal(recipe) {
  if (!recipe) return null
  return {
    name: recipe.name,
    proteins: recipe.proteins || null,
    calories: recipe.calories ?? null,
    notes: null,
    recipeId: recipe.id || null,
    recipe: recipe.recipe || null,
  }
}

/* Plato de un menú → receta de catálogo (para sincronizar históricos) */
export function mealToRecipe(meal, type) {
  return {
    name: meal.name,
    type: type === 'lunch' ? 'comida' : 'cena',
    category: guessCategory(meal.name),
    proteins: meal.proteins || null,
    calories: meal.calories ?? null,
    rating: 0,
    recipe: meal.recipe || null,
    source: 'menú semanal',
  }
}

/* ============================================================
   RECETA VIVA

   Cada plato del menú guarda una copia de la receta del momento en
   que se eligió. Si esa receta sigue en el recetario, manda la del
   recetario: es la que el usuario edita, y es la que debe alimentar
   la lista de la compra. La copia guardada queda como respaldo para
   los platos cuya receta ya se borró.

   Es solo una capa de presentación: nunca se escribe de vuelta.
   ============================================================ */

export function indexRecipesById(recipes) {
  return new Map((recipes || []).filter((r) => r.id).map((r) => [r.id, r]))
}

export function withLiveRecipe(meal, recipesById) {
  if (!meal || !meal.recipeId || !recipesById) return meal
  const viva = recipesById.get(meal.recipeId)
  if (!viva || !viva.recipe) return meal
  return {
    ...meal,
    recipe: viva.recipe,
    calories: viva.calories ?? meal.calories ?? null,
    proteins: viva.proteins ?? meal.proteins ?? null,
  }
}

/* Un hueco entero, conservando su forma (objeto suelto o lista) */
function withLiveSlot(slot, recipesById) {
  if (!slot) return slot
  if (!Array.isArray(slot)) return withLiveRecipe(slot, recipesById)
  return slot.map((d) => withLiveRecipe(d, recipesById))
}

export function withLiveRecipes(menu, recipesById) {
  if (!menu?.days || !recipesById?.size) return menu
  return {
    ...menu,
    days: menu.days.map((d) => ({
      ...d,
      lunch: withLiveSlot(d.lunch, recipesById),
      dinner: withLiveSlot(d.dinner, recipesById),
    })),
  }
}

/* Busca en el recetario la receta de un plato del menú: primero por
   identificador y, si el plato se escribió a mano, por nombre. */
export function findRecipeForMeal(meal, recipes) {
  if (!meal || !recipes?.length) return null
  if (meal.recipeId) {
    const porId = recipes.find((r) => r.id === meal.recipeId)
    if (porId) return porId
  }
  const clave = normalize(meal.name)
  return recipes.find((r) => normalize(r.name) === clave) || null
}

/* ============================================================
   PLATOS QUE ESTÁN EN USO

   Antes de borrar recetas conviene saber cuáles aparecen en alguna
   semana guardada. No es un impedimento —el menú conserva su propia
   copia de la receta y el histórico de cocinado vive en los menús,
   no aquí— pero sí es algo que avisar antes de borrar en lote.
   ============================================================ */
export function menuReferences(menus) {
  const ids = new Set()
  const nombres = new Set()
  for (const menu of menus || []) {
    forEachDish(menu, (meal) => {
      if (meal.recipeId) ids.add(meal.recipeId)
      if (meal.name) nombres.add(normalize(meal.name))
    })
  }
  return { ids, nombres }
}

/* ¿Esta receta del recetario se usa en algún menú guardado? */
export function isRecipeUsed(recipe, referencias) {
  if (!recipe || !referencias) return false
  if (recipe.id && referencias.ids.has(recipe.id)) return true
  return referencias.nombres.has(normalize(recipe.name))
}

/* ¿Esta receta trae receta de verdad?

   No basta con que exista el objeto `recipe`: puede venir con las
   claves a null. Lo que la hace útil es tener ingredientes o pasos.
   Los platos que solo son un nombre son los que ensucian el
   recetario cuando se completa desde los menús. */
export function hasRecipeBody(recipe) {
  const cuerpo = recipe?.recipe
  if (!cuerpo) return false
  const tiene = (v) => (Array.isArray(v) ? v.length > 0 : !!String(v || '').trim())
  return tiene(cuerpo.ingredients) || tiene(cuerpo.steps)
}

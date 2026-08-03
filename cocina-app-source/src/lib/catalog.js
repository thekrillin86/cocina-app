/* ============================================================
   CATÁLOGO DE RECETAS
   Categorías por ingrediente principal, valoración, estadísticas
   de uso (veces cocinado / última vez) y ordenaciones.
   ============================================================ */
import { normalize } from './ingredients'
import { dateForDay, parseWeekId } from './dates'

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
    keywords: ['ensalada', 'ensaladilla', 'bowl', 'bol ', 'caprese', 'carpaccio', 'templada'],
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
    ;(menu.days || []).forEach((d, dayIndex) => {
      for (const type of ['lunch', 'dinner']) {
        const meal = d[type]
        if (!meal || !meal.name) continue
        const key = normalize(meal.name)
        let when = null
        try {
          when = dateForDay(wid, dayIndex)
        } catch (e) {
          when = null
        }
        // No contar días futuros como "ya cocinado"
        if (when && when.getTime() > today.getTime() + 86400000) continue

        const prev = stats.get(key) || { count: 0, last: null, lastType: null }
        prev.count += 1
        if (when && (!prev.last || when > prev.last)) {
          prev.last = when
          prev.lastType = type
        }
        stats.set(key, prev)
      }
    })
  }

  for (const [, v] of stats) {
    v.daysAgo = v.last
      ? Math.round((Date.now() - v.last.getTime()) / 86400000)
      : null
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

/* Semana ISO legible: "Semana 32 · 2026" */
export function weekLabel(wid) {
  const { year, week } = parseWeekId(wid)
  return `Semana ${week} · ${year}`
}

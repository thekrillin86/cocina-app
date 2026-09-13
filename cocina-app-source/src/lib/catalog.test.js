import { describe, it, expect } from 'vitest'
import {
  computeUsageStats,
  statsFor,
  lastCookedLabel,
  guessCategory,
  findRecipeForMeal,
  withLiveRecipes,
  indexRecipesById,
  sortRecipes,
  hasRecipeBody,
  isNewRecipe,
  DIAS_NUEVA,
  menuReferences,
  isRecipeUsed,
} from './catalog'
import { currentWeekId, getTodayWeekIndex, weekId, getISOWeek } from './dates'

/* Un menú de la semana en curso, con el plato puesto en el día de hoy */
function menuDeHoy(slot) {
  const dias = Array.from({ length: 7 }, () => ({ lunch: null, dinner: null }))
  dias[getTodayWeekIndex()] = { lunch: slot, dinner: null }
  return { id: currentWeekId(), days: dias }
}

describe('computeUsageStats', () => {
  it('cuenta por separado los dos platos de un mismo hueco', () => {
    const stats = computeUsageStats([
      menuDeHoy([{ name: 'Carne torrada' }, { name: 'Ensalada de tomate' }]),
    ])
    expect(statsFor(stats, 'Carne torrada').count).toBe(1)
    expect(statsFor(stats, 'Ensalada de tomate').count).toBe(1)
  })

  it('un plato de hoy es "Hoy", no "Ayer"', () => {
    // Restando fechas en crudo, a partir del mediodía UTC daba 1 día
    const stats = computeUsageStats([menuDeHoy({ name: 'Tortilla' })])
    const s = statsFor(stats, 'Tortilla')
    expect(s.daysAgo).toBe(0)
    expect(lastCookedLabel(s.daysAgo)).toBe('Hoy')
  })

  it('sigue contando los huecos guardados como objeto suelto', () => {
    const stats = computeUsageStats([menuDeHoy({ name: 'Tortilla' })])
    expect(statsFor(stats, 'Tortilla').count).toBe(1)
  })

  it('no cuenta como cocinado lo que está en el futuro', () => {
    const { year, week } = getISOWeek()
    const futura = {
      id: weekId(year, week + 4),
      days: [{ lunch: { name: 'Plato futuro' }, dinner: null }],
    }
    expect(statsFor(computeUsageStats([futura]), 'Plato futuro').count).toBe(0)
  })

  it('ignora acentos y mayúsculas al agrupar', () => {
    const stats = computeUsageStats([menuDeHoy([{ name: 'Salmón' }, { name: 'salmon' }])])
    expect(statsFor(stats, 'SALMON').count).toBe(2)
  })

  it('aguanta una lista de menús vacía', () => {
    expect(computeUsageStats([]).size).toBe(0)
    expect(computeUsageStats(null).size).toBe(0)
  })
})

describe('lastCookedLabel', () => {
  it('traduce los días a texto', () => {
    expect(lastCookedLabel(null)).toBe('Nunca')
    expect(lastCookedLabel(0)).toBe('Hoy')
    expect(lastCookedLabel(1)).toBe('Ayer')
    expect(lastCookedLabel(5)).toBe('Hace 5 días')
    expect(lastCookedLabel(21)).toBe('Hace 3 sem')
  })
})

describe('findRecipeForMeal', () => {
  const recetario = [
    { id: 'r-1', name: 'Carne torrada', rating: 2 },
    { id: 'r-2', name: 'Ensalada de tomate', rating: 0 },
  ]

  it('encuentra por identificador', () => {
    expect(findRecipeForMeal({ name: 'lo que sea', recipeId: 'r-1' }, recetario).id).toBe('r-1')
  })

  it('cae al nombre cuando el plato se escribió a mano', () => {
    expect(findRecipeForMeal({ name: 'carne torrada' }, recetario).id).toBe('r-1')
    expect(findRecipeForMeal({ name: 'CARNE TORRADA' }, recetario).id).toBe('r-1')
  })

  it('cae al nombre si el identificador ya no existe', () => {
    expect(findRecipeForMeal({ name: 'Carne torrada', recipeId: 'borrada' }, recetario).id).toBe(
      'r-1'
    )
  })

  it('devuelve null si no está en el recetario', () => {
    expect(findRecipeForMeal({ name: 'Plato inventado' }, recetario)).toBeNull()
    expect(findRecipeForMeal(null, recetario)).toBeNull()
  })
})

describe('withLiveRecipes', () => {
  const recetario = indexRecipesById([
    { id: 'r-1', name: 'Carne torrada', recipe: { steps: 'nueva versión' }, calories: 500 },
  ])

  it('usa la receta del recetario en un hueco de un solo plato', () => {
    const menu = {
      days: [
        {
          lunch: { name: 'Carne torrada', recipeId: 'r-1', recipe: { steps: 'vieja' } },
          dinner: null,
        },
      ],
    }
    const vivo = withLiveRecipes(menu, recetario)
    expect(vivo.days[0].lunch.recipe.steps).toBe('nueva versión')
    expect(vivo.days[0].lunch.calories).toBe(500)
  })

  it('conserva la forma del hueco: objeto sigue siendo objeto', () => {
    const menu = { days: [{ lunch: { name: 'Carne torrada', recipeId: 'r-1' }, dinner: null }] }
    expect(Array.isArray(withLiveRecipes(menu, recetario).days[0].lunch)).toBe(false)
  })

  it('conserva la forma del hueco: lista sigue siendo lista', () => {
    const menu = {
      days: [
        {
          lunch: [
            { name: 'Carne torrada', recipeId: 'r-1', recipe: { steps: 'vieja' } },
            { name: 'Ensalada', recipe: { steps: 'suya' } },
          ],
          dinner: null,
        },
      ],
    }
    const vivo = withLiveRecipes(menu, recetario)
    expect(Array.isArray(vivo.days[0].lunch)).toBe(true)
    expect(vivo.days[0].lunch[0].recipe.steps).toBe('nueva versión')
    // El plato que no está en el recetario conserva su copia
    expect(vivo.days[0].lunch[1].recipe.steps).toBe('suya')
  })

  it('deja el menú igual si no hay recetario', () => {
    const menu = { days: [{ lunch: { name: 'X' }, dinner: null }] }
    expect(withLiveRecipes(menu, new Map())).toBe(menu)
  })
})

describe('guessCategory', () => {
  it('adivina por palabras clave del nombre', () => {
    expect(guessCategory('Ensalada de lentejas')).toBe('ensalada')
    expect(guessCategory('Merluza al horno')).toBe('pescado')
    expect(guessCategory('Espaguetis carbonara')).toBe('pasta')
    expect(guessCategory('Chuchería rara')).toBe('otro')
  })

  it('no confunde "boloñesa" con un bol de ensalada', () => {
    // La clave 'bol ' perdía el espacio al normalizar y casaba dentro
    // de "boloñesa", así que la lasaña acababa en Ensaladas
    expect(guessCategory('Lasaña boloñesa con champiñones')).not.toBe('ensalada')
    expect(guessCategory('Espaguetis a la boloñesa')).not.toBe('ensalada')
  })
})

describe('hasRecipeBody', () => {
  it('exige ingredientes o pasos, no solo que exista el objeto', () => {
    expect(hasRecipeBody({ name: 'X', recipe: { ingredients: ['Huevo'] } })).toBe(true)
    expect(hasRecipeBody({ name: 'X', recipe: { steps: ['Batir'] } })).toBe(true)
    expect(hasRecipeBody({ name: 'X', recipe: { ingredients: 'Huevo 2ud' } })).toBe(true)
  })

  it('un cuerpo vacío o con las claves a null no cuenta', () => {
    expect(hasRecipeBody({ name: 'X', recipe: null })).toBe(false)
    expect(hasRecipeBody({ name: 'X' })).toBe(false)
    expect(
      hasRecipeBody({ name: 'X', recipe: { method: 'TM6', ingredients: [], steps: null } })
    ).toBe(false)
    expect(hasRecipeBody({ name: 'X', recipe: { ingredients: '   ' } })).toBe(false)
    expect(hasRecipeBody(null)).toBe(false)
  })
})

describe('isNewRecipe', () => {
  const AHORA = Date.parse('2026-09-13T12:00:00.000Z')
  const haceDias = (d) => new Date(AHORA - d * 86400000).toISOString()

  it('es nueva dentro de la ventana', () => {
    expect(isNewRecipe({ createdAt: haceDias(0) }, DIAS_NUEVA, AHORA)).toBe(true)
    expect(isNewRecipe({ createdAt: haceDias(3) }, DIAS_NUEVA, AHORA)).toBe(true)
    expect(isNewRecipe({ createdAt: haceDias(6.9) }, DIAS_NUEVA, AHORA)).toBe(true)
  })

  it('deja de serlo pasada la ventana', () => {
    expect(isNewRecipe({ createdAt: haceDias(7.1) }, DIAS_NUEVA, AHORA)).toBe(false)
    expect(isNewRecipe({ createdAt: haceDias(40) }, DIAS_NUEVA, AHORA)).toBe(false)
  })

  it('las recetas sin fecha de alta no son nuevas', () => {
    // Son las de antes de que existiera este campo
    expect(isNewRecipe({ name: 'Vieja' }, DIAS_NUEVA, AHORA)).toBe(false)
    expect(isNewRecipe({ createdAt: null }, DIAS_NUEVA, AHORA)).toBe(false)
    expect(isNewRecipe({ createdAt: 'lo que sea' }, DIAS_NUEVA, AHORA)).toBe(false)
    expect(isNewRecipe(null, DIAS_NUEVA, AHORA)).toBe(false)
  })

  it('la ventana se puede cambiar', () => {
    expect(isNewRecipe({ createdAt: haceDias(10) }, 30, AHORA)).toBe(true)
    expect(isNewRecipe({ createdAt: haceDias(10) }, 3, AHORA)).toBe(false)
  })
})

describe('sortRecipes · recién añadidas', () => {
  const stats = new Map()
  const lista = [
    { id: 'a', name: 'Sin fecha' },
    { id: 'b', name: 'Vieja', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'c', name: 'Reciente', createdAt: '2026-09-12T00:00:00.000Z' },
  ]

  it('pone las más recientes delante y las que no tienen fecha al final', () => {
    expect(sortRecipes(lista, 'nuevas', stats).map((r) => r.name)).toEqual([
      'Reciente',
      'Vieja',
      'Sin fecha',
    ])
  })
})

describe('menuReferences e isRecipeUsed', () => {
  const menus = [
    {
      id: '2026-35',
      days: [
        {
          lunch: [
            { name: 'Carne torrada', recipeId: 'r-carne' },
            { name: 'Ensalada de tomate' },
          ],
          dinner: { name: 'Sopa' },
        },
      ],
    },
  ]

  it('recoge identificadores y nombres de todos los platos', () => {
    const ref = menuReferences(menus)
    expect(ref.ids.has('r-carne')).toBe(true)
    expect(ref.nombres.has('ensalada de tomate')).toBe(true)
    expect(ref.nombres.has('sopa')).toBe(true)
  })

  it('reconoce la receta usada por identificador', () => {
    const ref = menuReferences(menus)
    expect(isRecipeUsed({ id: 'r-carne', name: 'Nombre cambiado' }, ref)).toBe(true)
  })

  it('reconoce la receta usada por nombre, sin acentos ni mayúsculas', () => {
    const ref = menuReferences(menus)
    expect(isRecipeUsed({ id: 'otro', name: 'ENSALADA DE TOMATE' }, ref)).toBe(true)
  })

  it('dice que no cuando no se usa en ninguna semana', () => {
    const ref = menuReferences(menus)
    expect(isRecipeUsed({ id: 'x', name: 'Plato que nadie cocinó' }, ref)).toBe(false)
  })

  it('aguanta que no haya menús', () => {
    const ref = menuReferences([])
    expect(ref.ids.size).toBe(0)
    expect(isRecipeUsed({ id: 'x', name: 'Y' }, ref)).toBe(false)
  })
})

describe('sortRecipes', () => {
  const stats = new Map()
  const lista = [
    { id: 'a', name: 'Bacalao', rating: 0 },
    { id: 'b', name: 'Arroz', rating: 2 },
  ]

  it('ordena alfabéticamente', () => {
    expect(sortRecipes(lista, 'alfabetico', stats).map((r) => r.name)).toEqual([
      'Arroz',
      'Bacalao',
    ])
  })

  it('sube los favoritos al ordenar por valoración', () => {
    expect(sortRecipes(lista, 'ranking', stats)[0].name).toBe('Arroz')
  })

  it('no toca la lista original', () => {
    const copia = [...lista]
    sortRecipes(lista, 'alfabetico', stats)
    expect(lista).toEqual(copia)
  })
})

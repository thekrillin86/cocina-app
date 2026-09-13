import { describe, it, expect } from 'vitest'
import { detectPayload, parseRecipesPayload, TIPOS_VALIDOS } from './recipesImport'
import { asLines } from './format'

const frittata = {
  name: 'Frittata de pollo',
  type: 'comida',
  category: 'huevos',
  proteins: 'Pollo y huevo',
  calories: 260,
  rating: 0,
  source: 'Cookidoo',
  recipe: {
    method: 'Thermomix TM6',
    source: 'https://cookidoo.es/recipes/recipe/es-ES/r625419',
    ingredients: ['Huevo 4ud', 'Pimiento rojo 200g'],
    steps: ['🔧 Método: TM6', 'Batir los huevos'],
  },
}

const menuSemanal = {
  week: 35,
  year: 2026,
  days: [{ day: 'Lunes', lunch: { name: 'X' }, dinner: null }],
}

const porNombre = (r, nombre) => r.recipes.find((x) => x.name === nombre)

describe('detectPayload', () => {
  it('reconoce una lista de recetas', () => {
    expect(detectPayload([frittata])).toBe('recetas')
  })

  it('reconoce un objeto con recipes', () => {
    expect(detectPayload({ recipes: [frittata] })).toBe('recetas')
  })

  it('reconoce un menú semanal', () => {
    expect(detectPayload(menuSemanal)).toBe('menu')
  })

  it('no reconoce otra cosa', () => {
    expect(detectPayload({ hola: 1 })).toBe('desconocido')
    expect(detectPayload(null)).toBe('desconocido')
    expect(detectPayload('texto')).toBe('desconocido')
  })
})

describe('parseRecipesPayload · formas aceptadas', () => {
  it('acepta un array de recetas', () => {
    const r = parseRecipesPayload([frittata])
    expect(r.ok).toBe(true)
    expect(r.recipes).toHaveLength(1)
    expect(r.nuevas).toBe(1)
  })

  it('acepta un objeto con recipes', () => {
    expect(parseRecipesPayload({ recipes: [frittata] }).ok).toBe(true)
  })

  it('no confunde un menú semanal con recetas', () => {
    const r = parseRecipesPayload(menuSemanal)
    expect(r.ok).toBe(false)
    expect(r.errors[0].problema).toContain('menú semanal')
    expect(r.recipes).toEqual([])
  })

  it('rechaza lo que no reconoce', () => {
    expect(parseRecipesPayload({ hola: 1 }).ok).toBe(false)
    expect(parseRecipesPayload([]).errors[0].problema).toContain('ninguna receta')
  })
})

describe('parseRecipesPayload · validación', () => {
  it('exige nombre', () => {
    const r = parseRecipesPayload([{ type: 'comida' }])
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toEqual({ etiqueta: 'Receta 1', problema: 'le falta el nombre' })
  })

  it('exige un tipo válido', () => {
    const sinTipo = parseRecipesPayload([{ name: 'Algo' }])
    expect(sinTipo.errors[0].problema).toContain('le falta el tipo')

    const malTipo = parseRecipesPayload([{ name: 'Algo', type: 'merienda' }])
    expect(malTipo.errors[0].problema).toContain('merienda')
  })

  it('acepta los dos tipos válidos', () => {
    for (const type of TIPOS_VALIDOS) {
      expect(parseRecipesPayload([{ name: 'Algo', type }]).ok).toBe(true)
    }
  })

  it('si una falla no se guarda ninguna', () => {
    const r = parseRecipesPayload([frittata, { name: 'Rota' }])
    expect(r.ok).toBe(false)
    expect(r.recipes).toEqual([])
    expect(r.errors[0].etiqueta).toBe('Rota')
  })

  it('nombra la receta que falla para poder localizarla', () => {
    const r = parseRecipesPayload([{ name: 'Sopa de ajo', type: 'postre' }])
    expect(r.errors[0].etiqueta).toBe('Sopa de ajo')
  })

  it('detecta un nombre repetido dentro del propio lote', () => {
    const r = parseRecipesPayload([frittata, { ...frittata }])
    expect(r.ok).toBe(false)
    expect(r.errors[0].problema).toContain('repetida dentro del propio lote')
  })

  it('no corta los lotes largos', () => {
    const muchas = Array.from({ length: 60 }, (_, i) => ({ name: `Plato ${i}`, type: 'comida' }))
    expect(parseRecipesPayload(muchas).ok).toBe(true)
  })
})

describe('parseRecipesPayload · relleno de huecos', () => {
  it('adivina la categoría cuando falta', () => {
    const r = parseRecipesPayload([{ name: 'Merluza al horno', type: 'comida' }])
    expect(porNombre(r, 'Merluza al horno').category).toBe('pescado')
  })

  it('adivina la categoría cuando la que viene no existe', () => {
    const r = parseRecipesPayload([
      { name: 'Merluza al horno', type: 'comida', category: 'inventada' },
    ])
    expect(porNombre(r, 'Merluza al horno').category).toBe('pescado')
  })

  it('respeta la categoría cuando es válida', () => {
    const r = parseRecipesPayload([{ name: 'Cosa rara', type: 'cena', category: 'legumbres' }])
    expect(porNombre(r, 'Cosa rara').category).toBe('legumbres')
  })

  it('marca la fecha de alta en las nuevas', () => {
    const r = parseRecipesPayload([{ name: 'Algo', type: 'comida' }], [], {
      ahora: '2026-09-13T10:00:00.000Z',
    })
    expect(porNombre(r, 'Algo').createdAt).toBe('2026-09-13T10:00:00.000Z')
  })

  it('pone rating 0 en las nuevas', () => {
    const r = parseRecipesPayload([{ name: 'Algo', type: 'comida' }])
    expect(porNombre(r, 'Algo').rating).toBe(0)
  })

  it('convierte ingredientes y pasos escritos como texto', () => {
    const r = parseRecipesPayload([
      {
        name: 'Algo',
        type: 'comida',
        recipe: { ingredients: 'Huevo 4ud\nPimiento 200g\n\n', steps: 'Uno\nDos' },
      },
    ])
    const receta = porNombre(r, 'Algo').recipe
    expect(receta.ingredients).toEqual(['Huevo 4ud', 'Pimiento 200g'])
    expect(receta.steps).toEqual(['Uno', 'Dos'])
  })

  it('deja el cuerpo de la receta con sus cuatro claves', () => {
    const r = parseRecipesPayload([{ name: 'Algo', type: 'comida', recipe: { steps: 'Uno' } }])
    expect(Object.keys(porNombre(r, 'Algo').recipe).sort()).toEqual([
      'ingredients',
      'method',
      'source',
      'steps',
    ])
  })

  it('un cuerpo de receta vacío se guarda como null', () => {
    const r = parseRecipesPayload([
      { name: 'Algo', type: 'comida', recipe: { ingredients: '', steps: [] } },
    ])
    expect(porNombre(r, 'Algo').recipe).toBeNull()
  })

  it('acepta las proteínas como lista', () => {
    const r = parseRecipesPayload([
      { name: 'Algo', type: 'comida', proteins: ['Pollo', 'huevo'] },
    ])
    expect(porNombre(r, 'Algo').proteins).toBe('Pollo + huevo')
  })

  it('acepta las calorías escritas como texto', () => {
    const r = parseRecipesPayload([{ name: 'Algo', type: 'comida', calories: '260' }])
    expect(porNombre(r, 'Algo').calories).toBe(260)
  })
})

describe('parseRecipesPayload · nombres que ya existen', () => {
  const recetario = [
    { id: 'frittata-de-pollo-53om', name: 'Frittata de pollo', rating: 2, source: 'Cookidoo' },
  ]

  it('detecta la colisión y reutiliza el identificador que ya existe', () => {
    const r = parseRecipesPayload([frittata], recetario)
    expect(r.ok).toBe(true)
    expect(r.colisiones).toEqual(['Frittata de pollo'])
    expect(r.nuevas).toBe(0)
    expect(porNombre(r, 'Frittata de pollo').id).toBe('frittata-de-pollo-53om')
  })

  it('ignora acentos y mayúsculas al comparar nombres', () => {
    const r = parseRecipesPayload([{ name: 'FRITTATA DE POLLO', type: 'cena' }], recetario)
    expect(r.colisiones).toHaveLength(1)
    expect(r.recipes[0].id).toBe('frittata-de-pollo-53om')
  })

  it('importar el mismo lote dos veces no duplica', () => {
    // El primer envío crea; el segundo, con esas recetas ya en el
    // recetario, fusiona sobre el mismo identificador
    const primera = parseRecipesPayload([frittata], [])
    expect(primera.nuevas).toBe(1)
    expect(primera.recipes[0].id).toBeUndefined()

    const yaGuardadas = [{ ...primera.recipes[0], id: 'frittata-de-pollo-53om' }]
    const segunda = parseRecipesPayload([frittata], yaGuardadas)
    expect(segunda.nuevas).toBe(0)
    expect(segunda.colisiones).toEqual(['Frittata de pollo'])
    expect(segunda.recipes[0].id).toBe('frittata-de-pollo-53om')
  })

  it('al fusionar no pisa la valoración si el JSON no la trae', () => {
    const r = parseRecipesPayload([{ name: 'Frittata de pollo', type: 'comida' }], recetario)
    expect(r.recipes[0]).not.toHaveProperty('rating')
  })

  it('al fusionar sí escribe la valoración si el JSON la trae', () => {
    const r = parseRecipesPayload(
      [{ name: 'Frittata de pollo', type: 'comida', rating: -1 }],
      recetario
    )
    expect(r.recipes[0].rating).toBe(-1)
  })

  it('al fusionar no rejuvenece la receta', () => {
    // Volver a importar algo que ya está no debe marcarlo como nuevo
    const r = parseRecipesPayload([{ name: 'Frittata de pollo', type: 'comida' }], recetario, {
      ahora: '2026-09-13T10:00:00.000Z',
    })
    expect(r.recipes[0]).not.toHaveProperty('createdAt')
  })

  it('al fusionar no borra los campos que el JSON no trae', () => {
    const r = parseRecipesPayload([{ name: 'Frittata de pollo', type: 'comida' }], recetario)
    const receta = r.recipes[0]
    expect(receta).not.toHaveProperty('source')
    expect(receta).not.toHaveProperty('recipe')
    expect(receta).not.toHaveProperty('calories')
  })

  it('en una receta nueva sí rellena los huecos con null', () => {
    const r = parseRecipesPayload([{ name: 'Plato nuevo', type: 'comida' }], recetario)
    const receta = r.recipes[0]
    expect(receta.source).toBeNull()
    expect(receta.recipe).toBeNull()
    expect(receta.calories).toBeNull()
  })
})

describe('asLines', () => {
  it('parte un texto por saltos de línea y limpia', () => {
    expect(asLines('  Uno \n\n Dos  \n')).toEqual(['Uno', 'Dos'])
  })

  it('deja un array como está, limpiando', () => {
    expect(asLines([' Uno ', '', 'Dos'])).toEqual(['Uno', 'Dos'])
  })

  it('los huecos dan lista vacía', () => {
    expect(asLines(null)).toEqual([])
    expect(asLines('')).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import {
  normalize,
  parseIngredient,
  parseQuantity,
  combineQuantities,
  bumpQuantity,
  categorize,
  toCanonical,
  isBlacklisted,
  splitIngredientLine,
  extractItemsFromMenu,
  mergeShoppingItems,
  firstNeededIndex,
} from './ingredients'

const WID = '2026-34'

/* Menú de una sola comida, para probar la extracción */
const menuCon = (ingredientes, nombre = 'Plato de prueba') => ({
  days: [
    { day: 'Lunes', lunch: { name: nombre, recipe: { ingredients: ingredientes } }, dinner: null },
    ...Array.from({ length: 6 }, () => ({ lunch: null, dinner: null })),
  ],
})

const porNombre = (items, nombre) => items.find((i) => i.name === nombre)

describe('splitIngredientLine', () => {
  it('separa varios ingredientes de una línea', () => {
    expect(splitIngredientLine('sal y pimienta')).toEqual(['sal', 'pimienta'])
    expect(splitIngredientLine('cebolla, ajo')).toEqual(['cebolla', 'ajo'])
  })

  it('respeta la coma decimal a la europea', () => {
    expect(splitIngredientLine('1,5 kg de patatas')).toEqual(['1,5 kg de patatas'])
    expect(splitIngredientLine('0,5 l de leche')).toEqual(['0,5 l de leche'])
  })

  it('separa ingredientes aunque haya decimales por medio', () => {
    expect(splitIngredientLine('1,5 kg de patatas, 2 cebollas')).toEqual([
      '1,5 kg de patatas',
      '2 cebollas',
    ])
  })
})

describe('parseIngredient', () => {
  it('separa cantidad y producto', () => {
    expect(parseIngredient('800 g de lomo de merluza')).toEqual({
      name: 'Lomo de merluza',
      quantity: '800 g',
    })
    expect(parseIngredient('2 dientes de ajo')).toEqual({ name: 'Ajo', quantity: '2 dientes' })
  })

  it('conserva los decimales europeos', () => {
    expect(parseIngredient('1,5 kg de patatas')).toEqual({
      name: 'Patatas',
      quantity: '1,5 kg',
    })
  })

  it('quita paréntesis y adjetivos de preparación', () => {
    expect(parseIngredient('1 cebolla picada (mediana)').name).toBe('Cebolla')
    expect(parseIngredient('200 g de tomate en dados').name).toBe('Tomate')
  })

  it('no confunde el principio de una palabra con una unidad', () => {
    // "2 latas de anchoas" se leía como "2 l" + "atas de anchoas"
    expect(parseIngredient('2 latas de anchoas')).toEqual({
      name: 'Anchoas',
      quantity: '2 latas',
    })
    expect(parseIngredient('2 limones')).toEqual({ name: 'Limones', quantity: '2' })
    expect(parseIngredient('3 lonchas de jamón')).toEqual({
      name: 'Jamón',
      quantity: '3 lonchas',
    })
    expect(parseIngredient('1 lata de atún')).toEqual({ name: 'Atún', quantity: '1 lata' })
    expect(parseIngredient('4 claras de huevo')).toMatchObject({ quantity: '4' })
  })

  it('entiende las unidades escritas con todas las letras', () => {
    expect(parseIngredient('200 gramos de arroz')).toEqual({
      name: 'Arroz',
      quantity: '200 gramos',
    })
    expect(parseIngredient('2 kilos de patatas')).toEqual({
      name: 'Patatas',
      quantity: '2 kilos',
    })
  })

  it('entiende la cantidad escrita detrás del producto', () => {
    expect(parseIngredient('Garbanzos 300 g')).toEqual({ name: 'Garbanzos', quantity: '300 g' })
    expect(parseIngredient('Tomate 1 unidad')).toEqual({ name: 'Tomate', quantity: '1 unidad' })
    expect(parseIngredient('Queso feta 70 g')).toEqual({ name: 'Queso feta', quantity: '70 g' })
    expect(parseIngredient('Aceite de oliva 15 ml')).toEqual({
      name: 'Aceite de oliva',
      quantity: '15 ml',
    })
  })

  it('no confunde un número del nombre con una cantidad final', () => {
    expect(parseIngredient('Arroz 3 delicias').name).toBe('Arroz 3 delicias')
    expect(parseIngredient('Leche del día 2').name).toBe('Leche del día 2')
  })

  it('ignora las viñetas de lista', () => {
    expect(parseIngredient('- 2 dientes de ajo')).toEqual({ name: 'Ajo', quantity: '2 dientes' })
    expect(parseIngredient('• 100 g de jamón curado')).toEqual({
      name: 'Jamón curado',
      quantity: '100 g',
    })
    expect(parseIngredient('* 1 cebolla').name).toBe('Cebolla')
  })

  it('resuelve los rangos quedándose con el extremo alto', () => {
    expect(parseIngredient('1 - 2 dientes de ajo')).toEqual({ name: 'Ajo', quantity: '2 dientes' })
    expect(parseIngredient('90 - 100 g de jamón curado')).toEqual({
      name: 'Jamón curado',
      quantity: '100 g',
    })
    expect(parseIngredient('2-3 pellizcos de pimienta molida')).toEqual({
      name: 'Pimienta molida',
      quantity: '3 pellizcos',
    })
    expect(parseIngredient('3 - 4 chorritos de aceite de oliva')).toMatchObject({
      name: 'Aceite de oliva',
    })
  })

  it('reconoce envases y medidas caseras', () => {
    expect(parseIngredient('1 pastilla de caldo de pescado')).toEqual({
      name: 'Caldo de pescado',
      quantity: '1 pastilla',
    })
    expect(parseIngredient('3 gotas de tabasco')).toEqual({
      name: 'Tabasco',
      quantity: '3 gotas',
    })
    expect(parseIngredient('2 ramitas de perejil')).toEqual({
      name: 'Perejil',
      quantity: '2 ramitas',
    })
    expect(parseIngredient('1 pellizco de pimienta molida')).toEqual({
      name: 'Pimienta molida',
      quantity: '1 pellizco',
    })
    expect(parseIngredient('1 cucharadita colmada de maicena')).toEqual({
      name: 'Maicena',
      quantity: '1 cucharadita',
    })
    expect(parseIngredient('1 bolsa de ensalada')).toEqual({
      name: 'Ensalada',
      quantity: '1 bolsa',
    })
  })

  it('descarta lo que no es un ingrediente', () => {
    expect(parseIngredient('al gusto')).toBeNull()
    expect(parseIngredient('una pizca')).toBeNull()
    expect(parseIngredient('')).toBeNull()
    expect(parseIngredient(null)).toBeNull()
  })
})

describe('cantidades', () => {
  it('parseQuantity entiende la coma decimal', () => {
    expect(parseQuantity('1,5 kg')).toMatchObject({ value: 1.5, unit: 'kg' })
  })

  it('combineQuantities suma dentro de la misma familia de unidades', () => {
    expect(combineQuantities('500 g', '1 kg')).toBe('1,5 kg')
    expect(combineQuantities('200 g', '300 g')).toBe('500 g')
    expect(combineQuantities('500 ml', '0,5 l')).toBe('1 l')
    expect(combineQuantities('2 dientes', '1 diente')).toBe('3 dientes')
  })

  it('combineQuantities promociona a la unidad grande de forma consistente', () => {
    expect(combineQuantities('800 g', '500 g')).toBe('1,3 kg')
    expect(combineQuantities('800 g', '200 g')).toBe('1 kg')
    expect(combineQuantities('600 ml', '600 ml')).toBe('1,2 l')
  })

  it('combineQuantities concatena lo que no se puede sumar', () => {
    expect(combineQuantities('200 g', '3 lonchas')).toBe('200 g + 3 lonchas')
  })

  it('combineQuantities suma dentro de una cadena en vez de alargarla', () => {
    // El aceite que viene de cuatro recetas distintas
    let q = '4 cucharadas'
    for (const parte of ['30 g', '70 g', '60 g', '20 g']) q = combineQuantities(q, parte)
    expect(q).toBe('4 cucharadas + 180 g')
  })

  it('combineQuantities encadena solo cuando no hay nada compatible', () => {
    const q = combineQuantities(combineQuantities('200 g', '3 lonchas'), '2 dientes')
    expect(q).toBe('200 g + 3 lonchas + 2 dientes')
  })

  it('combineQuantities trata los huecos como neutro', () => {
    expect(combineQuantities(null, '200 g')).toBe('200 g')
    expect(combineQuantities('200 g', null)).toBe('200 g')
    expect(combineQuantities(null, null)).toBeNull()
  })

  it('bumpQuantity respeta la unidad', () => {
    expect(bumpQuantity('200 g', 1)).toBe('250 g')
    expect(bumpQuantity('200 g', -1)).toBe('150 g')
    expect(bumpQuantity('2 dientes', 1)).toBe('3 dientes')
    expect(bumpQuantity('50 g', -1)).toBe('')
  })
})

describe('categorización y alias', () => {
  it('agrupa las variantes bajo un nombre canónico', () => {
    expect(toCanonical('aceite de oliva virgen extra')).toBe('Aceite de oliva')
    expect(toCanonical('aove')).toBe('Aceite de oliva')
    expect(toCanonical('huevo')).toBe('Huevos')
  })

  it('respeta los casos especiales antes que las palabras clave', () => {
    expect(categorize('Caldo de pescado')).toBe('despensa')
    expect(categorize('Tomate triturado')).toBe('conservas')
    expect(categorize('Atún en lata')).toBe('conservas')
    expect(categorize('Merluza')).toBe('pescado')
    expect(categorize('Cosa rarísima')).toBe('otros')
  })

  it('isBlacklisted filtra el ruido del parseo', () => {
    expect(isBlacklisted('al gusto')).toBe(true)
    expect(isBlacklisted('Merluza')).toBe(false)
  })
})

describe('extractItemsFromMenu', () => {
  it('no destroza las cantidades con coma decimal', () => {
    const items = extractItemsFromMenu(
      menuCon(['1,5 kg de patatas', '0,5 l de leche', '800 g de merluza']),
      WID
    )
    expect(porNombre(items, 'Patata').quantity).toBe('1,5 kg')
    expect(porNombre(items, 'Leche').quantity).toBe('0,5 l')
    expect(porNombre(items, 'Merluza').quantity).toBe('800 g')
  })

  it('suma el mismo ingrediente venido de dos platos', () => {
    const menu = {
      days: [
        {
          day: 'Lunes',
          lunch: { name: 'A', recipe: { ingredients: ['200 g de tomate'] } },
          dinner: { name: 'B', recipe: { ingredients: ['300 g de tomate'] } },
        },
      ],
    }
    const items = extractItemsFromMenu(menu, WID)
    expect(porNombre(items, 'Tomate').quantity).toBe('500 g')
    expect(porNombre(items, 'Tomate').recipes).toHaveLength(2)
  })

  it('anota semana, día y cantidad en cada referencia', () => {
    const items = extractItemsFromMenu(menuCon(['800 g de merluza'], 'Merluza al horno'), WID)
    expect(porNombre(items, 'Merluza').recipes[0]).toMatchObject({
      recipeName: 'Merluza al horno',
      dayIndex: 0,
      weekId: WID,
      mealType: 'lunch',
      qty: '800 g',
      isoDate: '2026-08-17',
    })
  })

  it('la cantidad del producto es la suma de sus referencias', () => {
    const menu = {
      days: [
        {
          day: 'Lunes',
          lunch: { name: 'A', recipe: { ingredients: ['200 g de tomate'] } },
          dinner: { name: 'B', recipe: { ingredients: ['300 g de tomate'] } },
        },
      ],
    }
    const tomate = porNombre(extractItemsFromMenu(menu, WID), 'Tomate')
    const suma = tomate.recipes.reduce((acc, r) => combineQuantities(acc, r.qty), null)
    expect(suma).toBe(tomate.quantity)
  })

  it('un ingrediente repetido dentro de una receta no duplica la referencia', () => {
    const items = extractItemsFromMenu(
      menuCon(['200 g de tomate', '100 g de tomate'], 'Plato'),
      WID
    )
    const tomate = porNombre(items, 'Tomate')
    expect(tomate.recipes).toHaveLength(1)
    expect(tomate.quantity).toBe('300 g')
    expect(tomate.recipes[0].qty).toBe('300 g')
  })

  it('recoge los ingredientes de los dos platos de un mismo hueco', () => {
    const menu = {
      days: [
        {
          day: 'Lunes',
          lunch: [
            { name: 'Carne torrada', recipe: { ingredients: ['400 g de ternera'] } },
            { name: 'Ensalada de tomate', recipe: { ingredients: ['300 g de tomate'] } },
          ],
          dinner: null,
        },
      ],
    }
    const items = extractItemsFromMenu(menu, WID)
    expect(porNombre(items, 'Ternera').quantity).toBe('400 g')
    expect(porNombre(items, 'Tomate').quantity).toBe('300 g')
  })

  it('un ingrediente compartido por los dos platos del hueco se suma una vez por plato', () => {
    const menu = {
      days: [
        {
          day: 'Lunes',
          lunch: [
            { name: 'Carne torrada', recipe: { ingredients: ['30 g de aceite de oliva'] } },
            { name: 'Ensalada de tomate', recipe: { ingredients: ['20 g de aceite de oliva'] } },
          ],
          dinner: null,
        },
      ],
    }
    const aceite = porNombre(extractItemsFromMenu(menu, WID), 'Aceite de oliva')
    expect(aceite.quantity).toBe('50 g')
    expect(aceite.recipes).toHaveLength(2)
    expect(aceite.recipes.map((r) => r.recipeName)).toEqual([
      'Carne torrada',
      'Ensalada de tomate',
    ])
  })

  it('sigue leyendo los huecos guardados como un solo objeto', () => {
    const items = extractItemsFromMenu(menuCon(['400 g de ternera']), WID)
    expect(porNombre(items, 'Ternera').quantity).toBe('400 g')
  })

  it('devuelve lista vacía si no hay menú', () => {
    expect(extractItemsFromMenu(null, WID)).toEqual([])
    expect(extractItemsFromMenu({ days: [] }, WID)).toEqual([])
  })
})

describe('mergeShoppingItems', () => {
  const semana = () => extractItemsFromMenu(menuCon(['800 g de merluza', '1,5 kg de patatas']), WID)

  it('añade los productos a una lista vacía', () => {
    const r = mergeShoppingItems([], semana())
    expect(r).toHaveLength(2)
    expect(porNombre(r, 'Merluza').quantity).toBe('800 g')
  })

  it('reimportar la misma semana no cambia nada', () => {
    const primera = mergeShoppingItems([], semana())
    const segunda = mergeShoppingItems(primera, semana())
    expect(segunda).toHaveLength(2)
    expect(porNombre(segunda, 'Merluza').quantity).toBe('800 g')
    expect(porNombre(segunda, 'Patata').quantity).toBe('1,5 kg')
    expect(porNombre(segunda, 'Merluza').recipes).toHaveLength(1)
  })

  it('reimportar tres veces sigue sin cambiar nada', () => {
    let lista = mergeShoppingItems([], semana())
    for (let i = 0; i < 3; i++) lista = mergeShoppingItems(lista, semana())
    expect(porNombre(lista, 'Merluza').quantity).toBe('800 g')
    expect(porNombre(lista, 'Merluza').recipes).toHaveLength(1)
  })

  it('sí suma cuando el producto viene de otra semana distinta', () => {
    const otra = extractItemsFromMenu(menuCon(['500 g de merluza']), '2026-35')
    const lista = mergeShoppingItems(mergeShoppingItems([], semana()), otra)
    expect(porNombre(lista, 'Merluza').quantity).toBe('1,3 kg')
    expect(porNombre(lista, 'Merluza').recipes).toHaveLength(2)
  })

  it('sí suma cuando se añade un plato nuevo a la misma semana', () => {
    const ampliada = extractItemsFromMenu(
      {
        days: [
          {
            day: 'Lunes',
            lunch: { name: 'Plato de prueba', recipe: { ingredients: ['800 g de merluza'] } },
            dinner: { name: 'Cena nueva', recipe: { ingredients: ['200 g de merluza'] } },
          },
        ],
      },
      WID
    )
    const lista = mergeShoppingItems(mergeShoppingItems([], semana()), ampliada)
    expect(porNombre(lista, 'Merluza').quantity).toBe('1 kg')
    expect(porNombre(lista, 'Merluza').recipes).toHaveLength(2)
  })

  it('no toca los productos añadidos a mano', () => {
    const aMano = [
      {
        id: 'm_1',
        name: 'Papel de cocina',
        quantity: '2 ud',
        category: 'hogar',
        checked: false,
        recipes: [],
      },
    ]
    const lista = mergeShoppingItems(aMano, semana())
    expect(porNombre(lista, 'Papel de cocina').quantity).toBe('2 ud')
    expect(lista).toHaveLength(3)
  })

  it('conserva el estado de comprado', () => {
    const primera = mergeShoppingItems([], semana())
    primera.find((i) => i.name === 'Merluza').checked = true
    const segunda = mergeShoppingItems(primera, semana())
    expect(porNombre(segunda, 'Merluza').checked).toBe(true)
  })

  it('reconoce referencias antiguas que no guardaban la semana', () => {
    const antiguo = [
      {
        id: 'auto_merluza',
        name: 'Merluza',
        quantity: '800 g',
        category: 'pescado',
        checked: false,
        recipes: [{ recipeName: 'Plato de prueba', dayIndex: 0, mealType: 'lunch' }],
      },
    ]
    const lista = mergeShoppingItems(antiguo, semana())
    expect(porNombre(lista, 'Merluza').quantity).toBe('800 g')
    expect(porNombre(lista, 'Merluza').recipes).toHaveLength(1)
  })

  it('no muta la lista original', () => {
    const original = mergeShoppingItems([], semana())
    const copia = JSON.parse(JSON.stringify(original))
    mergeShoppingItems(original, semana())
    expect(original).toEqual(copia)
  })
})

describe('firstNeededIndex', () => {
  it('devuelve el día más temprano', () => {
    expect(firstNeededIndex({ recipes: [{ dayIndex: 4 }, { dayIndex: 1 }] })).toBe(1)
  })

  it('devuelve null cuando no hay días', () => {
    expect(firstNeededIndex({ recipes: [] })).toBeNull()
    expect(firstNeededIndex({})).toBeNull()
    expect(firstNeededIndex({ recipes: [{ recipeName: 'X' }] })).toBeNull()
  })
})

describe('normalize', () => {
  it('quita acentos y normaliza espacios', () => {
    expect(normalize('  Salmón   Fresco ')).toBe('salmon fresco')
    expect(normalize(null)).toBe('')
  })
})

import { describe, it, expect } from 'vitest'
import {
  asDishes,
  fromDishes,
  hasDishes,
  dishesLabel,
  slotCalories,
  forEachDish,
} from './dishes'

const carne = { name: 'Carne torrada', calories: 480 }
const ensalada = { name: 'Ensalada de tomate', calories: 120 }

describe('asDishes', () => {
  it('lee el formato antiguo de un solo objeto', () => {
    expect(asDishes(carne)).toEqual([carne])
  })

  it('lee una lista de platos', () => {
    expect(asDishes([carne, ensalada])).toEqual([carne, ensalada])
  })

  it('trata el hueco vacío como lista vacía', () => {
    expect(asDishes(null)).toEqual([])
    expect(asDishes(undefined)).toEqual([])
    expect(asDishes([])).toEqual([])
  })

  it('descarta los huecos sueltos de una lista', () => {
    expect(asDishes([carne, null, { sinNombre: true }])).toEqual([carne])
  })
})

describe('fromDishes', () => {
  it('guarda un objeto suelto cuando solo hay un plato', () => {
    // Así los menús que ya existen no cambian de forma
    expect(fromDishes([carne])).toEqual(carne)
    expect(Array.isArray(fromDishes([carne]))).toBe(false)
  })

  it('guarda una lista cuando hay varios', () => {
    expect(fromDishes([carne, ensalada])).toEqual([carne, ensalada])
  })

  it('deja el hueco a null cuando no queda nada', () => {
    expect(fromDishes([])).toBeNull()
    expect(fromDishes(null)).toBeNull()
    expect(fromDishes([null])).toBeNull()
  })

  it('ida y vuelta conserva el formato antiguo', () => {
    expect(fromDishes(asDishes(carne))).toEqual(carne)
    expect(fromDishes(asDishes(null))).toBeNull()
  })
})

describe('hasDishes', () => {
  it('distingue hueco lleno de vacío', () => {
    expect(hasDishes(carne)).toBe(true)
    expect(hasDishes([carne, ensalada])).toBe(true)
    expect(hasDishes(null)).toBe(false)
    expect(hasDishes([])).toBe(false)
  })
})

describe('dishesLabel', () => {
  it('une los nombres con un más', () => {
    expect(dishesLabel([carne, ensalada])).toBe('Carne torrada + Ensalada de tomate')
    expect(dishesLabel(carne)).toBe('Carne torrada')
    expect(dishesLabel(null)).toBe('')
  })
})

describe('slotCalories', () => {
  it('suma las calorías de todos los platos del hueco', () => {
    expect(slotCalories([carne, ensalada])).toBe(600)
    expect(slotCalories(carne)).toBe(480)
  })

  it('suma solo las que existen', () => {
    expect(slotCalories([carne, { name: 'Pan' }])).toBe(480)
  })

  it('devuelve null si ningún plato tiene calorías', () => {
    expect(slotCalories([{ name: 'Pan' }])).toBeNull()
    expect(slotCalories(null)).toBeNull()
  })
})

describe('forEachDish', () => {
  it('recorre todos los platos con su posición', () => {
    const menu = {
      days: [
        { day: 'Lunes', lunch: [carne, ensalada], dinner: null },
        { day: 'Martes', lunch: null, dinner: { name: 'Sopa' } },
      ],
    }
    const visto = []
    forEachDish(menu, (plato, pos) => visto.push([plato.name, pos.dayIndex, pos.mealType, pos.dishIndex]))
    expect(visto).toEqual([
      ['Carne torrada', 0, 'lunch', 0],
      ['Ensalada de tomate', 0, 'lunch', 1],
      ['Sopa', 1, 'dinner', 0],
    ])
  })

  it('aguanta un menú vacío', () => {
    const visto = []
    forEachDish(null, () => visto.push(1))
    forEachDish({ days: [] }, () => visto.push(1))
    expect(visto).toEqual([])
  })
})

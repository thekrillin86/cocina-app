import { describe, it, expect } from 'vitest'
import {
  asItems,
  isItemMap,
  itemsToMap,
  newItemId,
  findItem,
  countPending,
  safeItemId,
} from './shoppingList'

const leche = { id: 'it_1', name: 'Leche', checked: false }
const pan = { id: 'it_2', name: 'Pan', checked: true }

const comoArray = { id: 'lidl', name: 'Lidl', items: [leche, pan] }
const comoMapa = { id: 'lidl', name: 'Lidl', items: { it_1: leche, it_2: pan } }

describe('asItems', () => {
  it('lee las listas guardadas como array', () => {
    expect(asItems(comoArray)).toEqual([leche, pan])
  })

  it('lee las listas guardadas como mapa', () => {
    expect(asItems(comoMapa)).toEqual(expect.arrayContaining([leche, pan]))
    expect(asItems(comoMapa)).toHaveLength(2)
  })

  it('rellena el identificador desde la clave si al producto le falta', () => {
    const lista = { items: { it_9: { name: 'Sal' } } }
    expect(asItems(lista)).toEqual([{ name: 'Sal', id: 'it_9' }])
  })

  it('una lista vacía o sin productos da lista vacía', () => {
    expect(asItems({ items: {} })).toEqual([])
    expect(asItems({ items: [] })).toEqual([])
    expect(asItems({})).toEqual([])
    expect(asItems(null)).toEqual([])
  })

  it('descarta la basura', () => {
    expect(asItems({ items: [leche, null, { sinId: true }] })).toEqual([leche])
    expect(asItems({ items: { it_1: leche, it_x: null } })).toEqual([leche])
  })
})

describe('isItemMap', () => {
  it('distingue las dos formas', () => {
    expect(isItemMap(comoMapa)).toBe(true)
    expect(isItemMap(comoArray)).toBe(false)
    expect(isItemMap({ items: {} })).toBe(true)
    expect(isItemMap({ items: [] })).toBe(false)
    expect(isItemMap({})).toBe(false)
    expect(isItemMap(null)).toBe(false)
  })
})

describe('itemsToMap', () => {
  it('convierte una lista en mapa por identificador', () => {
    expect(itemsToMap([leche, pan])).toEqual({ it_1: leche, it_2: pan })
  })

  it('ida y vuelta no pierde nada', () => {
    const vuelta = asItems({ items: itemsToMap(asItems(comoArray)) })
    expect(vuelta).toHaveLength(2)
    expect(vuelta).toEqual(expect.arrayContaining([leche, pan]))
  })

  it('descarta los que no tienen identificador', () => {
    expect(itemsToMap([leche, { name: 'Sin id' }, null])).toEqual({ it_1: leche })
  })
})

describe('findItem', () => {
  it('encuentra en las dos formas', () => {
    expect(findItem(comoArray, 'it_2')).toEqual(pan)
    expect(findItem(comoMapa, 'it_2')).toEqual(pan)
  })

  it('devuelve null si no está', () => {
    expect(findItem(comoMapa, 'it_99')).toBeNull()
    expect(findItem(null, 'it_1')).toBeNull()
  })
})

describe('countPending', () => {
  it('cuenta solo lo que falta por comprar', () => {
    expect(countPending(comoArray)).toBe(1)
    expect(countPending(comoMapa)).toBe(1)
    expect(countPending({ items: {} })).toBe(0)
  })
})

describe('newItemId', () => {
  it('no se repite', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newItemId()))
    expect(ids.size).toBe(200)
  })

  it('vale como clave de un campo de Firestore', () => {
    // Nada de puntos, barras ni corchetes, que romperían la ruta
    for (let i = 0; i < 50; i++) {
      expect(newItemId()).toMatch(/^it_[a-z0-9_]+$/)
    }
  })
})

describe('safeItemId', () => {
  /* El identificador acaba siendo una clave dentro del documento, y
     Firestore reserva unos cuantos caracteres en las rutas de campo.
     El punto es el peligroso: no da error, parte la ruta. */
  it('quita todo lo que no sea letra, número o guion bajo', () => {
    expect(safeItemId('leche 1.5% materia grasa')).toBe('leche_1_5_materia_grasa')
    expect(safeItemId('1/2 limon')).toBe('1_2_limon')
    expect(safeItemId('aceite a.o.v.e')).toBe('aceite_a_o_v_e')
    expect(safeItemId('pan 100% integral')).toBe('pan_100_integral')
  })

  it('no deja ningún carácter que rompa una ruta de campo', () => {
    const peligrosos = ['a.b', 'a/b', 'a~b', 'a*b', 'a[b]', 'a b', 'a%b', 'á-é']
    for (const t of peligrosos) {
      expect(safeItemId(t)).toMatch(/^[a-zA-Z0-9_]+$/)
    }
  })

  it('no deja guiones bajos sueltos al principio ni al final', () => {
    expect(safeItemId('  hola  ')).toBe('hola')
    expect(safeItemId('...hola...')).toBe('hola')
  })

  it('nunca devuelve vacío, que Firestore lo rechaza', () => {
    expect(safeItemId('...')).toBe('x')
    expect(safeItemId('')).toBe('x')
    expect(safeItemId(null)).toBe('x')
  })
})

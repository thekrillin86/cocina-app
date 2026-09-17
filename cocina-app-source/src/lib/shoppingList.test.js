import { describe, it, expect } from 'vitest'
import {
  asItems,
  isItemMap,
  itemsToMap,
  newItemId,
  findItem,
  countPending,
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

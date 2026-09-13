import { describe, it, expect, vi, beforeEach } from 'vitest'

/* Los lotes que se han ido enviando: cada entrada es un commit */
const lotesEnviados = []

vi.mock('../firebase', () => ({ db: {}, auth: {} }))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: (_db, coleccion, id) => ({ coleccion, id }),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  writeBatch: () => {
    const operaciones = []
    return {
      delete: (ref) => operaciones.push({ op: 'delete', id: ref.id }),
      set: (ref, datos) => operaciones.push({ op: 'set', id: ref.id, datos }),
      commit: async () => {
        lotesEnviados.push(operaciones)
      },
    }
  },
}))

const { bulkDeleteRecipes, bulkSaveRecipes, newRecipeId } = await import('./db')

beforeEach(() => {
  lotesEnviados.length = 0
})

describe('bulkDeleteRecipes', () => {
  it('borra los identificadores que se le pasan', async () => {
    await bulkDeleteRecipes(['a', 'b', 'c'])
    expect(lotesEnviados).toHaveLength(1)
    expect(lotesEnviados[0].map((o) => o.id)).toEqual(['a', 'b', 'c'])
    expect(lotesEnviados[0].every((o) => o.op === 'delete')).toBe(true)
  })

  it('trocea por encima de 400, que es el límite de un lote', async () => {
    const ids = Array.from({ length: 950 }, (_, i) => 'r-' + i)
    const borradas = await bulkDeleteRecipes(ids)

    expect(borradas).toBe(950)
    expect(lotesEnviados).toHaveLength(3)
    expect(lotesEnviados.map((l) => l.length)).toEqual([400, 400, 150])

    // Ninguno se queda por el camino ni se repite
    const todos = lotesEnviados.flat().map((o) => o.id)
    expect(todos).toHaveLength(950)
    expect(new Set(todos).size).toBe(950)
    expect(todos[0]).toBe('r-0')
    expect(todos[949]).toBe('r-949')
  })

  it('justo en 400 manda un solo lote', async () => {
    await bulkDeleteRecipes(Array.from({ length: 400 }, (_, i) => 'x' + i))
    expect(lotesEnviados).toHaveLength(1)
  })

  it('no manda nada si no hay identificadores', async () => {
    expect(await bulkDeleteRecipes([])).toBe(0)
    expect(await bulkDeleteRecipes(null)).toBe(0)
    expect(lotesEnviados).toHaveLength(0)
  })

  it('descarta los huecos de la lista', async () => {
    await bulkDeleteRecipes(['a', null, undefined, 'b'])
    expect(lotesEnviados[0].map((o) => o.id)).toEqual(['a', 'b'])
  })
})

describe('bulkSaveRecipes', () => {
  it('respeta el identificador cuando se le pasa, que es lo que permite fusionar', async () => {
    await bulkSaveRecipes([{ id: 'frittata-53om', name: 'Frittata', rating: 2 }])
    expect(lotesEnviados[0][0].id).toBe('frittata-53om')
    expect(lotesEnviados[0][0].datos).not.toHaveProperty('id')
  })

  it('genera uno nuevo cuando no lo lleva', async () => {
    await bulkSaveRecipes([{ name: 'Frittata de pollo' }])
    expect(lotesEnviados[0][0].id).toMatch(/^frittata-de-pollo-/)
  })

  it('trocea igual por encima de 400', async () => {
    const lista = Array.from({ length: 401 }, (_, i) => ({ id: 'r' + i, name: 'Plato ' + i }))
    await bulkSaveRecipes(lista)
    expect(lotesEnviados.map((l) => l.length)).toEqual([400, 1])
  })
})

describe('newRecipeId', () => {
  it('lleva sufijo aleatorio, así que dos altas del mismo nombre no se fusionan solas', () => {
    // Es la razón por la que la importación resuelve el identificador
    // por nombre antes de guardar
    expect(newRecipeId('Frittata de pollo')).not.toBe(newRecipeId('Frittata de pollo'))
  })

  it('quita acentos y deja un slug legible', () => {
    expect(newRecipeId('Salmón al horno')).toMatch(/^salmon-al-horno-/)
  })
})

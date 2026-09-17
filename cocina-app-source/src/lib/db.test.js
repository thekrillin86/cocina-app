import { describe, it, expect, vi, beforeEach } from 'vitest'

/* Lo que se ha ido enviando a Firestore */
const lotesEnviados = []
const escrituras = []

const BORRA_CAMPO = { __borrar: true }

vi.mock('../firebase', () => ({ db: {}, auth: {} }))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: (_db, coleccion, id) => ({ coleccion, id }),
  setDoc: (ref, datos) => {
    escrituras.push({ op: 'set', ref, datos })
    return Promise.resolve()
  },
  updateDoc: (ref, datos) => {
    escrituras.push({ op: 'update', ref, datos })
    return Promise.resolve()
  },
  deleteDoc: vi.fn(),
  deleteField: () => BORRA_CAMPO,
  onSnapshot: vi.fn(),
  query: vi.fn(),
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

const {
  bulkDeleteRecipes,
  bulkSaveRecipes,
  newRecipeId,
  addShoppingItem,
  updateShoppingItem,
  toggleShoppingItem,
  removeShoppingItem,
  clearCheckedItems,
  clearAllItems,
  importWeekIntoList,
} = await import('./db')

beforeEach(() => {
  lotesEnviados.length = 0
  escrituras.length = 0
})

/* Una lista ya en el formato nuevo */
const listaMapa = {
  id: 'lidl',
  name: 'Lidl',
  items: {
    it_1: { id: 'it_1', name: 'Leche', checked: false },
    it_2: { id: 'it_2', name: 'Pan', checked: true },
  },
}

/* Una de las de antes, todavía como array */
const listaArray = {
  id: 'lidl',
  name: 'Lidl',
  items: [
    { id: 'it_1', name: 'Leche', checked: false },
    { id: 'it_2', name: 'Pan', checked: true },
  ],
}

const soloCampos = (datos) => {
  const { updatedAt, ...resto } = datos
  return resto
}

describe('lista de la compra · escribe por campo, no la lista entera', () => {
  /* Esto es lo que hace que funcione sin cobertura. Una escritura de
     campo se apunta en el móvil y se ve al instante; reescribir los
     productos enteros obligaba a una transacción, y las transacciones
     de Firestore van directas al servidor. */

  it('marcar un producto escribe solo su casilla', async () => {
    await toggleShoppingItem(listaMapa, 'it_1')
    expect(escrituras).toHaveLength(1)
    expect(soloCampos(escrituras[0].datos)).toEqual({ 'items.it_1.checked': true })
  })

  it('desmarcar también, mirando el estado que hay', async () => {
    await toggleShoppingItem(listaMapa, 'it_2')
    expect(soloCampos(escrituras[0].datos)).toEqual({ 'items.it_2.checked': false })
  })

  it('marcar un producto que ya no está no escribe nada', async () => {
    await toggleShoppingItem(listaMapa, 'it_borrado')
    expect(escrituras).toHaveLength(0)
  })

  it('editar escribe solo los campos que cambian', async () => {
    await updateShoppingItem(listaMapa, 'it_1', { name: 'Leche entera', quantity: '2 l' })
    expect(soloCampos(escrituras[0].datos)).toEqual({
      'items.it_1.name': 'Leche entera',
      'items.it_1.quantity': '2 l',
    })
  })

  it('añadir escribe solo el producto nuevo', async () => {
    const id = await addShoppingItem(listaMapa, { name: 'Sal', category: 'despensa' })
    const campos = soloCampos(escrituras[0].datos)
    expect(Object.keys(campos)).toEqual([`items.${id}`])
    expect(campos[`items.${id}`]).toMatchObject({ id, name: 'Sal', checked: false })
  })

  it('borrar un producto borra solo su campo', async () => {
    await removeShoppingItem(listaMapa, 'it_1')
    expect(soloCampos(escrituras[0].datos)).toEqual({ 'items.it_1': BORRA_CAMPO })
  })

  it('borrar los comprados borra solo esos campos', async () => {
    const cuantos = await clearCheckedItems(listaMapa)
    expect(cuantos).toBe(1)
    expect(soloCampos(escrituras[0].datos)).toEqual({ 'items.it_2': BORRA_CAMPO })
  })

  it('si no hay comprados no escribe nada', async () => {
    const lista = { id: 'x', items: { a: { id: 'a', checked: false } } }
    expect(await clearCheckedItems(lista)).toBe(0)
    expect(escrituras).toHaveLength(0)
  })

  it('ninguna operación toca los demás productos', async () => {
    await toggleShoppingItem(listaMapa, 'it_1')
    const datos = escrituras[0].datos
    expect(JSON.stringify(datos)).not.toContain('Pan')
    expect(datos).not.toHaveProperty('items')
  })
})

describe('lista de la compra · listas de antes, guardadas como array', () => {
  it('se convierten a mapa antes de escribir el campo', async () => {
    await toggleShoppingItem(listaArray, 'it_1')

    expect(escrituras).toHaveLength(2)
    // Primero la conversión entera
    expect(escrituras[0].datos).toEqual({
      items: {
        it_1: { id: 'it_1', name: 'Leche', checked: false },
        it_2: { id: 'it_2', name: 'Pan', checked: true },
      },
    })
    // Y encima, el cambio por campo
    expect(soloCampos(escrituras[1].datos)).toEqual({ 'items.it_1.checked': true })
  })

  it('una vez convertida ya no se vuelve a convertir', async () => {
    await toggleShoppingItem(listaMapa, 'it_1')
    expect(escrituras).toHaveLength(1)
  })

  it('la conversión no pierde ningún producto', async () => {
    await removeShoppingItem(listaArray, 'it_1')
    expect(Object.keys(escrituras[0].datos.items)).toEqual(['it_1', 'it_2'])
  })
})

describe('lista de la compra · operaciones en bloque', () => {
  it('vaciar deja los productos a cero', async () => {
    await clearAllItems(listaMapa)
    expect(escrituras[0].datos.items).toEqual({})
  })

  it('importar del menú escribe los productos como mapa', async () => {
    const entrantes = [
      { id: 'auto_leche', name: 'Leche', quantity: '1 l', checked: false, recipes: [] },
    ]
    await importWeekIntoList({ id: 'lidl', items: {} }, entrantes, 'replace')
    expect(escrituras[0].datos.items).toEqual({ auto_leche: entrantes[0] })
  })

  it('importar añadiendo conserva lo que ya había', async () => {
    const entrantes = [{ id: 'auto_sal', name: 'Sal', checked: false, recipes: [] }]
    await importWeekIntoList(listaMapa, entrantes, 'merge')
    const claves = Object.keys(escrituras[0].datos.items).sort()
    expect(claves).toEqual(['auto_sal', 'it_1', 'it_2'])
  })
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

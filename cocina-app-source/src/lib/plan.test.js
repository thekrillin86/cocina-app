import { describe, it, expect, vi, beforeEach } from 'vitest'

/* Lo que hay «en Firestore» y lo que se le manda */
const almacen = new Map()
const escrituras = []

vi.mock('../firebase', () => ({ db: {}, auth: {} }))

vi.mock('firebase/firestore', () => ({
  doc: (_db, coleccion, id) => ({ coleccion, id, ruta: `${coleccion}/${id}` }),
  getDoc: async (ref) => ({
    exists: () => almacen.has(ref.ruta),
    id: ref.id,
    data: () => almacen.get(ref.ruta),
  }),
  setDoc: async (ref, datos, opciones) => {
    escrituras.push({ op: 'set', ruta: ref.ruta, datos, opciones })
    almacen.set(ref.ruta, datos)
  },
  updateDoc: async (ref, datos) => {
    escrituras.push({ op: 'update', ruta: ref.ruta, datos })
    almacen.set(ref.ruta, { ...(almacen.get(ref.ruta) || {}), ...datos })
  },
}))

const { copyWeek, getWeek, addDish, removeDish, setWeekPersons, countMeals, emptyWeek } =
  await import('./plan')

beforeEach(() => {
  almacen.clear()
  escrituras.length = 0
})

const semanaCon = (wid, platosPorDia) => {
  const base = emptyWeek(wid)
  const days = base.days.map((d, i) => ({ ...d, lunch: platosPorDia[i] || null }))
  almacen.set(`menus/${wid}`, { ...base, days })
}

describe('copyWeek · no puede vaciar la semana de destino', () => {
  /* El fallo que borró una semana entera: escribía el destino y
     DESPUÉS contaba los platos, así que copiar desde una semana
     vacía dejaba el destino en blanco mientras la app decía «no hay
     nada que copiar». */

  it('si la semana de origen está vacía, no toca el destino', async () => {
    semanaCon('2026-38', []) // existe pero sin platos
    semanaCon('2026-39', [{ name: 'Lentejas' }, { name: 'Merluza' }])

    const copiados = await copyWeek('2026-38', '2026-39')

    expect(copiados).toBe(0)
    expect(escrituras).toHaveLength(0)
    expect(countMeals(almacen.get('menus/2026-39'))).toBe(2)
  })

  it('si la semana de origen no existe, tampoco', async () => {
    semanaCon('2026-39', [{ name: 'Lentejas' }])
    expect(await copyWeek('2026-38', '2026-39')).toBe(0)
    expect(escrituras).toHaveLength(0)
  })

  it('copiar de verdad sí reemplaza el destino', async () => {
    semanaCon('2026-38', [{ name: 'Sopa' }, { name: 'Pollo' }, { name: 'Pasta' }])
    semanaCon('2026-39', [{ name: 'Lentejas' }])

    const copiados = await copyWeek('2026-38', '2026-39')

    expect(copiados).toBe(3)
    const destino = almacen.get('menus/2026-39')
    expect(countMeals(destino)).toBe(3)
    expect(destino.days[0].lunch).toEqual({ name: 'Sopa' })
    // Las fechas son las del destino, no las del origen
    expect(destino.week).toBe(39)
  })

  it('no se copia una semana sobre sí misma', async () => {
    semanaCon('2026-39', [{ name: 'Lentejas' }])
    expect(await copyWeek('2026-39', '2026-39')).toBe(0)
    expect(escrituras).toHaveLength(0)
  })
})

describe('getWeek', () => {
  it('devuelve la semana con su identificador', async () => {
    semanaCon('2026-39', [{ name: 'Lentejas' }])
    const s = await getWeek('2026-39')
    expect(s.id).toBe('2026-39')
    expect(countMeals(s)).toBe(1)
  })

  it('devuelve null si no existe', async () => {
    expect(await getWeek('2026-99')).toBeNull()
    expect(await getWeek(null)).toBeNull()
  })
})

describe('escribir el menú sin transacciones', () => {
  /* Las transacciones no pasan por la caché del móvil: planificar
     con mala cobertura no guardaba nada. Ahora son escrituras
     normales, que Firestore apunta en local primero. */

  it('añadir un plato a una semana que existe solo actualiza los días', async () => {
    semanaCon('2026-39', [])
    const menu = await getWeek('2026-39')

    await addDish('2026-39', menu, 0, 'lunch', { name: 'Lentejas' })

    expect(escrituras).toHaveLength(1)
    expect(escrituras[0].op).toBe('update')
    expect(Object.keys(escrituras[0].datos).sort()).toEqual(['days', 'updatedAt'])
    expect(escrituras[0].datos.days[0].lunch).toEqual({ name: 'Lentejas' })
  })

  it('en una semana que no existe la crea con su esqueleto', async () => {
    await addDish('2026-40', null, 2, 'dinner', { name: 'Sopa' })

    expect(escrituras[0].op).toBe('set')
    expect(escrituras[0].opciones).toEqual({ merge: true })
    const datos = escrituras[0].datos
    expect(datos.week).toBe(40)
    expect(datos.days).toHaveLength(7)
    expect(datos.days[2].dinner).toEqual({ name: 'Sopa' })
  })

  it('quitar el único plato deja el hueco vacío, no borra la semana', async () => {
    semanaCon('2026-39', [{ name: 'Lentejas' }])
    const menu = await getWeek('2026-39')

    await removeDish('2026-39', menu, 0, 'lunch', 0)

    const destino = almacen.get('menus/2026-39')
    expect(destino.days[0].lunch).toBeNull()
    expect(destino.days).toHaveLength(7)
  })

  it('cambiar los comensales no toca los platos', async () => {
    semanaCon('2026-39', [{ name: 'Lentejas' }])
    const menu = await getWeek('2026-39')

    await setWeekPersons('2026-39', menu, 3)

    expect(Object.keys(escrituras[0].datos).sort()).toEqual(['persons', 'updatedAt'])
    expect(countMeals(almacen.get('menus/2026-39'))).toBe(1)
  })

  it('los comensales se quedan entre 1 y 20', async () => {
    semanaCon('2026-39', [])
    const menu = await getWeek('2026-39')
    expect(await setWeekPersons('2026-39', menu, 0)).toBe(4)
    expect(await setWeekPersons('2026-39', menu, 99)).toBe(20)
  })
})

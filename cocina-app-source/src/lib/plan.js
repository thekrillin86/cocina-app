/* ============================================================
   PLANIFICACIÓN SEMANAL

   Estructura del documento /menus/{año-semana}:
   { week, year, dateRange, persons, days: [ { day, date, schedule,
     lunch, dinner } x7 ] }

   Ninguna escritura usa transacciones, y es a propósito: las
   transacciones de Firestore no pasan por la caché del móvil, van
   directas al servidor. Sin cobertura se quedan colgadas y acaban
   fallando, así que planificar la semana con mala señal no guardaba
   nada. Ver `shoppingList.js`, donde está contado en detalle.

   A cambio, el array `days` se reescribe entero desde lo que hay en
   pantalla. Si los dos móviles editan LA MISMA semana a la vez, el
   último en guardar pisa al otro. Es un riesgo asumido: la semana se
   planifica sentado en casa, normalmente uno de los dos, mientras
   que la lista de la compra —que sí se toca a la vez en el súper—
   escribe campo a campo y no tiene ese problema.
   ============================================================ */
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { DAYS_ES, parseWeekId, dateForDay, formatDayMonth, weekRangeLabel } from './dates'
import { asDishes, fromDishes } from './dishes'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const ahora = () => new Date().toISOString()

export const COMENSALES_POR_DEFECTO = 4

/* Esqueleto de una semana vacía */
export function emptyWeek(wid) {
  const { year, week } = parseWeekId(wid)
  return {
    week,
    year,
    dateRange: weekRangeLabel(wid),
    persons: COMENSALES_POR_DEFECTO,
    days: DAYS_ES.map((name, i) => ({
      day: cap(name),
      date: formatDayMonth(dateForDay(wid, i)),
      schedule: null,
      lunch: null,
      dinner: null,
    })),
  }
}

/* Devuelve los 7 días, rellenando huecos si el documento viene corto */
export function normalizeDays(menu, wid) {
  const base = emptyWeek(wid).days
  const days = menu?.days || []
  return base.map((d, i) => ({ ...d, ...(days[i] || {}) }))
}

/* Cuántos huecos de los 14 tienen algo. Un hueco con dos platos
   sigue contando como uno: el 14 son comidas y cenas, no platos. */
export function countMeals(menu) {
  if (!menu?.days) return 0
  let n = 0
  for (const d of menu.days) {
    if (asDishes(d.lunch).length) n++
    if (asDishes(d.dinner).length) n++
  }
  return n
}

/* Platos totales de la semana, que pueden ser más que los huecos */
export function countDishes(menu) {
  if (!menu?.days) return 0
  let n = 0
  for (const d of menu.days) {
    n += asDishes(d.lunch).length + asDishes(d.dinner).length
  }
  return n
}

/* ============================================================
   ESCRITURA

   Parte de lo que hay en pantalla, que con la caché local es lo
   bueno aunque no haya cobertura, y escribe los siete días. Es una
   escritura normal: Firestore la apunta primero en el móvil, se ve
   al instante y sube cuando vuelva la señal.
   ============================================================ */
async function actualizarDias(wid, menu, transformar) {
  const ref = doc(db, 'menus', wid)
  const days = transformar(normalizeDays(menu, wid))

  if (!menu) {
    // La semana todavía no existe: se crea con su esqueleto. Con
    // merge, por si acaso existiera y no hubiera llegado aún.
    await setDoc(
      ref,
      { ...emptyWeek(wid), days, createdAt: ahora(), updatedAt: ahora() },
      { merge: true }
    )
    return
  }

  await updateDoc(ref, { days, updatedAt: ahora() })
}

/* ============================================================
   PLATOS DE UN HUECO

   Todo pasa por `actualizarHueco`, que lee los platos que hay,
   aplica la transformación y los vuelve a guardar en el formato
   adecuado (objeto suelto si queda uno, lista si quedan varios).
   ============================================================ */
async function actualizarHueco(wid, menu, dayIndex, type, transformar) {
  await actualizarDias(wid, menu, (dias) =>
    dias.map((d, i) =>
      i === dayIndex ? { ...d, [type]: fromDishes(transformar(asDishes(d[type]))) } : d
    )
  )
}

/* Añade un plato más al hueco, sin tocar los que ya hay */
export async function addDish(wid, menu, dayIndex, type, dish) {
  await actualizarHueco(wid, menu, dayIndex, type, (platos) => [...platos, dish])
}

/* Sustituye el plato que está en esa posición */
export async function replaceDish(wid, menu, dayIndex, type, index, dish) {
  await actualizarHueco(wid, menu, dayIndex, type, (platos) =>
    platos.map((p, i) => (i === index ? dish : p))
  )
}

/* Quita un plato. Si era el único, el hueco queda vacío. */
export async function removeDish(wid, menu, dayIndex, type, index) {
  await actualizarHueco(wid, menu, dayIndex, type, (platos) =>
    platos.filter((_, i) => i !== index)
  )
}

/* Nota de un plato concreto: "hacer el doble" puede aplicar a la
   carne y no a la ensalada que la acompaña. */
export async function setDishNote(wid, menu, dayIndex, type, index, note) {
  await actualizarHueco(wid, menu, dayIndex, type, (platos) =>
    platos.map((p, i) => (i === index ? { ...p, notes: note || null } : p))
  )
}

/* Texto de horario / observaciones del día */
export async function setDaySchedule(wid, menu, dayIndex, schedule) {
  await actualizarDias(wid, menu, (dias) =>
    dias.map((d, i) => (i === dayIndex ? { ...d, schedule: schedule || null } : d))
  )
}

/* Número de comensales de la semana */
export async function setWeekPersons(wid, menu, persons) {
  const n = Math.max(1, Math.min(20, parseInt(persons, 10) || COMENSALES_POR_DEFECTO))
  const ref = doc(db, 'menus', wid)
  if (!menu) {
    await setDoc(
      ref,
      { ...emptyWeek(wid), persons: n, createdAt: ahora(), updatedAt: ahora() },
      { merge: true }
    )
  } else {
    await updateDoc(ref, { persons: n, updatedAt: ahora() })
  }
  return n
}

/* Lee una semana guardada, o null si no existe */
export async function getWeek(wid) {
  if (!wid) return null
  const snap = await getDoc(doc(db, 'menus', wid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/* ============================================================
   COPIAR UNA SEMANA ENTERA

   Reemplaza el destino con los platos, horarios y comensales del
   origen. Devuelve cuántos platos se han copiado.

   OJO con el orden: antes escribía el destino y DESPUÉS contaba los
   platos, así que copiar desde una semana vacía dejaba el destino en
   blanco mientras la app decía «no hay nada que copiar». Se perdió
   una semana entera así. Si el origen no tiene platos, aquí no se
   escribe nada.
   ============================================================ */
export async function copyWeek(fromWid, toWid) {
  if (!fromWid || !toWid || fromWid === toWid) return 0

  const origen = await getWeek(fromWid)
  if (!origen) return 0

  const src = normalizeDays(origen, fromWid)
  const base = emptyWeek(toWid)
  const days = base.days.map((d, i) => ({
    ...d, // conserva el nombre y la fecha reales del día de destino
    schedule: src[i]?.schedule || null,
    lunch: src[i]?.lunch || null,
    dinner: src[i]?.dinner || null,
  }))

  const platos = countMeals({ days })
  if (!platos) return 0 // nada que copiar: no se toca el destino

  await setDoc(doc(db, 'menus', toWid), {
    ...base,
    persons: origen.persons || COMENSALES_POR_DEFECTO,
    days,
    updatedAt: ahora(),
  })

  return platos
}

/* ============================================================
   PLANIFICACIÓN SEMANAL

   Estructura del documento /menus/{año-semana}:
   { week, year, dateRange, persons, days: [ { day, date, schedule,
     lunch, dinner } x7 ] }

   Todas las escrituras van dentro de una transacción: la app la
   usan dos móviles a la vez, y reescribir el array `days` entero a
   partir de la copia en memoria hacía que el último en guardar
   borrase el cambio del otro.
   ============================================================ */
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase'
import { DAYS_ES, parseWeekId, dateForDay, formatDayMonth, weekRangeLabel } from './dates'

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

/* Cuántos platos tiene asignados una semana */
export function countMeals(menu) {
  if (!menu?.days) return 0
  let n = 0
  for (const d of menu.days) {
    if (d.lunch) n++
    if (d.dinner) n++
  }
  return n
}

/* ============================================================
   ESCRITURA TRANSACCIONAL

   Relee el documento dentro de la transacción y aplica `transformar`
   sobre los días recién leídos. Si dos móviles editan a la vez,
   Firestore reintenta en vez de perder uno de los dos cambios.
   ============================================================ */
async function actualizarDias(wid, transformar) {
  const ref = doc(db, 'menus', wid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)

    if (!snap.exists()) {
      const base = emptyWeek(wid)
      tx.set(ref, {
        ...base,
        days: transformar(base.days),
        createdAt: ahora(),
        updatedAt: ahora(),
      })
      return
    }

    const datos = snap.data()
    tx.update(ref, {
      days: transformar(normalizeDays(datos, wid)),
      updatedAt: ahora(),
    })
  })
}

/* Asigna (o quita, con `meal` a null) un plato en un día concreto */
export async function setMeal(wid, dayIndex, type, meal) {
  await actualizarDias(wid, (dias) =>
    dias.map((d, i) => (i === dayIndex ? { ...d, [type]: meal } : d))
  )
}

/* Cambia solo la nota de un plato, sin tocar el resto */
export async function setMealNote(wid, dayIndex, type, note) {
  await actualizarDias(wid, (dias) =>
    dias.map((d, i) => {
      if (i !== dayIndex) return d
      const meal = d[type]
      if (!meal) return d
      return { ...d, [type]: { ...meal, notes: note || null } }
    })
  )
}

/* Texto de horario / observaciones del día */
export async function setDaySchedule(wid, dayIndex, schedule) {
  await actualizarDias(wid, (dias) =>
    dias.map((d, i) => (i === dayIndex ? { ...d, schedule: schedule || null } : d))
  )
}

/* Número de comensales de la semana */
export async function setWeekPersons(wid, persons) {
  const ref = doc(db, 'menus', wid)
  const n = Math.max(1, Math.min(20, parseInt(persons, 10) || COMENSALES_POR_DEFECTO))
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) {
      tx.set(ref, { ...emptyWeek(wid), persons: n, createdAt: ahora(), updatedAt: ahora() })
      return
    }
    tx.update(ref, { persons: n, updatedAt: ahora() })
  })
  return n
}

/* ============================================================
   COPIAR UNA SEMANA ENTERA

   Reemplaza el destino con los platos, horarios y comensales del
   origen. Devuelve cuántos platos se han copiado.
   ============================================================ */
export async function copyWeek(fromWid, toWid) {
  if (!fromWid || !toWid || fromWid === toWid) return 0

  const origen = await getDoc(doc(db, 'menus', fromWid))
  if (!origen.exists()) return 0

  const datos = origen.data()
  const src = normalizeDays(datos, fromWid)
  const base = emptyWeek(toWid)
  const days = base.days.map((d, i) => ({
    ...d, // conserva el nombre y la fecha reales del día de destino
    schedule: src[i]?.schedule || null,
    lunch: src[i]?.lunch || null,
    dinner: src[i]?.dinner || null,
  }))

  await setDoc(doc(db, 'menus', toWid), {
    ...base,
    persons: datos.persons || COMENSALES_POR_DEFECTO,
    days,
    updatedAt: ahora(),
  })

  return countMeals({ days })
}

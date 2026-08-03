/* ============================================================
   PLANIFICACIÓN SEMANAL
   Estructura del documento /menus/{año-semana}:
   { week, year, dateRange, persons, days: [ { day, date, schedule,
     lunch, dinner } x7 ] }
   ============================================================ */
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { DAYS_ES, parseWeekId, dateForDay, formatDayMonth, weekRangeLabel } from './dates'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/* Esqueleto de una semana vacía */
export function emptyWeek(wid) {
  const { year, week } = parseWeekId(wid)
  return {
    week,
    year,
    dateRange: weekRangeLabel(wid),
    persons: 4,
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

/* Crea el documento de la semana si aún no existe */
export async function ensureWeek(wid) {
  const ref = doc(db, 'menus', wid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, { ...emptyWeek(wid), createdAt: new Date().toISOString() })
    return emptyWeek(wid)
  }
  return { id: snap.id, ...snap.data() }
}

/* Asigna (o quita) un plato en un día concreto */
export async function setMeal(wid, menu, dayIndex, type, meal) {
  await ensureWeek(wid)
  const days = normalizeDays(menu, wid).map((d, i) =>
    i === dayIndex ? { ...d, [type]: meal } : d
  )
  await updateDoc(doc(db, 'menus', wid), { days, updatedAt: new Date().toISOString() })
}

/* Cambia solo la nota de un plato */
export async function setMealNote(wid, menu, dayIndex, type, note) {
  const days = normalizeDays(menu, wid)
  const meal = days[dayIndex]?.[type]
  if (!meal) return
  await setMeal(wid, menu, dayIndex, type, { ...meal, notes: note })
}

/* Texto de horario / observaciones del día */
export async function setDaySchedule(wid, menu, dayIndex, schedule) {
  await ensureWeek(wid)
  const days = normalizeDays(menu, wid).map((d, i) =>
    i === dayIndex ? { ...d, schedule: schedule || null } : d
  )
  await updateDoc(doc(db, 'menus', wid), { days, updatedAt: new Date().toISOString() })
}

/* Copia todos los platos de una semana a otra */
export async function copyWeek(fromMenu, fromWid, toWid) {
  const src = normalizeDays(fromMenu, fromWid)
  const base = emptyWeek(toWid)
  const days = base.days.map((d, i) => ({
    ...d,
    schedule: src[i]?.schedule || null,
    lunch: src[i]?.lunch || null,
    dinner: src[i]?.dinner || null,
  }))
  await setDoc(doc(db, 'menus', toWid), {
    ...base,
    days,
    updatedAt: new Date().toISOString(),
  })
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

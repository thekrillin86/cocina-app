/* Utilidades de fecha y semana ISO */

export const DAYS_ES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
]
export const DAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
export const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/* ============================================================
   UTILIDADES FECHA
   ============================================================ */

export function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week: weekNum }
}

export function weekId(year, week) {
  return `${year}-${String(week).padStart(2, '0')}`
}

export function parseWeekId(id) {
  const [y, w] = id.split('-')
  return { year: parseInt(y, 10), week: parseInt(w, 10) }
}

// Índice del día de hoy dentro de una semana (lunes=0, domingo=6)
export function getTodayWeekIndex() {
  const day = new Date().getDay() // 0=dom, 1=lun
  return day === 0 ? 6 : day - 1
}

export function formatLongDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  return `${DAYS_ES[dow]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`
}

export function shiftWeekId(id, delta) {
  const { year, week } = parseWeekId(id)
  // Aproximación: sumar/restar 7 días desde el lunes de esa semana
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7)
  monday.setUTCDate(monday.getUTCDate() + delta * 7)
  const iso = getISOWeek(monday)
  return weekId(iso.year, iso.week)
}

/* Fecha real (Date UTC) del lunes de una semana ISO */
export function mondayOfWeek(wid) {
  const { year, week } = parseWeekId(wid)
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7))
  const dow = simple.getUTCDay() || 7
  simple.setUTCDate(simple.getUTCDate() - dow + 1)
  return simple
}

/* Fecha real del día `index` (0 = lunes) de una semana ISO */
export function dateForDay(wid, index) {
  const d = mondayOfWeek(wid)
  d.setUTCDate(d.getUTCDate() + index)
  return d
}

export const DAYS_SHORT_LOWER = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/* "4 ago" */
export function formatDayMonth(date) {
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`
}

/* Días naturales entre hoy y una fecha (0 = hoy, 1 = mañana, negativo = pasado) */
export function daysUntil(date) {
  const today = new Date()
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.round((b - a) / 86400000)
}

/* Rango legible "3 – 9 ago 2026" */
export function weekRangeLabel(wid) {
  const a = dateForDay(wid, 0)
  const b = dateForDay(wid, 6)
  const { year } = parseWeekId(wid)
  return `${a.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]} ${year}`
}

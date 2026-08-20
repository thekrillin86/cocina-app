/* ============================================================
   UTILIDADES DE FECHA Y SEMANA ISO

   Convenio: los identificadores de semana son "AAAA-SS" y todas
   las fechas derivadas de ellos se manejan en UTC, para que el
   día no baile por husos horarios ni por el horario de verano.
   Las fechas "de hoy" llegan en hora local y se convierten aquí.
   ============================================================ */

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
export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const MS_DIA = 86400000

/* ============================================================
   SEMANA ISO
   ============================================================ */

/* Semana ISO de una fecha ya expresada en UTC.
   Regla ISO 8601: la semana de una fecha es la del jueves de esa
   misma semana, y la semana 1 es la que contiene el 4 de enero. */
function isoWeekFromUTCDate(date) {
  const jueves = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const diaSemana = jueves.getUTCDay() || 7 // lunes=1 … domingo=7
  jueves.setUTCDate(jueves.getUTCDate() + 4 - diaSemana)
  const inicioAno = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((jueves - inicioAno) / MS_DIA + 1) / 7)
  return { year: jueves.getUTCFullYear(), week }
}

/* Semana ISO de una fecha local (por defecto, hoy) */
export function getISOWeek(date = new Date()) {
  return isoWeekFromUTCDate(
    new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  )
}

export function weekId(year, week) {
  return `${year}-${String(week).padStart(2, '0')}`
}

export function parseWeekId(id) {
  const [y, w] = String(id || '').split('-')
  return { year: parseInt(y, 10), week: parseInt(w, 10) }
}

/* Identificador de la semana en la que cae hoy */
export function currentWeekId(date = new Date()) {
  const { year, week } = getISOWeek(date)
  return weekId(year, week)
}

/* ============================================================
   DE SEMANA ISO A FECHAS REALES
   ============================================================ */

/* Lunes (Date UTC) de una semana ISO.

   Se ancla en el 4 de enero, que por definición siempre cae en la
   semana 1. Anclar en el 1 de enero se desviaba una semana entera
   en los años cuyo 1 de enero cae en viernes, sábado o domingo
   (2021, 2022, 2023, 2027, 2028…). */
export function mondayOfWeek(wid) {
  const { year, week } = parseWeekId(wid)
  const enero4 = new Date(Date.UTC(year, 0, 4))
  const diaSemana = enero4.getUTCDay() || 7
  const lunes = new Date(enero4)
  lunes.setUTCDate(enero4.getUTCDate() - (diaSemana - 1) + (week - 1) * 7)
  return lunes
}

/* Fecha real del día `index` (0 = lunes) de una semana ISO */
export function dateForDay(wid, index) {
  const d = mondayOfWeek(wid)
  d.setUTCDate(d.getUTCDate() + index)
  return d
}

/* Desplaza un identificador de semana `delta` semanas (puede ser
   negativo). Cruza bien los cambios de año, incluidas las de 53. */
export function shiftWeekId(id, delta) {
  const lunes = mondayOfWeek(id)
  lunes.setUTCDate(lunes.getUTCDate() + delta * 7)
  const { year, week } = isoWeekFromUTCDate(lunes)
  return weekId(year, week)
}

/* ============================================================
   FORMATO
   ============================================================ */

// Índice del día de hoy dentro de una semana (lunes=0, domingo=6)
export function getTodayWeekIndex(date = new Date()) {
  const day = date.getDay() // 0=domingo, 1=lunes
  return day === 0 ? 6 : day - 1
}

/* "lunes, 4 de enero" (fecha local) */
export function formatLongDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${DAYS_ES[getTodayWeekIndex(d)]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`
}

/* "4 ago" (fecha UTC, derivada de una semana) */
export function formatDayMonth(date) {
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`
}

/* Días naturales entre hoy y una fecha (0 = hoy, 1 = mañana, negativo = pasado) */
export function daysUntil(date) {
  const hoy = new Date()
  const a = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.round((b - a) / MS_DIA)
}

/* Rango legible "3 – 9 ago 2026" */
export function weekRangeLabel(wid) {
  const a = dateForDay(wid, 0)
  const b = dateForDay(wid, 6)
  const mesA = MONTHS_SHORT[a.getUTCMonth()]
  const mesB = MONTHS_SHORT[b.getUTCMonth()]
  // El año que manda es el del domingo: una semana puede empezar en diciembre
  return `${a.getUTCDate()} ${mesA} – ${b.getUTCDate()} ${mesB} ${b.getUTCFullYear()}`
}

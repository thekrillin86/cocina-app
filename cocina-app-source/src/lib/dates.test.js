import { describe, it, expect } from 'vitest'
import {
  getISOWeek,
  weekId,
  parseWeekId,
  currentWeekId,
  mondayOfWeek,
  dateForDay,
  shiftWeekId,
  weekRangeLabel,
  formatDayMonth,
  getTodayWeekIndex,
  daysUntil,
} from './dates'

const iso = (d) => d.toISOString().slice(0, 10)

/* Lunes de la semana ISO 1, calculado de forma independiente:
   el lunes de la semana que contiene el 4 de enero. */
function lunesSemana1(year) {
  const enero4 = new Date(Date.UTC(year, 0, 4))
  const dow = enero4.getUTCDay() || 7
  const d = new Date(enero4)
  d.setUTCDate(enero4.getUTCDate() - (dow - 1))
  return iso(d)
}

describe('mondayOfWeek', () => {
  it('devuelve siempre un lunes', () => {
    for (let y = 2018; y <= 2035; y++) {
      for (let w = 1; w <= 52; w++) {
        expect(mondayOfWeek(weekId(y, w)).getUTCDay()).toBe(1)
      }
    }
  })

  it('acierta la semana 1 aunque el 1 de enero caiga en viernes, sábado o domingo', () => {
    // Estos son los años donde el cálculo anclado en el 1 de enero fallaba
    expect(iso(mondayOfWeek('2021-01'))).toBe('2021-01-04')
    expect(iso(mondayOfWeek('2022-01'))).toBe('2022-01-03')
    expect(iso(mondayOfWeek('2023-01'))).toBe('2023-01-02')
    expect(iso(mondayOfWeek('2027-01'))).toBe('2027-01-04')
    expect(iso(mondayOfWeek('2028-01'))).toBe('2028-01-03')
  })

  it('coincide con el ancla del 4 de enero en 2018-2035', () => {
    for (let y = 2018; y <= 2035; y++) {
      expect(iso(mondayOfWeek(weekId(y, 1)))).toBe(lunesSemana1(y))
    }
  })

  it('mantiene los casos que ya funcionaban', () => {
    expect(iso(mondayOfWeek('2026-01'))).toBe('2025-12-29')
    expect(iso(mondayOfWeek('2026-34'))).toBe('2026-08-17')
  })
})

describe('getISOWeek y mondayOfWeek son inversas', () => {
  it('cualquier día vuelve a la semana de la que salió', () => {
    const d = new Date(Date.UTC(2018, 0, 1))
    while (d.getUTCFullYear() <= 2035) {
      const { year, week } = getISOWeek(
        new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      )
      const wid = weekId(year, week)
      const lunes = mondayOfWeek(wid)
      const diff = Math.round((d - lunes) / 86400000)
      expect(diff).toBeGreaterThanOrEqual(0)
      expect(diff).toBeLessThanOrEqual(6)
      d.setUTCDate(d.getUTCDate() + 1)
    }
  })

  it('el 4 de enero de 2027 cae en la semana 1 y su lunes es el propio día 4', () => {
    const { year, week } = getISOWeek(new Date(2027, 0, 4))
    expect({ year, week }).toEqual({ year: 2027, week: 1 })
    expect(iso(mondayOfWeek(weekId(year, week)))).toBe('2027-01-04')
  })
})

describe('shiftWeekId', () => {
  it('avanza y retrocede una semana', () => {
    expect(shiftWeekId('2026-34', 1)).toBe('2026-35')
    expect(shiftWeekId('2026-34', -1)).toBe('2026-33')
    expect(shiftWeekId('2026-34', 0)).toBe('2026-34')
  })

  it('cruza el cambio de año', () => {
    expect(shiftWeekId('2026-53', 1)).toBe('2027-01')
    expect(shiftWeekId('2027-01', -1)).toBe('2026-53')
    expect(shiftWeekId('2021-52', 1)).toBe('2022-01')
  })

  it('ir y volver deja el identificador igual', () => {
    for (let y = 2020; y <= 2032; y++) {
      for (let w = 1; w <= 52; w++) {
        const id = weekId(y, w)
        expect(shiftWeekId(shiftWeekId(id, 1), -1)).toBe(id)
      }
    }
  })
})

describe('dateForDay y weekRangeLabel', () => {
  it('los 7 días son consecutivos empezando en lunes', () => {
    const dias = [0, 1, 2, 3, 4, 5, 6].map((i) => dateForDay('2027-01', i))
    expect(dias.map(iso)).toEqual([
      '2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07',
      '2027-01-08', '2027-01-09', '2027-01-10',
    ])
  })

  it('el rango de la semana 1 de 2027 ya no se va a diciembre', () => {
    expect(weekRangeLabel('2027-01')).toBe('4 ene – 10 ene 2027')
  })

  it('una semana a caballo entre dos años se etiqueta con el año del domingo', () => {
    expect(weekRangeLabel('2026-01')).toBe('29 dic – 4 ene 2026')
  })

  it('formatDayMonth usa componentes UTC', () => {
    expect(formatDayMonth(dateForDay('2026-34', 0))).toBe('17 ago')
  })
})

describe('helpers de hoy', () => {
  it('getTodayWeekIndex pone el lunes en 0 y el domingo en 6', () => {
    expect(getTodayWeekIndex(new Date(2026, 7, 17))).toBe(0) // lunes
    expect(getTodayWeekIndex(new Date(2026, 7, 23))).toBe(6) // domingo
  })

  it('currentWeekId compone el identificador de una fecha dada', () => {
    expect(currentWeekId(new Date(2026, 7, 20))).toBe('2026-34')
  })

  it('parseWeekId aguanta entradas vacías sin reventar', () => {
    expect(parseWeekId('')).toEqual({ year: NaN, week: NaN })
    expect(parseWeekId(null)).toEqual({ year: NaN, week: NaN })
  })

  it('daysUntil cuenta días naturales', () => {
    const hoy = new Date()
    const hoyUTC = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()))
    expect(daysUntil(hoyUTC)).toBe(0)
    const manana = new Date(hoyUTC)
    manana.setUTCDate(manana.getUTCDate() + 1)
    expect(daysUntil(manana)).toBe(1)
  })
})

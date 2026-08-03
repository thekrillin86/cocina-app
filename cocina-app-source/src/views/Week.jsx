import React, { useState } from 'react'
import { Header, Loading, Tag } from '../components/ui'
import { MealPicker, MealDetail, ManualMealEditor } from '../components/meals'
import {
  DAYS_ES,
  DAYS_SHORT,
  getTodayWeekIndex,
  parseWeekId,
  dateForDay,
  formatDayMonth,
} from '../lib/dates'
import { setMeal, setMealNote, setDaySchedule, normalizeDays, countMeals } from '../lib/plan'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export default function WeekView({
  menu,
  loading,
  wid,
  todayId,
  recipes,
  stats,
  onShiftWeek,
  onBackToToday,
  onSendToShopping,
}) {
  const [slot, setSlot] = useState(null) // { dayIndex, type }
  const [mode, setMode] = useState(null) // 'detail' | 'pick' | 'manual'
  const [editSchedule, setEditSchedule] = useState(null)

  if (loading) return <Loading />

  const { week, year } = parseWeekId(wid)
  const isCurrentWeek = wid === todayId
  const todayIdx = getTodayWeekIndex()
  const days = normalizeDays(menu, wid)
  const total = countMeals(menu)
  const current = slot ? days[slot.dayIndex]?.[slot.type] : null
  const dayLabel = slot ? cap(DAYS_ES[slot.dayIndex]) : ''

  async function assign(meal) {
    await setMeal(wid, menu, slot.dayIndex, slot.type, meal)
    setMode(null)
    setSlot(null)
  }

  function open(dayIndex, type) {
    setSlot({ dayIndex, type })
    setMode(days[dayIndex]?.[type] ? 'detail' : 'pick')
  }

  return (
    <div className="animate-fade-in-up">
      <Header />

      <div className="px-6">
        {/* Navegación de semana */}
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => onShiftWeek(-1)}
            className="w-10 h-10 rounded-full bg-cream-200 text-ink-700 active:bg-cream-300 flex items-center justify-center"
            aria-label="Semana anterior"
          >
            ←
          </button>
          <div className="text-center">
            <h1 className="font-display text-2xl text-ink-900 leading-tight">Semana {week}</h1>
            <p className="text-xs text-ink-500">{menu?.dateRange || year}</p>
          </div>
          <button
            onClick={() => onShiftWeek(1)}
            className="w-10 h-10 rounded-full bg-cream-200 text-ink-700 active:bg-cream-300 flex items-center justify-center"
            aria-label="Semana siguiente"
          >
            →
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mb-5 mt-2">
          {!isCurrentWeek && (
            <button onClick={onBackToToday} className="text-xs text-terracotta-600 font-medium">
              Volver a la semana actual
            </button>
          )}
          <span className="text-xs text-ink-500">
            {total} de 14 platos
          </span>
        </div>

        {/* Acción principal: pasar a la compra */}
        {total > 0 && (
          <button
            onClick={() => onSendToShopping(wid)}
            className="btn-primary w-full mb-5 text-sm py-3"
          >
            🛒 Pasar ingredientes a la compra
          </button>
        )}

        {/* Días */}
        <div className="space-y-3 pb-6">
          {days.map((d, i) => (
            <DayCard
              key={i}
              day={d}
              index={i}
              isToday={isCurrentWeek && i === todayIdx}
              dateLabel={formatDayMonth(dateForDay(wid, i))}
              onOpen={open}
              onEditSchedule={() => setEditSchedule({ index: i, value: d.schedule || '' })}
            />
          ))}
        </div>
      </div>

      {mode === 'detail' && current && (
        <MealDetail
          meal={current}
          mealType={slot.type}
          dayLabel={dayLabel}
          onClose={() => {
            setMode(null)
            setSlot(null)
          }}
          onChange={() => setMode('pick')}
          onManual={() => setMode('manual')}
          onSetNote={async (note) => {
            await setMealNote(wid, menu, slot.dayIndex, slot.type, note)
          }}
          onRemove={async () => {
            await setMeal(wid, menu, slot.dayIndex, slot.type, null)
            setMode(null)
            setSlot(null)
          }}
        />
      )}

      {mode === 'pick' && slot && (
        <MealPicker
          recipes={recipes}
          stats={stats}
          mealType={slot.type}
          dayLabel={dayLabel}
          onPick={assign}
          onManual={() => setMode('manual')}
          onClose={() => {
            setMode(null)
            setSlot(null)
          }}
        />
      )}

      {mode === 'manual' && slot && (
        <ManualMealEditor
          meal={current}
          mealType={slot.type}
          dayLabel={dayLabel}
          onSave={assign}
          onClose={() => {
            setMode(null)
            setSlot(null)
          }}
        />
      )}

      {editSchedule && (
        <ScheduleModal
          value={editSchedule.value}
          dayLabel={cap(DAYS_ES[editSchedule.index])}
          onClose={() => setEditSchedule(null)}
          onSave={async (v) => {
            await setDaySchedule(wid, menu, editSchedule.index, v)
            setEditSchedule(null)
          }}
        />
      )}
    </div>
  )
}

function DayCard({ day, index, isToday, dateLabel, onOpen, onEditSchedule }) {
  return (
    <div className={`card p-4 ${isToday ? 'ring-2 ring-terracotta-500' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
              isToday ? 'bg-terracotta-500 text-cream-50' : 'bg-cream-200 text-ink-700'
            }`}
          >
            {DAYS_SHORT[index]}
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg text-ink-900 leading-none truncate">
              {cap(DAYS_ES[index])}
            </p>
            <p className="text-[11px] text-ink-500">{dateLabel}</p>
          </div>
        </div>
        <button onClick={onEditSchedule} className="text-xs text-ink-500 shrink-0 px-2">
          {day.schedule ? '✏️ Horario' : '+ Horario'}
        </button>
      </div>

      {day.schedule && (
        <p className="text-xs text-ink-500 italic mb-3 -mt-1">{day.schedule}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Slot label="Comida" meal={day.lunch} onClick={() => onOpen(index, 'lunch')} />
        <Slot label="Cena" meal={day.dinner} onClick={() => onOpen(index, 'dinner')} />
      </div>
    </div>
  )
}

function Slot({ label, meal, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl px-3 py-2.5 min-h-[72px] transition-colors ${
        meal
          ? 'bg-cream-100 active:bg-cream-200'
          : 'border-2 border-dashed border-cream-300 active:bg-cream-100'
      }`}
    >
      <p className="label-caps text-teal-700 text-[10px] mb-1">{label}</p>
      {meal ? (
        <>
          <p className="text-sm text-ink-900 leading-snug line-clamp-2">{meal.name}</p>
          {meal.notes && (
            <span className="inline-block mt-1 text-[10px] text-terracotta-600">{meal.notes}</span>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-500">+ Elegir</p>
      )}
    </button>
  )
}

function ScheduleModal({ value, dayLabel, onClose, onSave }) {
  const [text, setText] = useState(value)
  const presets = [
    'Mañana ocupada · cocinar la noche anterior',
    'Tarde ocupada · cocinar por la mañana',
    'Teletrabajo · cocinar cuando quiera',
    '🧗 Escalar · tupper listo antes de salir',
  ]
  return (
    <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-cream-50 w-full max-w-md rounded-t-3xl sm:rounded-3xl safe-bottom max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-cream-50 border-b border-cream-200 px-5 py-4 flex items-center justify-between">
          <button onClick={onClose} className="text-ink-500 text-sm font-medium">
            Cancelar
          </button>
          <p className="font-display text-lg">{dayLabel}</p>
          <button
            onClick={() => onSave(text.trim())}
            className="text-terracotta-600 text-sm font-semibold"
          >
            Guardar
          </button>
        </div>
        <div className="p-5 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Ej: Mañana ocupada · cocinar la noche anterior"
            className="input resize-none"
          />
          <p className="label-caps text-ink-500">Atajos</p>
          <div className="space-y-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setText(p)}
                className="w-full text-left text-sm px-4 py-3 rounded-2xl bg-cream-100 text-ink-700 active:bg-cream-200"
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setText('')}
              className="w-full text-left text-sm px-4 py-3 rounded-2xl text-ink-500"
            >
              Sin horario
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { Header, Loading, Sheet, Chip, useConfirm, useToast } from '../components/ui'
import { MealPicker, SlotDetail, ManualMealEditor } from '../components/meals'
import {
  DAYS_ES,
  DAYS_SHORT,
  parseWeekId,
  dateForDay,
  formatDayMonth,
  shiftWeekId,
  weekRangeLabel,
} from '../lib/dates'
import {
  addDish,
  replaceDish,
  removeDish,
  setDishNote,
  setDaySchedule,
  setWeekPersons,
  copyWeek,
  normalizeDays,
  countMeals,
  countDishes,
  COMENSALES_POR_DEFECTO,
} from '../lib/plan'
import { asDishes } from '../lib/dishes'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export default function WeekView({
  menu,
  loading,
  wid,
  today,
  recipes,
  stats,
  onShiftWeek,
  onBackToToday,
  onSendToShopping,
}) {
  const [slot, setSlot] = useState(null) // { dayIndex, type }
  const [mode, setMode] = useState(null) // 'detail' | 'pick' | 'manual'
  const [indice, setIndice] = useState(null) // plato a tocar; null = anadir uno nuevo
  const [editSchedule, setEditSchedule] = useState(null)
  const [ajustes, setAjustes] = useState(false)
  const [copiando, setCopiando] = useState(false)
  const confirmar = useConfirm()
  const avisar = useToast()

  if (loading) return <Loading />

  const { week } = parseWeekId(wid)
  const isCurrentWeek = wid === today.weekId
  const days = normalizeDays(menu, wid)
  const total = countMeals(menu)
  const totalPlatos = countDishes(menu)
  const current = slot ? days[slot.dayIndex]?.[slot.type] : null
  const platos = asDishes(current)
  const dayLabel = slot ? cap(DAYS_ES[slot.dayIndex]) : ''

  function cerrar() {
    setMode(null)
    setSlot(null)
    setIndice(null)
  }

  /* Si el hueco estaba vacio se cierra todo; si ya tenia platos se
     vuelve a la ficha para poder seguir anadiendo o valorando. */
  async function assign(meal) {
    const estabaVacio = platos.length === 0
    if (indice == null) await addDish(wid, slot.dayIndex, slot.type, meal)
    else await replaceDish(wid, slot.dayIndex, slot.type, indice, meal)
    if (estabaVacio) cerrar()
    else {
      setMode('detail')
      setIndice(null)
    }
  }

  function open(dayIndex, type) {
    setSlot({ dayIndex, type })
    setIndice(null)
    setMode(asDishes(days[dayIndex]?.[type]).length ? 'detail' : 'pick')
  }

  async function copiarSemanaAnterior() {
    const origen = shiftWeekId(wid, -1)
    if (total > 0) {
      const ok = await confirmar({
        title: 'Copiar la semana anterior',
        message: `Se reemplazarán los ${total} platos que ya hay en la semana ${week}. Esto no se puede deshacer.`,
        confirmLabel: 'Reemplazar',
        danger: true,
      })
      if (!ok) return
    }
    setCopiando(true)
    try {
      const copiados = await copyWeek(origen, wid)
      if (copiados > 0) avisar(`${copiados} platos copiados de la semana anterior`, 'ok')
      else avisar('La semana anterior está vacía, no hay nada que copiar')
    } catch (e) {
      avisar('No se ha podido copiar: ' + (e?.message || e), 'error')
    } finally {
      setCopiando(false)
    }
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
            <p className="text-xs text-ink-500">{menu?.dateRange || weekRangeLabel(wid)}</p>
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
            {total} de 14 comidas
            {totalPlatos > total && ` · ${totalPlatos} platos`}
          </span>
          <button onClick={() => setAjustes(true)} className="text-xs text-ink-500 font-medium">
            {menu?.persons || COMENSALES_POR_DEFECTO} comensales ⚙️
          </button>
        </div>

        {/* Acciones principales */}
        <div className="space-y-2 mb-5">
          {total > 0 && (
            <button
              onClick={() => onSendToShopping(wid)}
              className="btn-primary w-full text-sm py-3"
            >
              🛒 Pasar ingredientes a la compra
            </button>
          )}
          <button
            onClick={copiarSemanaAnterior}
            disabled={copiando}
            className="w-full py-3 rounded-full bg-teal-50 text-teal-700 text-sm font-medium active:bg-teal-100 disabled:opacity-50"
          >
            {copiando ? 'Copiando…' : '📋 Copiar la semana anterior'}
          </button>
        </div>

        {/* Días */}
        <div className="space-y-3 pb-6">
          {days.map((d, i) => (
            <DayCard
              key={i}
              day={d}
              index={i}
              isToday={isCurrentWeek && i === today.dayIndex}
              dateLabel={formatDayMonth(dateForDay(wid, i))}
              onOpen={open}
              onEditSchedule={() => setEditSchedule({ index: i, value: d.schedule || '' })}
            />
          ))}
        </div>
      </div>

      {mode === 'detail' && slot && platos.length > 0 && (
        <SlotDetail
          slot={current}
          mealType={slot.type}
          dayLabel={dayLabel}
          recipes={recipes}
          stats={stats}
          onClose={cerrar}
          onChangeDish={(i) => {
            setIndice(i)
            setMode('pick')
          }}
          onAddDish={() => {
            setIndice(null)
            setMode('pick')
          }}
          onEditDish={(i) => {
            setIndice(i)
            setMode('manual')
          }}
          onSetNote={(i, note) => setDishNote(wid, slot.dayIndex, slot.type, i, note)}
          onRemoveDish={async (i) => {
            await removeDish(wid, slot.dayIndex, slot.type, i)
            if (platos.length <= 1) cerrar()
          }}
        />
      )}

      {mode === 'pick' && slot && (
        <MealPicker
          recipes={recipes}
          stats={stats}
          mealType={slot.type}
          dayLabel={dayLabel}
          anadiendo={indice == null && platos.length > 0}
          onPick={assign}
          onManual={() => setMode('manual')}
          onClose={() => (platos.length ? setMode('detail') : cerrar())}
        />
      )}

      {mode === 'manual' && slot && (
        <ManualMealEditor
          meal={indice == null ? null : platos[indice]}
          mealType={slot.type}
          dayLabel={dayLabel}
          onSave={assign}
          onClose={() => (platos.length ? setMode('detail') : cerrar())}
        />
      )}

      {editSchedule && (
        <ScheduleModal
          value={editSchedule.value}
          dayLabel={cap(DAYS_ES[editSchedule.index])}
          onClose={() => setEditSchedule(null)}
          onSave={async (v) => {
            await setDaySchedule(wid, editSchedule.index, v)
            setEditSchedule(null)
          }}
        />
      )}

      {ajustes && (
        <PersonsModal
          value={menu?.persons || COMENSALES_POR_DEFECTO}
          onClose={() => setAjustes(false)}
          onSave={async (n) => {
            await setWeekPersons(wid, n)
            setAjustes(false)
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

      {day.schedule && <p className="text-xs text-ink-500 italic mb-3 -mt-1">{day.schedule}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Slot label="Comida" slot={day.lunch} onClick={() => onOpen(index, 'lunch')} />
        <Slot label="Cena" slot={day.dinner} onClick={() => onOpen(index, 'dinner')} />
      </div>
    </div>
  )
}

function Slot({ label, slot, onClick }) {
  const platos = asDishes(slot)
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl px-3 py-2.5 min-h-[72px] transition-colors ${
        platos.length
          ? 'bg-cream-100 active:bg-cream-200'
          : 'border-2 border-dashed border-cream-300 active:bg-cream-100'
      }`}
    >
      <p className="label-caps text-teal-700 text-[10px] mb-1">{label}</p>
      {platos.length ? (
        <div className="space-y-1">
          {platos.map((meal, i) => (
            <div key={i}>
              <p className="text-sm text-ink-900 leading-snug line-clamp-2">
                {i > 0 && <span className="text-ink-500">+ </span>}
                {meal.name}
              </p>
              {meal.notes && (
                <span className="inline-block text-[10px] text-terracotta-600">{meal.notes}</span>
              )}
            </div>
          ))}
        </div>
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
    <Sheet
      title={dayLabel}
      onClose={onClose}
      onCloseLabel="Cancelar"
      action={
        <button
          onClick={() => onSave(text.trim())}
          className="text-terracotta-600 text-sm font-semibold"
        >
          Guardar
        </button>
      }
    >
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
    </Sheet>
  )
}

function PersonsModal({ value, onClose, onSave }) {
  const [n, setN] = useState(value)

  return (
    <Sheet
      title="Comensales de la semana"
      onClose={onClose}
      onCloseLabel="Cancelar"
      action={
        <button onClick={() => onSave(n)} className="text-terracotta-600 text-sm font-semibold">
          Guardar
        </button>
      }
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setN((v) => Math.max(1, v - 1))}
            className="w-12 h-12 rounded-full bg-cream-200 text-ink-700 text-2xl active:bg-cream-300"
            aria-label="Uno menos"
          >
            −
          </button>
          <span className="font-display text-5xl text-ink-900 w-16 text-center">{n}</span>
          <button
            onClick={() => setN((v) => Math.min(20, v + 1))}
            className="w-12 h-12 rounded-full bg-cream-200 text-ink-700 text-2xl active:bg-cream-300"
            aria-label="Uno más"
          >
            +
          </button>
        </div>
        <div className="flex justify-center gap-2">
          {[2, 3, 4, 5].map((v) => (
            <Chip key={v} active={n === v} onClick={() => setN(v)}>
              {v}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-ink-500 text-center">
          Se guarda con la semana, junto al histórico. Las cantidades de las recetas no se
          reescalan solas.
        </p>
      </div>
    </Sheet>
  )
}

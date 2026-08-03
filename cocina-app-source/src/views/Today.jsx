import React, { useState } from 'react'
import { Header, Loading, EmptyState, Tag } from '../components/ui'
import { MealCard, MealPicker, MealDetail, ManualMealEditor } from '../components/meals'
import { getTodayWeekIndex, formatLongDate, DAYS_ES } from '../lib/dates'
import { setMeal, setMealNote, normalizeDays } from '../lib/plan'

export default function TodayView({
  menu,
  loading,
  wid,
  isCurrentWeek,
  recipes,
  stats,
  onGoToWeek,
  onBackToToday,
}) {
  const [slot, setSlot] = useState(null) // { type }
  const [mode, setMode] = useState(null) // 'detail' | 'pick' | 'manual'
  const todayIdx = getTodayWeekIndex()
  const now = new Date()

  if (loading) return <Loading />

  const days = menu ? normalizeDays(menu, wid) : null
  const todayData = days?.[todayIdx]
  const dayLabel = DAYS_ES[todayIdx]
  const current = slot ? todayData?.[slot.type] : null

  async function assign(meal) {
    await setMeal(wid, menu, todayIdx, slot.type, meal)
    setMode(null)
    setSlot(null)
  }

  function open(type) {
    setSlot({ type })
    setMode(todayData?.[type] ? 'detail' : 'pick')
  }

  if (!menu) {
    return (
      <div className="px-6 pt-4">
        <Header />
        <EmptyState
          title={isCurrentWeek ? 'Todavía no hay menú esta semana' : 'Semana sin planificar'}
          hint="Ve a «Semana» y ve eligiendo platos del recetario para cada día."
          action={
            <button onClick={onGoToWeek} className="btn-primary">
              Planificar la semana
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up">
      <Header />

      <div className="px-6">
        {!isCurrentWeek && (
          <button onClick={onBackToToday} className="mb-4 text-sm text-terracotta-600 font-medium">
            ← Volver a hoy
          </button>
        )}

        <div className="mb-6">
          <p className="label-caps text-terracotta-600 mb-1">
            Semana {menu.week} · {menu.year}
          </p>
          <h1 className="font-display text-4xl leading-tight text-ink-900">
            {formatLongDate(now)}
          </h1>
          {todayData?.schedule && (
            <p className="text-ink-500 mt-2 text-sm italic">{todayData.schedule}</p>
          )}
        </div>

        {todayData ? (
          <div className="space-y-4">
            <MealCard meal={todayData.lunch} label="Comida" onEdit={() => open('lunch')} />
            <MealCard meal={todayData.dinner} label="Cena" onEdit={() => open('dinner')} />
          </div>
        ) : (
          <EmptyState title="No hay datos para hoy" hint="Comprueba el menú semanal." />
        )}

        <button
          onClick={onGoToWeek}
          className="mt-8 w-full text-center py-3 text-terracotta-600 font-medium"
        >
          Ver semana completa →
        </button>
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
            await setMealNote(wid, menu, todayIdx, slot.type, note)
          }}
          onRemove={async () => {
            await setMeal(wid, menu, todayIdx, slot.type, null)
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
    </div>
  )
}

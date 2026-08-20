import React, { useState } from 'react'
import { Header, Loading, EmptyState } from '../components/ui'
import { MealCard, MealPicker, MealDetail, ManualMealEditor } from '../components/meals'
import { formatLongDate, DAYS_ES } from '../lib/dates'
import { setMeal, setMealNote, normalizeDays } from '../lib/plan'

export default function TodayView({ menu, loading, wid, today, recipes, stats, onGoToWeek }) {
  const [slot, setSlot] = useState(null) // { type }
  const [mode, setMode] = useState(null) // 'detail' | 'pick' | 'manual'

  if (loading) return <Loading />

  const todayIdx = today.dayIndex
  const days = menu ? normalizeDays(menu, wid) : null
  const todayData = days?.[todayIdx]
  const dayLabel = DAYS_ES[todayIdx]
  const current = slot ? todayData?.[slot.type] : null

  function cerrar() {
    setMode(null)
    setSlot(null)
  }

  async function assign(meal) {
    await setMeal(wid, todayIdx, slot.type, meal)
    cerrar()
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
          title="Todavía no hay menú esta semana"
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
        <div className="mb-6">
          <p className="label-caps text-terracotta-600 mb-1">
            Semana {menu.week} · {menu.year}
          </p>
          <h1 className="font-display text-4xl leading-tight text-ink-900">
            {formatLongDate(today.date)}
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
          onClose={cerrar}
          onChange={() => setMode('pick')}
          onManual={() => setMode('manual')}
          onSetNote={(note) => setMealNote(wid, todayIdx, slot.type, note)}
          onRemove={async () => {
            await setMeal(wid, todayIdx, slot.type, null)
            cerrar()
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
          onClose={cerrar}
        />
      )}

      {mode === 'manual' && slot && (
        <ManualMealEditor
          meal={current}
          mealType={slot.type}
          dayLabel={dayLabel}
          onSave={assign}
          onClose={cerrar}
        />
      )}
    </div>
  )
}

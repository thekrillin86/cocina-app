import React, { useState } from 'react'
import { Header, Loading, EmptyState } from '../components/ui'
import { MealCard, MealPicker, SlotDetail, ManualMealEditor } from '../components/meals'
import { formatLongDate, DAYS_ES } from '../lib/dates'
import { asDishes } from '../lib/dishes'
import { addDish, replaceDish, removeDish, setDishNote, normalizeDays } from '../lib/plan'

export default function TodayView({ menu, loading, wid, today, recipes, stats, onGoToWeek }) {
  const [tipo, setTipo] = useState(null) // 'lunch' | 'dinner'
  const [modo, setModo] = useState(null) // 'detail' | 'pick' | 'manual'
  const [indice, setIndice] = useState(null) // plato a tocar; null = añadir uno nuevo

  if (loading) return <Loading />

  const todayIdx = today.dayIndex
  const days = menu ? normalizeDays(menu, wid) : null
  const todayData = days?.[todayIdx]
  const dayLabel = DAYS_ES[todayIdx]
  const slot = tipo ? todayData?.[tipo] : null
  const platos = asDishes(slot)

  function cerrar() {
    setModo(null)
    setTipo(null)
    setIndice(null)
  }

  function abrir(type) {
    setTipo(type)
    if (asDishes(todayData?.[type]).length) {
      setModo('detail')
      setIndice(null)
    } else {
      setModo('pick')
      setIndice(null)
    }
  }

  /* Al asignar: si el hueco estaba vacío se cierra todo, y si ya
     tenía platos se vuelve a la ficha para poder seguir. */
  async function asignar(meal) {
    const estabaVacio = platos.length === 0
    if (indice == null) await addDish(wid, todayIdx, tipo, meal)
    else await replaceDish(wid, todayIdx, tipo, indice, meal)
    if (estabaVacio) cerrar()
    else {
      setModo('detail')
      setIndice(null)
    }
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
            <MealCard slot={todayData.lunch} label="Comida" onEdit={() => abrir('lunch')} />
            <MealCard slot={todayData.dinner} label="Cena" onEdit={() => abrir('dinner')} />
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

      {modo === 'detail' && tipo && (
        <SlotDetail
          slot={slot}
          mealType={tipo}
          dayLabel={dayLabel}
          recipes={recipes}
          stats={stats}
          onClose={cerrar}
          onChangeDish={(i) => {
            setIndice(i)
            setModo('pick')
          }}
          onAddDish={() => {
            setIndice(null)
            setModo('pick')
          }}
          onEditDish={(i) => {
            setIndice(i)
            setModo('manual')
          }}
          onSetNote={(i, note) => setDishNote(wid, todayIdx, tipo, i, note)}
          onRemoveDish={async (i) => {
            await removeDish(wid, todayIdx, tipo, i)
            if (platos.length <= 1) cerrar()
          }}
        />
      )}

      {modo === 'pick' && tipo && (
        <MealPicker
          recipes={recipes}
          stats={stats}
          mealType={tipo}
          dayLabel={dayLabel}
          anadiendo={indice == null && platos.length > 0}
          onPick={asignar}
          onManual={() => setModo('manual')}
          onClose={() => (platos.length ? setModo('detail') : cerrar())}
        />
      )}

      {modo === 'manual' && tipo && (
        <ManualMealEditor
          meal={indice == null ? null : platos[indice]}
          mealType={tipo}
          dayLabel={dayLabel}
          onSave={asignar}
          onClose={() => (platos.length ? setModo('detail') : cerrar())}
        />
      )}
    </div>
  )
}

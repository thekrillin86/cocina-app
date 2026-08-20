import React from 'react'
import { Header, Loading, EmptyState, useConfirm, useToast } from '../components/ui'
import { deleteMenu } from '../lib/db'
import { weekRangeLabel } from '../lib/dates'

export function HistoryView({ menus, loading, todayWeekId, onOpen }) {
  const confirmar = useConfirm()
  const avisar = useToast()

  async function eliminar(m) {
    const ok = await confirmar({
      title: `Eliminar la semana ${m.week}`,
      message: `Se borrará la planificación de ${m.dateRange || m.year} con todos sus platos. Esto no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteMenu(m.id)
      avisar(`Semana ${m.week} eliminada`, 'ok')
    } catch (e) {
      avisar('No se ha podido eliminar: ' + (e?.message || e), 'error')
    }
  }

  if (loading) return <Loading />

  return (
    <div className="animate-fade-in-up">
      <Header />
      <div className="px-6">
        <h1 className="font-display text-3xl text-ink-900 mb-6">Histórico</h1>

        {!menus.length ? (
          <EmptyState title="Aún no hay semanas guardadas" hint="Importa un menú para empezar." />
        ) : (
          <div className="space-y-3">
            {menus.map((m) => {
              const totalMeals =
                m.days?.reduce(
                  (acc, d) => acc + (d.lunch ? 1 : 0) + (d.dinner ? 1 : 0),
                  0
                ) || 0
              return (
                <div key={m.id} className="card p-4 flex items-center gap-2">
                  <button onClick={() => onOpen(m.id)} className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <p className="label-caps text-terracotta-600">
                          Semana {m.week} · {m.year}
                          {m.id === todayWeekId && ' · actual'}
                        </p>
                        <p className="font-display text-lg text-ink-900 mt-0.5 truncate">
                          {m.dateRange || weekRangeLabel(m.id)}
                        </p>
                      </div>
                      <div className="text-right text-xs text-ink-500 shrink-0">
                        <p>{totalMeals} platos</p>
                        <p className="mt-0.5">{m.persons || 4} personas</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => eliminar(m)}
                    className="shrink-0 text-ink-500 text-lg px-2"
                    aria-label={`Eliminar la semana ${m.week}`}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

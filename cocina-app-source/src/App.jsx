import React, { useState, useMemo } from 'react'
import { AuthGate } from './AuthGate'
import { getISOWeek, weekId, shiftWeekId } from './lib/dates'
import { useMenu, useAllMenus, useRecipes } from './lib/db'
import { computeUsageStats, guessCategory } from './lib/catalog'
import {
  IconToday,
  IconWeek,
  IconShopping,
  IconMore,
  IconRecipes,
  IconStats,
  IconHistory,
  IconImport,
} from './components/ui'
import TodayView from './views/Today'
import WeekView from './views/Week'
import CatalogView from './views/Catalog'
import ShoppingView from './views/Shopping'
import { StatsView, HistoryView, ImportView } from './views/Extras'

export default function App() {
  return (
    <AuthGate>
      <MainApp />
    </AuthGate>
  )
}

const MORE_VIEWS = ['recipes', 'stats', 'history', 'import']

function MainApp() {
  const [view, setView] = useState('today')
  const [selectedWeekId, setSelectedWeekId] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [shoppingWeek, setShoppingWeek] = useState(null)

  const today = useMemo(() => {
    const { year, week } = getISOWeek()
    return { year, week, id: weekId(year, week) }
  }, [])

  const activeWeekId = selectedWeekId || today.id
  const { menu, loading } = useMenu(activeWeekId)
  const { menus } = useAllMenus()
  const { recipes, loading: loadingRecipes } = useRecipes()

  // Estadísticas de uso (veces cocinado / última vez) a partir del histórico
  const stats = useMemo(() => computeUsageStats(menus), [menus])

  // Recetas con la categoría siempre resuelta
  const catalog = useMemo(
    () => recipes.map((r) => ({ ...r, category: r.category || guessCategory(r.name) })),
    [recipes]
  )

  const go = (v) => {
    if (v === 'today') setSelectedWeekId(null)
    setView(v)
  }

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col">
      <main className="flex-1 pb-28 safe-top">
        {view === 'today' && (
          <TodayView
            menu={menu}
            loading={loading}
            wid={activeWeekId}
            isCurrentWeek={activeWeekId === today.id}
            recipes={catalog}
            stats={stats}
            onGoToWeek={() => setView('week')}
            onBackToToday={() => {
              setSelectedWeekId(null)
              setView('today')
            }}
          />
        )}

        {view === 'week' && (
          <WeekView
            menu={menu}
            loading={loading}
            wid={activeWeekId}
            todayId={today.id}
            recipes={catalog}
            stats={stats}
            onShiftWeek={(delta) => setSelectedWeekId(shiftWeekId(activeWeekId, delta))}
            onBackToToday={() => setSelectedWeekId(null)}
            onSendToShopping={(wid) => {
              setShoppingWeek(wid)
              setView('shopping')
            }}
          />
        )}

        {view === 'shopping' && (
          <ShoppingView
            todayWeekId={today.id}
            menus={menus}
            autoWeek={shoppingWeek}
            onAutoWeekUsed={() => setShoppingWeek(null)}
          />
        )}

        {view === 'recipes' && (
          <CatalogView recipes={catalog} loading={loadingRecipes} menus={menus} stats={stats} />
        )}

        {view === 'stats' && <StatsView />}

        {view === 'history' && (
          <HistoryView
            onOpen={(wid) => {
              setSelectedWeekId(wid)
              setView('week')
            }}
          />
        )}

        {view === 'import' && <ImportView onDone={() => setView('today')} />}
      </main>

      <BottomNav view={view} setView={go} onMore={() => setMoreOpen(true)} />

      <MoreMenu open={moreOpen} onClose={() => setMoreOpen(false)} currentView={view} setView={go} />
    </div>
  )
}

/* ============================================================
   NAVEGACIÓN
   ============================================================ */
function BottomNav({ view, setView, onMore }) {
  const items = [
    { id: 'today', label: 'Hoy', icon: IconToday },
    { id: 'week', label: 'Semana', icon: IconWeek },
    { id: 'shopping', label: 'Compra', icon: IconShopping },
  ]
  const moreActive = MORE_VIEWS.includes(view)

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-cream-50/95 backdrop-blur border-t border-cream-300 safe-bottom z-40">
      <div className="flex justify-around px-2 pt-2 pb-1">
        {items.map((it) => {
          const Icon = it.icon
          const active = view === it.id
          return (
            <button
              key={it.id}
              onClick={() => setView(it.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-colors ${
                active ? 'text-terracotta-600' : 'text-ink-500'
              }`}
            >
              <Icon />
              <span className="text-[10px] font-medium tracking-wide">{it.label}</span>
            </button>
          )
        })}
        <button
          onClick={onMore}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-colors ${
            moreActive ? 'text-terracotta-600' : 'text-ink-500'
          }`}
        >
          <IconMore />
          <span className="text-[10px] font-medium tracking-wide">Más</span>
        </button>
      </div>
    </nav>
  )
}

function MoreMenu({ open, onClose, currentView, setView }) {
  if (!open) return null
  const items = [
    {
      id: 'recipes',
      label: 'Recetario',
      icon: IconRecipes,
      desc: 'Todos los platos, con filtros y valoración',
    },
    { id: 'stats', label: 'Estadísticas', icon: IconStats, desc: 'Calorías y platos más usados' },
    { id: 'history', label: 'Histórico', icon: IconHistory, desc: 'Semanas guardadas' },
    { id: 'import', label: 'Importar JSON', icon: IconImport, desc: 'Pegar un menú completo' },
  ]

  return (
    <div
      className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-cream-50 w-full max-w-lg rounded-t-3xl safe-bottom animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-cream-300" />
        </div>
        <div className="px-5 pb-5 pt-3">
          <h2 className="font-display text-2xl text-ink-900 mb-1">Más opciones</h2>
          <p className="text-sm text-ink-500 mb-5">Elige una sección</p>
          <div className="space-y-2">
            {items.map((it) => {
              const Icon = it.icon
              const active = currentView === it.id
              return (
                <button
                  key={it.id}
                  onClick={() => {
                    setView(it.id)
                    onClose()
                  }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-left transition-colors ${
                    active
                      ? 'bg-terracotta-50 text-terracotta-700'
                      : 'bg-cream-100 text-ink-900 active:bg-cream-200'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      active ? 'bg-terracotta-500 text-cream-50' : 'bg-cream-50 text-ink-700'
                    }`}
                  >
                    <Icon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg leading-tight">{it.label}</p>
                    <p className="text-xs text-ink-500">{it.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

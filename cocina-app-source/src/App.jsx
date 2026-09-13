import React, { useState, useMemo, lazy, Suspense } from 'react'
import { AuthGate, cerrarSesion } from './AuthGate'
import { shiftWeekId } from './lib/dates'
import { useToday } from './lib/useToday'
import { useMenu, useAllMenus, useRecipes } from './lib/db'
import {
  computeUsageStats,
  guessCategory,
  indexRecipesById,
  withLiveRecipes,
} from './lib/catalog'
import {
  DialogProvider,
  Loading,
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
import { HistoryView } from './views/History'
import { ImportView } from './views/Import'

// Las graficas arrastran recharts (~400 KB): solo se descargan si se
// entra en Estadisticas.
const StatsView = lazy(() =>
  import('./views/Stats').then((m) => ({ default: m.StatsView }))
)

export default function App() {
  return (
    <DialogProvider>
      <AuthGate>
        <MainApp />
      </AuthGate>
    </DialogProvider>
  )
}

const MORE_VIEWS = ['recipes', 'stats', 'history', 'import']

function MainApp() {
  const [view, setView] = useState('today')
  const [selectedWeekId, setSelectedWeekId] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [shoppingWeek, setShoppingWeek] = useState(null)

  // Se revalida sola al pasar de medianoche o al volver a primer plano
  const today = useToday()

  const activeWeekId = selectedWeekId || today.weekId
  const { menu: menuCrudo, loading } = useMenu(activeWeekId)
  const { menus, loading: loadingMenus } = useAllMenus()
  const { recipes, loading: loadingRecipes } = useRecipes()

  // Recetas con la categoría siempre resuelta
  const catalog = useMemo(
    () => recipes.map((r) => ({ ...r, category: r.category || guessCategory(r.name) })),
    [recipes]
  )
  const recipesById = useMemo(() => indexRecipesById(catalog), [catalog])

  // Los platos enseñan la receta que hay hoy en el recetario, no la
  // copia congelada del día en que se eligieron.
  const menu = useMemo(() => withLiveRecipes(menuCrudo, recipesById), [menuCrudo, recipesById])

  // Estadísticas de uso (veces cocinado / última vez) a partir del histórico
  const stats = useMemo(() => computeUsageStats(menus), [menus])

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
            today={today}
            recipes={catalog}
            stats={stats}
            onGoToWeek={() => setView('week')}
          />
        )}

        {view === 'week' && (
          <WeekView
            menu={menu}
            loading={loading}
            wid={activeWeekId}
            today={today}
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
            todayWeekId={today.weekId}
            menus={menus}
            recipesById={recipesById}
            autoWeek={shoppingWeek}
            onAutoWeekUsed={() => setShoppingWeek(null)}
          />
        )}

        {view === 'recipes' && (
          <CatalogView recipes={catalog} loading={loadingRecipes} menus={menus} stats={stats} />
        )}

        {view === 'stats' && (
          <Suspense fallback={<Loading />}>
            <StatsView menus={menus} loading={loadingMenus} />
          </Suspense>
        )}

        {view === 'history' && (
          <HistoryView
            menus={menus}
            loading={loadingMenus}
            todayWeekId={today.weekId}
            onOpen={(wid) => {
              setSelectedWeekId(wid)
              setView('week')
            }}
          />
        )}

        {view === 'import' && (
          <ImportView
            recipes={catalog}
            menus={menus}
            onDone={(destino) => setView(destino || 'today')}
          />
        )}
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
              aria-current={active ? 'page' : undefined}
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
    {
      id: 'import',
      label: 'Importar JSON',
      icon: IconImport,
      desc: 'Pegar recetas sueltas o un menú completo',
    },
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

          <button
            onClick={async () => {
              onClose()
              await cerrarSesion()
            }}
            className="w-full mt-4 py-3 text-ink-500 text-sm font-medium"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useMemo } from 'react'
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { AuthGate } from './AuthGate'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

/* ============================================================
   HELPERS DE FORMATO (array ↔ string)
   ============================================================ */

// Convierte valor array o string a string multilinea para mostrar
function asMultiline(value) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join('\n')
  return String(value)
}

// Convierte proteins (array o string) a texto breve para mostrar
function formatProteins(value) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(' + ')
  return String(value)
}

/* ============================================================
   HELPERS DE LISTA DE LA COMPRA
   ============================================================ */

const SHOPPING_CATEGORIES = [
  'Proteínas',
  'Lácteos',
  'Verduras y frutas',
  'Despensa',
  'Otros',
]

const CATEGORY_KEYWORDS = {
  'Proteínas': ['pollo', 'ternera', 'pavo', 'cerdo', 'salm', 'merluza', 'bacalao', 'dorada', 'lubina', 'atún', 'atun', 'sepia', 'pulpo', 'gamba', 'conejo', 'huevo', 'jamón', 'jamon', 'rape', 'pescado', 'solomillo', 'contramuslo', 'carne'],
  'Lácteos': ['leche', 'yogur', 'queso', 'nata', 'mantequilla', 'mozzarella', 'parmesano', 'ricotta'],
  'Verduras y frutas': ['calabac', 'zanahoria', 'cebolla', 'pimiento', 'tomate', 'lechuga', 'espinaca', 'champi', 'espárrago', 'esparra', 'rúcula', 'rucula', 'canónigo', 'canonigo', 'patata', 'pepino', 'ajo', 'apio', 'judía', 'judia', 'mango', 'aguacate', 'manzana', 'pera', 'uva', 'limón', 'limon', 'lima', 'piña', 'pina', 'naranja', 'perejil', 'albahaca', 'cebolleta', 'puerro', 'boniato', 'castaña', 'castana', 'aceituna', 'alcaparra', 'guisante', 'fruta', 'verdura', 'tomatito', 'cherry'],
  'Despensa': ['arroz', 'pasta', 'lenteja', 'garbanzo', 'quinoa', 'harina', 'aceite', 'vinagre', 'sal', 'pimienta', 'pimentón', 'pimenton', 'orégano', 'oregano', 'tomillo', 'comino', 'soja', 'caldo', 'tomate frito', 'tomate triturado', 'pan', 'tortilla', 'nuez moscada', 'miel', 'vino', 'eneldo', 'frutos secos', 'almendra', 'piñon', 'pinon', 'macarrones', 'espagueti', 'azúcar', 'azucar', 'sirope', 'mostaza', 'ketchup', 'mayonesa'],
}

function categorizeIngredient(name) {
  if (!name) return 'Otros'
  const normalized = String(name).toLowerCase().trim()
  for (const category of SHOPPING_CATEGORIES) {
    const keywords = CATEGORY_KEYWORDS[category] || []
    if (keywords.some((kw) => normalized.includes(kw))) {
      return category
    }
  }
  return 'Otros'
}

// Parsea una línea de ingrediente de receta en uno o varios productos limpios
function parseIngredientLine(line) {
  if (!line) return []
  let cleaned = String(line).trim()

  // Si tiene "→", quedarse con lo posterior (cantidad final consolidada)
  if (cleaned.includes('→')) {
    const after = cleaned.split('→').slice(-1)[0] || ''
    cleaned = after.replace(/\([^)]*\)/g, '').trim()
  }

  // Quitar cantidades iniciales: "300 g de", "2 cucharadas de", "1 lata de", etc.
  cleaned = cleaned.replace(
    /^[~]?\s*[\d.,/]+\s*(g|gr|gramos?|ml|l|kg|cucharadas?|cdas?|cucharaditas?|cdtas?|dientes?|botes?|lomos?|filetes?|huevos?|latas?|unidades?|ud|uds|ramas?|hojas?|piezas?)\s*(de\s+)?/i,
    ''
  )

  // Quitar "1 ", "2 " al inicio cuando es un contador simple
  cleaned = cleaned.replace(/^[\d.,/]+\s+/, '')

  // Quitar preparaciones culinarias
  cleaned = cleaned.replace(
    /\s+(en|cortado en|partido en)\s+(rodajas?|tiras?|dados?|láminas?|laminas?|cuartos?|polvo|trozos?|filetes?|gajos?|juliana|brunoise).*$/i,
    ''
  )
  cleaned = cleaned.replace(
    /\s+(picados?|laminados?|troceados?|cortados?|rallados?|maduros?|frescos?|secos?|en\s+conserva|al\s+natural|cocidos?|hervidos?|crudo|crudos?|peladas?|limpias?|enteros?)\b.*$/i,
    ''
  )

  // Quitar paréntesis residuales
  cleaned = cleaned.replace(/\([^)]*\)/g, '').trim()

  // Si quedan separadores tipo "sal, pimienta y aceite" → varios items
  let parts = cleaned.split(/,|\s+y\s+/i)
  parts = parts.map((p) => p.trim()).filter((p) => p.length > 1)

  // Capitalizar primera letra de cada parte
  parts = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1))

  return parts
}

function generateItemId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

/* ============================================================
   CONSTANTES
   ============================================================ */

const DAYS_ES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
]
const DAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS_ES = [
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

/* ============================================================
   UTILIDADES FECHA
   ============================================================ */

function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week: weekNum }
}

function weekId(year, week) {
  return `${year}-${String(week).padStart(2, '0')}`
}

function parseWeekId(id) {
  const [y, w] = id.split('-')
  return { year: parseInt(y, 10), week: parseInt(w, 10) }
}

// Índice del día de hoy dentro de una semana (lunes=0, domingo=6)
function getTodayWeekIndex() {
  const day = new Date().getDay() // 0=dom, 1=lun
  return day === 0 ? 6 : day - 1
}

function formatLongDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  return `${DAYS_ES[dow]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`
}

function shiftWeekId(id, delta) {
  const { year, week } = parseWeekId(id)
  // Aproximación: sumar/restar 7 días desde el lunes de esa semana
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7)
  monday.setUTCDate(monday.getUTCDate() + delta * 7)
  const iso = getISOWeek(monday)
  return weekId(iso.year, iso.week)
}

/* ============================================================
   FIRESTORE HOOKS
   ============================================================ */

function useMenu(wid) {
  const [menu, setMenu] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!wid) return
    setLoading(true)
    const unsub = onSnapshot(
      doc(db, 'menus', wid),
      (snap) => {
        setMenu(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      },
      (err) => {
        console.error('Error cargando menú:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [wid])

  return { menu, loading }
}

function useAllMenus() {
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'menus')),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => b.id.localeCompare(a.id))
        setMenus(list)
        setLoading(false)
      },
      (err) => {
        console.error('Error cargando menús:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  return { menus, loading }
}

/* ============================================================
   OPERACIONES DE ESCRITURA
   ============================================================ */

async function saveMealToFirestore(wid, dayIndex, mealType, mealData, currentDays) {
  const newDays = currentDays.map((d, i) =>
    i === dayIndex ? { ...d, [mealType]: mealData } : d
  )
  await updateDoc(doc(db, 'menus', wid), { days: newDays })
}

async function deleteMealInFirestore(wid, dayIndex, mealType, currentDays) {
  const newDays = currentDays.map((d, i) =>
    i === dayIndex ? { ...d, [mealType]: null } : d
  )
  await updateDoc(doc(db, 'menus', wid), { days: newDays })
}

async function importMenuToFirestore(menuData) {
  const wid = weekId(menuData.year, menuData.week)
  await setDoc(doc(db, 'menus', wid), {
    ...menuData,
    importedAt: new Date().toISOString(),
  })
  return wid
}

/* ============================================================
   APP PRINCIPAL
   ============================================================ */

export default function App() {
  return (
    <AuthGate>
      <MainApp />
    </AuthGate>
  )
}

function MainApp() {
  const [view, setView] = useState('today')
  const [selectedWeekId, setSelectedWeekId] = useState(null)

  const today = useMemo(() => {
    const { year, week } = getISOWeek()
    return { year, week, id: weekId(year, week) }
  }, [])

  const activeWeekId = selectedWeekId || today.id
  const { menu, loading } = useMenu(activeWeekId)

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col">
      <main className="flex-1 pb-28 safe-top">
        {view === 'today' && (
          <TodayView
            menu={menu}
            loading={loading}
            isCurrentWeek={activeWeekId === today.id}
            todayId={today.id}
            viewingWeekId={activeWeekId}
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
            weekId={activeWeekId}
            todayId={today.id}
            onShiftWeek={(delta) =>
              setSelectedWeekId(shiftWeekId(activeWeekId, delta))
            }
            onBackToToday={() => setSelectedWeekId(null)}
          />
        )}
        {view === 'stats' && <StatsView />}
        {view === 'recipes' && <RecipesView />}
        {view === 'shopping' && <ShoppingView todayWeekId={today.id} />}
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
      <BottomNav
        view={view}
        setView={(v) => {
          if (v === 'today') setSelectedWeekId(null)
          setView(v)
        }}
      />
    </div>
  )
}

/* ============================================================
   NAVEGACIÓN INFERIOR
   ============================================================ */

function BottomNav({ view, setView }) {
  const items = [
    { id: 'today', label: 'Hoy', icon: IconToday },
    { id: 'week', label: 'Semana', icon: IconWeek },
    { id: 'recipes', label: 'Recetas', icon: IconRecipes },
    { id: 'shopping', label: 'Compra', icon: IconShopping },
    { id: 'stats', label: 'Stats', icon: IconStats },
    { id: 'history', label: 'Histórico', icon: IconHistory },
    { id: 'import', label: 'Importar', icon: IconImport },
  ]
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-cream-50/95 backdrop-blur border-t border-cream-300 safe-bottom z-40">
      <div className="flex justify-around px-1 pt-2 pb-1 no-scrollbar overflow-x-auto">
        {items.map((it) => {
          const Icon = it.icon
          const active = view === it.id
          return (
            <button
              key={it.id}
              onClick={() => setView(it.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl transition-colors shrink-0 ${
                active ? 'text-terracotta-600' : 'text-ink-500'
              }`}
            >
              <Icon active={active} />
              <span
                className={`text-[10px] font-medium tracking-wide ${
                  active ? 'text-terracotta-600' : 'text-ink-500'
                }`}
              >
                {it.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ============================================================
   VISTA: HOY
   ============================================================ */

function TodayView({ menu, loading, isCurrentWeek, todayId, viewingWeekId, onGoToWeek, onBackToToday }) {
  const [editing, setEditing] = useState(null)
  const todayIdx = getTodayWeekIndex()
  const now = new Date()

  if (loading) return <Loading />

  if (!menu) {
    return (
      <div className="px-6 pt-10">
        <Header />
        <EmptyState
          title={isCurrentWeek ? 'Aún no hay menú para esta semana' : 'Semana sin datos'}
          hint="Ve a la pestaña «Importar» y pega el JSON que te genero en el chat."
        />
      </div>
    )
  }

  const todayData = menu.days?.[todayIdx]

  return (
    <div className="animate-fade-in-up">
      <Header />

      <div className="px-6">
        {!isCurrentWeek && (
          <button
            onClick={onBackToToday}
            className="mb-4 text-sm text-terracotta-600 font-medium"
          >
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
            <p className="text-ink-500 mt-2 text-sm italic">
              {todayData.schedule}
            </p>
          )}
        </div>

        {todayData ? (
          <div className="space-y-4">
            <MealCard
              meal={todayData.lunch}
              type="lunch"
              label="Comida"
              onEdit={() =>
                setEditing({
                  dayIndex: todayIdx,
                  type: 'lunch',
                  meal: todayData.lunch,
                })
              }
            />
            <MealCard
              meal={todayData.dinner}
              type="dinner"
              label="Cena"
              onEdit={() =>
                setEditing({
                  dayIndex: todayIdx,
                  type: 'dinner',
                  meal: todayData.dinner,
                })
              }
            />
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

      {editing && (
        <MealEditor
          weekId={viewingWeekId}
          days={menu.days}
          dayIndex={editing.dayIndex}
          type={editing.type}
          meal={editing.meal}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/* ============================================================
   VISTA: SEMANA COMPLETA
   ============================================================ */

function WeekView({ menu, loading, weekId: wid, todayId, onShiftWeek, onBackToToday }) {
  const [editing, setEditing] = useState(null)
  const [expanded, setExpanded] = useState(getTodayWeekIndex())

  if (loading) return <Loading />

  const { year, week } = parseWeekId(wid)

  return (
    <div className="animate-fade-in-up">
      <Header />

      <div className="px-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => onShiftWeek(-1)}
            className="w-10 h-10 rounded-full bg-cream-200 flex items-center justify-center text-ink-700 active:bg-cream-300"
            aria-label="Semana anterior"
          >
            ←
          </button>
          <div className="text-center">
            <p className="label-caps text-terracotta-600 mb-1">Semana {week}</p>
            <p className="font-display text-xl text-ink-900">
              {menu?.dateRange || year}
            </p>
          </div>
          <button
            onClick={() => onShiftWeek(1)}
            className="w-10 h-10 rounded-full bg-cream-200 flex items-center justify-center text-ink-700 active:bg-cream-300"
            aria-label="Semana siguiente"
          >
            →
          </button>
        </div>

        {wid !== todayId && (
          <button
            onClick={onBackToToday}
            className="mb-4 text-sm text-terracotta-600 font-medium"
          >
            ← Ir a la semana actual
          </button>
        )}

        {!menu ? (
          <EmptyState title="Semana sin datos" hint="Ve a «Importar» para añadirla." />
        ) : (
          <div className="space-y-3">
            {menu.days?.map((d, idx) => (
              <DayRow
                key={idx}
                day={d}
                index={idx}
                isToday={wid === todayId && idx === getTodayWeekIndex()}
                expanded={expanded === idx}
                onToggle={() => setExpanded(expanded === idx ? -1 : idx)}
                onEdit={(type) =>
                  setEditing({ dayIndex: idx, type, meal: d[type] })
                }
              />
            ))}
          </div>
        )}
      </div>

      {editing && menu && (
        <MealEditor
          weekId={wid}
          days={menu.days}
          dayIndex={editing.dayIndex}
          type={editing.type}
          meal={editing.meal}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function DayRow({ day, index, isToday, expanded, onToggle, onEdit }) {
  const dayName = DAYS_ES[index] || day.day
  const date = day.date ? new Date(day.date).getDate() : ''

  return (
    <div
      className={`card overflow-hidden ${
        isToday ? 'ring-2 ring-terracotta-500' : ''
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center font-display text-lg ${
              isToday
                ? 'bg-terracotta-500 text-cream-50'
                : 'bg-cream-200 text-ink-700'
            }`}
          >
            {DAYS_SHORT[index]}
          </div>
          <div className="text-left">
            <p className="font-display text-lg capitalize text-ink-900 leading-none">
              {dayName}
            </p>
            <p className="text-xs text-ink-500 mt-0.5">
              {date ? `día ${date}` : ''}
              {day.schedule ? ` · ${day.schedule}` : ''}
            </p>
          </div>
        </div>
        <div className="text-ink-500 text-sm">{expanded ? '▲' : '▼'}</div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-cream-200 pt-4">
          <InlineMeal
            label="Comida"
            meal={day.lunch}
            onEdit={() => onEdit('lunch')}
          />
          <InlineMeal
            label="Cena"
            meal={day.dinner}
            onEdit={() => onEdit('dinner')}
          />
        </div>
      )}
    </div>
  )
}

function InlineMeal({ label, meal, onEdit }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="label-caps text-sage-700 mb-0.5">{label}</p>
        {meal ? (
          <>
            <p className="font-medium text-ink-900">{meal.name}</p>
            {meal.proteins && (
              <p className="text-xs text-ink-500 mt-0.5">🥩 {formatProteins(meal.proteins)}</p>
            )}
            {meal.notes && (
              <p className="text-xs text-terracotta-600 mt-0.5 italic">
                {meal.notes}
              </p>
            )}
          </>
        ) : (
          <p className="text-ink-500 italic text-sm">Sin plato</p>
        )}
      </div>
      <button
        onClick={onEdit}
        className="shrink-0 text-terracotta-600 text-xs font-medium px-3 py-1.5 rounded-full bg-terracotta-50 active:bg-terracotta-100"
      >
        {meal ? 'Editar' : 'Añadir'}
      </button>
    </div>
  )
}

/* ============================================================
   CARD DE PLATO (vista HOY)
   ============================================================ */

function MealCard({ meal, type, label, onEdit }) {
  const [showRecipe, setShowRecipe] = useState(false)

  if (!meal) {
    return (
      <div className="card p-5 border-2 border-dashed border-cream-300 bg-transparent shadow-none">
        <p className="label-caps text-sage-700 mb-2">{label}</p>
        <p className="text-ink-500 italic">Sin plato asignado</p>
        <button
          onClick={onEdit}
          className="mt-3 text-terracotta-600 text-sm font-medium"
        >
          + Añadir plato
        </button>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="label-caps text-sage-700">{label}</p>
          <button
            onClick={onEdit}
            className="text-ink-500 text-xs font-medium px-3 py-1 rounded-full bg-cream-200 active:bg-cream-300"
          >
            Editar
          </button>
        </div>
        <h2 className="font-display text-2xl text-ink-900 leading-tight mb-2">
          {meal.name}
        </h2>
        <div className="space-y-1 text-sm">
          {meal.proteins && (
            <p className="text-ink-700">
              <span className="text-ink-500">Proteína: </span>
              {formatProteins(meal.proteins)}
            </p>
          )}
          {meal.calories && (
            <p className="text-ink-700">
              <span className="text-ink-500">Calorías: </span>
              {meal.calories} kcal / persona
            </p>
          )}
          {meal.notes && (
            <p className="text-terracotta-600 italic">{meal.notes}</p>
          )}
        </div>

        {meal.recipe && (
          <button
            onClick={() => setShowRecipe(!showRecipe)}
            className="mt-4 text-terracotta-600 text-sm font-medium"
          >
            {showRecipe ? 'Ocultar receta ▲' : 'Ver receta ▼'}
          </button>
        )}
      </div>

      {showRecipe && meal.recipe && (
        <div className="px-5 pb-5 pt-1 space-y-3 text-sm border-t border-cream-200">
          {meal.recipe.method && (
            <p className="text-ink-700">
              <span className="label-caps text-sage-700 mr-2">Método</span>
              {meal.recipe.method}
            </p>
          )}
          {meal.recipe.ingredients && (
            <div>
              <p className="label-caps text-sage-700 mb-1.5 mt-3">Ingredientes</p>
              <div className="text-ink-700 whitespace-pre-line leading-relaxed">
                {asMultiline(meal.recipe.ingredients)}
              </div>
            </div>
          )}
          {meal.recipe.steps && (
            <div>
              <p className="label-caps text-sage-700 mb-1.5 mt-3">Pasos</p>
              <div className="text-ink-700 whitespace-pre-line leading-relaxed">
                {asMultiline(meal.recipe.steps)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   EDITOR DE PLATO (MODAL)
   ============================================================ */

function MealEditor({ weekId: wid, days, dayIndex, type, meal, onClose }) {
  const [form, setForm] = useState(() => ({
    name: meal?.name || '',
    proteins: formatProteins(meal?.proteins),
    calories: meal?.calories || '',
    notes: meal?.notes || '',
    method: meal?.recipe?.method || '',
    ingredients: asMultiline(meal?.recipe?.ingredients),
    steps: asMultiline(meal?.recipe?.steps),
  }))
  const [saving, setSaving] = useState(false)

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const newMeal = {
        name: form.name.trim(),
        proteins: form.proteins.trim() || null,
        calories: form.calories ? parseInt(form.calories, 10) : null,
        notes: form.notes.trim() || null,
        recipe:
          form.method || form.ingredients || form.steps
            ? {
                method: form.method.trim() || null,
                ingredients: form.ingredients.trim() || null,
                steps: form.steps.trim() || null,
              }
            : null,
      }
      await saveMealToFirestore(wid, dayIndex, type, newMeal, days)
      onClose()
    } catch (e) {
      alert('Error al guardar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este plato?')) return
    setSaving(true)
    try {
      await deleteMealInFirestore(wid, dayIndex, type, days)
      onClose()
    } catch (e) {
      alert('Error al eliminar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-cream-50 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto safe-bottom">
        <div className="sticky top-0 bg-cream-50 border-b border-cream-200 px-5 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-ink-500 text-sm font-medium"
            disabled={saving}
          >
            Cancelar
          </button>
          <p className="font-display text-lg capitalize">
            {type === 'lunch' ? 'Comida' : 'Cena'} · {DAYS_ES[dayIndex]}
          </p>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="text-terracotta-600 text-sm font-semibold disabled:opacity-40"
          >
            {saving ? '...' : 'Guardar'}
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Plato" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Ej: Ensalada de lentejas"
              className="input"
            />
          </Field>

          <Field label="Proteína">
            <input
              type="text"
              value={form.proteins}
              onChange={(e) => update('proteins', e.target.value)}
              placeholder="Ej: Lentejas + atún"
              className="input"
            />
          </Field>

          <Field label="Calorías (por persona)">
            <input
              type="number"
              value={form.calories}
              onChange={(e) => update('calories', e.target.value)}
              placeholder="Ej: 650"
              className="input"
            />
          </Field>

          <Field label="Notas">
            <input
              type="text"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Ej: Tupper niños"
              className="input"
            />
          </Field>

          <div className="pt-4 border-t border-cream-200">
            <p className="label-caps text-sage-700 mb-3">Receta (opcional)</p>

            <Field label="Método">
              <input
                type="text"
                value={form.method}
                onChange={(e) => update('method', e.target.value)}
                placeholder="Ej: Thermomix + horno"
                className="input"
              />
            </Field>

            <Field label="Ingredientes">
              <textarea
                value={form.ingredients}
                onChange={(e) => update('ingredients', e.target.value)}
                placeholder="Un ingrediente por línea"
                rows={5}
                className="input resize-none"
              />
            </Field>

            <Field label="Pasos">
              <textarea
                value={form.steps}
                onChange={(e) => update('steps', e.target.value)}
                placeholder="Primer paso empieza con 🔧 Método."
                rows={6}
                className="input resize-none"
              />
            </Field>
          </div>

          {meal && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="w-full py-3 text-terracotta-700 font-medium border border-terracotta-300 rounded-2xl mt-2 active:bg-terracotta-50"
            >
              Eliminar plato
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="label-caps text-ink-500 mb-1.5 block">
        {label} {required && <span className="text-terracotta-500">*</span>}
      </span>
      {children}
    </label>
  )
}

/* ============================================================
   VISTA: RECETAS (catálogo)
   ============================================================ */

function RecipesView() {
  const { menus, loading } = useAllMenus()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const recipes = useMemo(() => {
    const map = new Map()
    for (const m of menus) {
      for (const d of m.days || []) {
        for (const type of ['lunch', 'dinner']) {
          const meal = d[type]
          if (meal && meal.name && !map.has(meal.name)) {
            map.set(meal.name, {
              name: meal.name,
              proteins: meal.proteins || null,
              calories: meal.calories || null,
              recipe: meal.recipe || null,
            })
          }
        }
      }
    }
    let list = Array.from(map.values())
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        formatProteins(r.proteins).toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return list
  }, [menus, search])

  if (loading) return <Loading />

  return (
    <div className="animate-fade-in-up">
      <Header />
      <div className="px-6">
        <h1 className="font-display text-3xl text-ink-900 mb-1">Recetas</h1>
        <p className="text-sm text-ink-500 mb-5">
          {recipes.length} platos en tu repertorio
        </p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar plato o proteína…"
          className="input mb-5"
        />

        {!recipes.length ? (
          <EmptyState
            title={menus.length ? 'Sin resultados' : 'Sin menús importados'}
            hint={menus.length ? 'Prueba con otro término.' : 'Importa algún menú para empezar.'}
          />
        ) : (
          <div className="space-y-2 pb-4">
            {recipes.map((r) => (
              <button
                key={r.name}
                onClick={() => setSelected(r)}
                className="card w-full text-left p-4 active:bg-cream-200"
              >
                <p className="font-display text-lg text-ink-900">{r.name}</p>
                <div className="flex gap-3 mt-1 text-xs text-ink-500">
                  {r.proteins && <span>🥩 {formatProteins(r.proteins)}</span>}
                  {r.calories && <span>🔥 {r.calories} kcal</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <RecipeModal recipe={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

function RecipeModal({ recipe, onClose }) {
  return (
    <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-cream-50 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto safe-bottom">
        <div className="sticky top-0 bg-cream-50 border-b border-cream-200 px-5 py-4 flex items-center justify-between">
          <button onClick={onClose} className="text-ink-500 text-sm font-medium">
            Cerrar
          </button>
          <p className="font-display text-base text-ink-900 text-center flex-1 px-2 truncate">
            {recipe.name}
          </p>
          <div className="w-12" />
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {recipe.proteins && (
              <span className="bg-sage-100 text-sage-700 text-xs px-3 py-1 rounded-full font-medium">
                🥩 {formatProteins(recipe.proteins)}
              </span>
            )}
            {recipe.calories && (
              <span className="bg-terracotta-50 text-terracotta-700 text-xs px-3 py-1 rounded-full font-medium">
                🔥 {recipe.calories} kcal
              </span>
            )}
          </div>

          {recipe.recipe ? (
            <>
              {recipe.recipe.method && (
                <div>
                  <p className="label-caps text-sage-700 mb-1.5">Método</p>
                  <p className="text-ink-700">{recipe.recipe.method}</p>
                </div>
              )}
              {recipe.recipe.ingredients && (
                <div>
                  <p className="label-caps text-sage-700 mb-1.5">Ingredientes</p>
                  <div className="text-ink-700 whitespace-pre-line leading-relaxed text-sm">
                    {asMultiline(recipe.recipe.ingredients)}
                  </div>
                </div>
              )}
              {recipe.recipe.steps && (
                <div>
                  <p className="label-caps text-sage-700 mb-1.5">Pasos</p>
                  <div className="text-ink-700 whitespace-pre-line leading-relaxed text-sm">
                    {asMultiline(recipe.recipe.steps)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-ink-500 italic">Sin receta detallada guardada.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   VISTA: COMPRA (listas de la compra)
   ============================================================ */

// Categorización por palabras clave
const CATEGORIES = [
  { key: 'proteinas', label: 'Proteínas', keywords: ['pollo', 'ternera', 'pavo', 'conejo', 'cerdo', 'salmón', 'salmon', 'merluza', 'bacalao', 'dorada', 'lubina', 'sepia', 'calamar', 'gambas', 'atún', 'atun', 'pulpo', 'jamón', 'jamon', 'lomo', 'carne', 'pescado', 'rape', 'mariscos', 'mejillones', 'almejas'] },
  { key: 'lacteos', label: 'Lácteos y huevos', keywords: ['huevo', 'leche', 'queso', 'mozzarella', 'ricotta', 'yogur', 'mantequilla', 'nata', 'batido', 'parmesano', 'manchego', 'feta'] },
  { key: 'verduras', label: 'Verduras', keywords: ['calabacín', 'calabacin', 'pimiento', 'tomate', 'ajo', 'lechuga', 'cebolla', 'zanahoria', 'pepino', 'espinaca', 'espárrago', 'esparrago', 'champiñón', 'champiñon', 'champinon', 'brócoli', 'brocoli', 'coliflor', 'judía', 'judia', 'alcachofa', 'perejil', 'albahaca', 'cilantro', 'canónigo', 'canonigo', 'rúcula', 'rucula', 'patata', 'boniato', 'apio', 'puerro', 'rábano', 'rabano', 'remolacha', 'aguacate'] },
  { key: 'frutas', label: 'Frutas', keywords: ['limón', 'limon', 'manzana', 'pera', 'naranja', 'lima', 'uva', 'mango', 'plátano', 'platano', 'fresa', 'melón', 'melon', 'sandía', 'sandia', 'piña', 'pina', 'kiwi', 'frambuesa', 'arándano'] },
  { key: 'despensa', label: 'Despensa', keywords: ['arroz', 'pasta', 'quinoa', 'harina', 'aceite', 'vinagre', 'sal', 'pimienta', 'pimentón', 'pimenton', 'orégano', 'oregano', 'comino', 'curry', 'azúcar', 'azucar', 'soja', 'miel', 'lentejas', 'garbanzos', 'alubias', 'frijoles', 'aceitunas', 'alcaparras', 'mostaza', 'caldo', 'tomate triturado', 'tomate frito', 'eneldo', 'tomillo', 'romero', 'laurel', 'nuez moscada', 'almendras', 'castañas', 'castanas', 'frutos secos'] },
  { key: 'panaderia', label: 'Panadería', keywords: ['pan', 'tortilla', 'hojaldre', 'baguette', 'biscote', 'pita'] },
  { key: 'bebidas', label: 'Bebidas', keywords: ['vino', 'cerveza', 'agua', 'zumo', 'refresco'] },
]

function categorize(name) {
  const lower = name.toLowerCase()
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((k) => lower.includes(k))) return cat.key
  }
  return 'otros'
}

// Limpia un ingrediente bruto a producto de lista de compra
function cleanIngredient(raw) {
  if (!raw || typeof raw !== 'string') return null
  let text = raw.trim()

  // Saltar las líneas de porciones de Juan/Magdalena
  if (/Juan:|Magdalena|niños:|niños y/i.test(text)) {
    // Intentar extraer el alimento si está al inicio: "Juan: 160 g · ... → ~580 g de salmón (4 lomos)"
    const m = text.match(/de\s+([^\(→]+)/i)
    if (m) text = m[1].trim()
    else return null
  }

  // Quitar texto entre paréntesis
  text = text.replace(/\([^)]*\)/g, '').trim()
  // Quitar al final puntos
  text = text.replace(/\.+$/, '').trim()

  // Quitar cantidades del principio (200 g, 1 kg, 3 dientes, etc.)
  text = text.replace(/^[\d,.½¼¾\s]+(g|kg|ml|l|cl|cucharad[ao]s?|cucharaditas?|pizca|dientes?|filetes?|lomos?|hojas?|trozos?|láminas?|laminas?|rodajas?|botes?|latas?|paquetes?|sobres?|ramas?|hojitas?|huevos?|piezas?|unidades?)\s+(de\s+)?/i, '')
  // Cantidad simple "1 limón", "2 zanahorias"
  text = text.replace(/^[\d,.½¼¾\s]+\s+/i, '')

  // Quitar adjetivos/participios típicos
  const stripAdj = [
    'picad[oa]s?', 'lamina[oda]s?', 'ralla[oda]s?', 'troce[oada]s?', 'cocid[oa]s?',
    'fresc[oa]s?', 'maduros?', 'limpi[oa] en trozos', 'en dados', 'en tiras',
    'en rodajas', 'en láminas', 'en laminas', 'en cuartos', 'en juliana',
    'al natural', 'al gusto', 'en aceite', 'sin pepitas', 'sin piel',
    'sin hueso', 'desmenuzad[oa]', 'rallad[oa]'
  ]
  for (const a of stripAdj) {
    text = text.replace(new RegExp(',?\\s*\\b' + a + '\\b', 'gi'), '')
  }

  text = text.replace(/\s+/g, ' ').trim()
  text = text.replace(/^[,.\s]+|[,.\s]+$/g, '').trim()

  if (text.length < 2) return null
  if (/^aliño|^aderezo|^salsa$/i.test(text)) return null

  // Capitalizar
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Extrae items a partir de un menú
function extractItemsFromMenu(menu) {
  if (!menu || !menu.days) return []
  const seen = new Map()
  for (const d of menu.days) {
    for (const type of ['lunch', 'dinner']) {
      const meal = d[type]
      if (!meal || !meal.recipe) continue
      const ings = meal.recipe.ingredients
      if (!ings) continue
      const arr = Array.isArray(ings) ? ings : String(ings).split('\n')
      for (const raw of arr) {
        // Una línea puede tener varios items separados por coma (sal, pimienta, etc.)
        const subItems = raw.split(/,| y /i)
        for (const sub of subItems) {
          const clean = cleanIngredient(sub)
          if (!clean) continue
          const key = clean.toLowerCase()
          if (!seen.has(key)) {
            seen.set(key, {
              id: 'auto_' + key.replace(/\s+/g, '_'),
              name: clean,
              category: categorize(clean),
              checked: false,
            })
          }
        }
      }
    }
  }
  return Array.from(seen.values())
}

// Hooks/operaciones de listas en Firestore
function useShoppingLists() {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'shopping-lists')),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'))
        setLists(list)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])
  return { lists, loading }
}

async function createShoppingList(name) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'lista-' + Date.now()
  await setDoc(doc(db, 'shopping-lists', id), {
    name,
    items: [],
    createdAt: new Date().toISOString(),
  })
  return id
}

async function updateShoppingList(listId, items) {
  await updateDoc(doc(db, 'shopping-lists', listId), { items })
}

async function deleteShoppingList(listId) {
  await deleteDoc(doc(db, 'shopping-lists', listId))
}

function ShoppingView({ todayWeekId }) {
  const { lists, loading } = useShoppingLists()
  const [activeListId, setActiveListId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showNewList, setShowNewList] = useState(false)
  const [showImport, setShowImport] = useState(false)

  // Activar la primera lista por defecto
  useEffect(() => {
    if (!activeListId && lists.length) setActiveListId(lists[0].id)
  }, [lists, activeListId])

  if (loading) return <Loading />

  const activeList = lists.find((l) => l.id === activeListId)

  return (
    <div className="animate-fade-in-up">
      <Header />
      <div className="px-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-3xl text-ink-900">Compra</h1>
          <button
            onClick={() => setShowNewList(true)}
            className="text-terracotta-600 text-sm font-medium"
          >
            + Lista
          </button>
        </div>

        {!lists.length ? (
          <EmptyState
            title="Sin listas de compra"
            hint="Crea tu primera lista (ej. Lidl, Mercadona, Carrefour)."
          />
        ) : (
          <>
            {/* Selector de lista (pills horizontales) */}
            <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar -mx-2 px-2">
              {lists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setActiveListId(l.id)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    l.id === activeListId
                      ? 'bg-terracotta-500 text-cream-50'
                      : 'bg-cream-200 text-ink-700'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>

            {activeList && (
              <ShoppingListContent
                list={activeList}
                todayWeekId={todayWeekId}
                onShowAdd={() => setShowAdd(true)}
                onShowImport={() => setShowImport(true)}
              />
            )}
          </>
        )}
      </div>

      {showNewList && (
        <NewListModal
          onClose={() => setShowNewList(false)}
          onCreated={(id) => {
            setActiveListId(id)
            setShowNewList(false)
          }}
        />
      )}
      {showAdd && activeList && (
        <AddItemModal
          list={activeList}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showImport && activeList && (
        <ImportMenuModal
          list={activeList}
          todayWeekId={todayWeekId}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  )
}

function ShoppingListContent({ list, todayWeekId, onShowAdd, onShowImport }) {
  const items = list.items || []

  // Agrupar por categoría
  const byCategory = useMemo(() => {
    const groups = {}
    for (const it of items) {
      const cat = it.category || 'otros'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(it)
    }
    return groups
  }, [items])

  const categoryOrder = [...CATEGORIES.map((c) => c.key), 'otros']
  const categoryLabels = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]))
  categoryLabels.otros = 'Otros'

  const totalChecked = items.filter((i) => i.checked).length

  async function toggleItem(id) {
    const newItems = items.map((it) =>
      it.id === id ? { ...it, checked: !it.checked } : it
    )
    await updateShoppingList(list.id, newItems)
  }

  async function deleteItem(id) {
    const newItems = items.filter((it) => it.id !== id)
    await updateShoppingList(list.id, newItems)
  }

  async function clearChecked() {
    if (!confirm('¿Borrar todos los items marcados?')) return
    const newItems = items.filter((it) => !it.checked)
    await updateShoppingList(list.id, newItems)
  }

  async function clearAll() {
    if (!confirm('¿Vaciar toda la lista?')) return
    await updateShoppingList(list.id, [])
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-500">
          {items.length} items {totalChecked > 0 && `· ${totalChecked} marcados`}
        </p>
        <div className="flex gap-2">
          {totalChecked > 0 && (
            <button
              onClick={clearChecked}
              className="text-xs text-ink-500 font-medium"
            >
              Borrar marcados
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <button onClick={onShowAdd} className="flex-1 btn-primary text-sm py-2.5">
          + Añadir producto
        </button>
        <button
          onClick={onShowImport}
          className="px-4 py-2.5 rounded-full bg-sage-100 text-sage-700 text-sm font-medium active:bg-sage-300"
        >
          🍽️ Del menú
        </button>
      </div>

      {!items.length ? (
        <EmptyState
          title="Lista vacía"
          hint='Añade productos manualmente o pulsa "Del menú" para importar los ingredientes de la semana.'
        />
      ) : (
        <div className="space-y-5 pb-8">
          {categoryOrder.map((cat) => {
            const its = byCategory[cat]
            if (!its || !its.length) return null
            return (
              <div key={cat}>
                <p className="label-caps text-sage-700 mb-2">
                  {categoryLabels[cat] || cat}
                </p>
                <div className="space-y-1.5">
                  {its.map((it) => (
                    <ShoppingItem
                      key={it.id}
                      item={it}
                      onToggle={() => toggleItem(it.id)}
                      onDelete={() => deleteItem(it.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {items.length > 0 && (
            <button
              onClick={clearAll}
              className="w-full py-3 text-terracotta-700 text-sm font-medium border border-terracotta-300 rounded-2xl mt-4 active:bg-terracotta-50"
            >
              Vaciar lista entera
            </button>
          )}
        </div>
      )}
    </>
  )
}

function ShoppingItem({ item, onToggle, onDelete }) {
  return (
    <div className="card flex items-center gap-3 px-4 py-3">
      <button
        onClick={onToggle}
        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          item.checked
            ? 'bg-terracotta-500 border-terracotta-500'
            : 'border-cream-400'
        }`}
      >
        {item.checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L20 7" stroke="#FDFBF7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-ink-900 ${item.checked ? 'line-through text-ink-500' : ''}`}>
          {item.name}
        </p>
        {item.quantity && (
          <p className="text-xs text-ink-500">{item.quantity}</p>
        )}
      </div>
      <button onClick={onDelete} className="shrink-0 text-ink-500 text-lg px-2">
        ×
      </button>
    </div>
  )
}

function NewListModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setCreating(true)
    try {
      const id = await createShoppingList(name.trim())
      onCreated(id)
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-cream-50 w-full max-w-md rounded-t-3xl sm:rounded-3xl safe-bottom">
        <div className="border-b border-cream-200 px-5 py-4 flex items-center justify-between">
          <button onClick={onClose} className="text-ink-500 text-sm font-medium">
            Cancelar
          </button>
          <p className="font-display text-lg">Nueva lista</p>
          <div className="w-12" />
        </div>
        <div className="p-5 space-y-3">
          <Field label="Nombre" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Lidl, Mercadona, Carrefour..."
              autoFocus
              className="input"
            />
          </Field>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="btn-primary w-full disabled:opacity-40"
          >
            {creating ? 'Creando…' : 'Crear lista'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddItemModal({ list, onClose }) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState('otros')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const newItem = {
        id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: name.trim(),
        category,
        checked: false,
        quantity: quantity.trim() || null,
      }
      await updateShoppingList(list.id, [...(list.items || []), newItem])
      onClose()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // Auto-categorizar mientras escribe
  useEffect(() => {
    if (name.trim()) {
      const cat = categorize(name)
      if (cat !== 'otros') setCategory(cat)
    }
  }, [name])

  return (
    <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-cream-50 w-full max-w-md rounded-t-3xl sm:rounded-3xl safe-bottom max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-cream-50 border-b border-cream-200 px-5 py-4 flex items-center justify-between">
          <button onClick={onClose} className="text-ink-500 text-sm font-medium">
            Cancelar
          </button>
          <p className="font-display text-lg">Añadir a {list.name}</p>
          <div className="w-12" />
        </div>
        <div className="p-5 space-y-3">
          <Field label="Producto" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Salmón fresco"
              autoFocus
              className="input"
            />
          </Field>
          <Field label="Cantidad (opcional)">
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ej: 4 lomos, 500 g, 2 piezas"
              className="input"
            />
          </Field>
          <Field label="Categoría">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
              <option value="otros">Otros</option>
            </select>
          </Field>
          <button
            onClick={handleAdd}
            disabled={!name.trim() || saving}
            className="btn-primary w-full disabled:opacity-40"
          >
            {saving ? 'Añadiendo…' : 'Añadir a la lista'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ImportMenuModal({ list, todayWeekId, onClose }) {
  const { menus } = useAllMenus()
  const [selectedWeek, setSelectedWeek] = useState(todayWeekId)
  const [importing, setImporting] = useState(false)

  const menu = menus.find((m) => m.id === selectedWeek)
  const previewItems = useMemo(() => (menu ? extractItemsFromMenu(menu) : []), [menu])

  async function handleImport() {
    if (!menu) return
    setImporting(true)
    try {
      const existing = list.items || []
      const existingNames = new Set(existing.map((i) => i.name.toLowerCase()))
      const newOnes = previewItems.filter(
        (it) => !existingNames.has(it.name.toLowerCase())
      )
      await updateShoppingList(list.id, [...existing, ...newOnes])
      onClose()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-cream-50 w-full max-w-md rounded-t-3xl sm:rounded-3xl safe-bottom max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-cream-50 border-b border-cream-200 px-5 py-4 flex items-center justify-between">
          <button onClick={onClose} className="text-ink-500 text-sm font-medium">
            Cancelar
          </button>
          <p className="font-display text-lg">Importar del menú</p>
          <div className="w-12" />
        </div>
        <div className="p-5 space-y-4">
          <Field label="Semana">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="input"
            >
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  Semana {m.week} · {m.year} {m.id === todayWeekId ? '(actual)' : ''}
                </option>
              ))}
            </select>
          </Field>

          {!menu ? (
            <p className="text-sm text-ink-500 italic">No hay menú seleccionado.</p>
          ) : (
            <>
              <p className="text-sm text-ink-500">
                Se importarán <strong>{previewItems.length}</strong> productos a "{list.name}".
                Los duplicados se omiten.
              </p>
              <div className="max-h-60 overflow-y-auto bg-cream-100 rounded-2xl p-3 text-xs text-ink-700 space-y-0.5">
                {previewItems.slice(0, 30).map((it) => (
                  <p key={it.id}>· {it.name}</p>
                ))}
                {previewItems.length > 30 && (
                  <p className="italic text-ink-500 mt-1">
                    …y {previewItems.length - 30} más
                  </p>
                )}
              </div>
              <button
                onClick={handleImport}
                disabled={importing || !previewItems.length}
                className="btn-primary w-full disabled:opacity-40"
              >
                {importing ? 'Importando…' : `Importar ${previewItems.length} productos`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   VISTA: ESTADÍSTICAS
   ============================================================ */

function StatsView() {
  const { menus, loading } = useAllMenus()

  const stats = useMemo(() => {
    if (!menus.length) return null

    const dishCount = {}
    const caloriesByWeek = []
    let totalMeals = 0
    let mealsWithCalories = 0
    let totalCal = 0

    for (const m of menus) {
      let weekCal = 0
      let weekDays = 0
      for (const d of m.days || []) {
        for (const type of ['lunch', 'dinner']) {
          const meal = d[type]
          if (!meal) continue
          totalMeals++
          const name = meal.name.trim()
          dishCount[name] = (dishCount[name] || 0) + 1
          if (meal.calories) {
            totalCal += meal.calories
            mealsWithCalories++
            weekCal += meal.calories
          }
        }
        if (d.lunch || d.dinner) weekDays++
      }
      caloriesByWeek.push({
        week: `S${m.week}`,
        calorias: weekDays ? Math.round(weekCal / weekDays) : 0,
      })
    }

    const topDishes = Object.entries(dishCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        name: name.length > 22 ? name.slice(0, 20) + '…' : name,
        fullName: name,
        count,
      }))

    return {
      totalMeals,
      uniqueDishes: Object.keys(dishCount).length,
      weeks: menus.length,
      avgCalories: mealsWithCalories ? Math.round(totalCal / mealsWithCalories) : null,
      topDishes,
      caloriesByWeek: caloriesByWeek.reverse(),
    }
  }, [menus])

  if (loading) return <Loading />
  if (!stats)
    return (
      <div className="px-6 pt-10">
        <Header />
        <EmptyState title="Sin datos aún" hint="Importa algún menú para ver estadísticas." />
      </div>
    )

  return (
    <div className="animate-fade-in-up">
      <Header />
      <div className="px-6">
        <h1 className="font-display text-3xl text-ink-900 mb-6">Estadísticas</h1>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard label="Semanas" value={stats.weeks} />
          <StatCard label="Platos servidos" value={stats.totalMeals} />
          <StatCard label="Platos únicos" value={stats.uniqueDishes} />
          <StatCard
            label="Kcal / plato"
            value={stats.avgCalories ? `${stats.avgCalories}` : '—'}
          />
        </div>

        <section className="card p-5 mb-4">
          <h2 className="font-display text-xl mb-1">Platos más frecuentes</h2>
          <p className="text-xs text-ink-500 mb-4">
            Repeticiones en todo el histórico
          </p>
          <div style={{ width: '100%', height: Math.max(200, stats.topDishes.length * 32) }}>
            <ResponsiveContainer>
              <BarChart
                data={stats.topDishes}
                layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
              >
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: '#3D362D', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#F4DBCD80' }}
                  contentStyle={{
                    background: '#FDFBF7',
                    border: '1px solid #E8DFD0',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v, _, p) => [`${v} veces`, p?.payload?.fullName]}
                />
                <Bar dataKey="count" fill="#C65D3E" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {stats.caloriesByWeek.some((w) => w.calorias > 0) && (
          <section className="card p-5">
            <h2 className="font-display text-xl mb-1">Calorías por semana</h2>
            <p className="text-xs text-ink-500 mb-4">
              Promedio por día (por persona)
            </p>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart
                  data={stats.caloriesByWeek}
                  margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="#E8DFD0" vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: '#5C5248', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#5C5248', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#FDFBF7',
                      border: '1px solid #E8DFD0',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${v} kcal`, 'Media diaria']}
                  />
                  <Line
                    type="monotone"
                    dataKey="calorias"
                    stroke="#C65D3E"
                    strokeWidth={2.5}
                    dot={{ fill: '#C65D3E', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card p-4">
      <p className="label-caps text-ink-500 mb-1">{label}</p>
      <p className="font-display text-3xl text-ink-900 leading-none">{value}</p>
    </div>
  )
}

/* ============================================================
   VISTA: HISTÓRICO
   ============================================================ */

function HistoryView({ onOpen }) {
  const { menus, loading } = useAllMenus()

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
                <button
                  key={m.id}
                  onClick={() => onOpen(m.id)}
                  className="card w-full p-4 text-left active:bg-cream-200"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="label-caps text-terracotta-600">
                        Semana {m.week} · {m.year}
                      </p>
                      <p className="font-display text-lg text-ink-900 mt-0.5">
                        {m.dateRange || '—'}
                      </p>
                    </div>
                    <div className="text-right text-xs text-ink-500">
                      <p>{totalMeals} platos</p>
                      <p className="mt-0.5">{m.persons || 4} personas</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   VISTA: IMPORTAR JSON
   ============================================================ */

function ImportView({ onDone }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState(null)

  const handleImport = async () => {
    setStatus(null)
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      setStatus({ type: 'err', msg: 'JSON inválido: ' + e.message })
      return
    }
    if (!parsed.week || !parsed.year || !Array.isArray(parsed.days)) {
      setStatus({
        type: 'err',
        msg: 'Faltan campos obligatorios (week, year, days).',
      })
      return
    }
    try {
      const wid = await importMenuToFirestore(parsed)
      setStatus({ type: 'ok', msg: `Semana ${parsed.week} guardada ✓` })
      setText('')
      setTimeout(onDone, 1200)
    } catch (e) {
      setStatus({ type: 'err', msg: 'Error al guardar: ' + e.message })
    }
  }

  return (
    <div className="animate-fade-in-up">
      <Header />
      <div className="px-6">
        <h1 className="font-display text-3xl text-ink-900 mb-2">Importar</h1>
        <p className="text-sm text-ink-500 mb-6">
          Pega el JSON que te genere Claude en el chat. Se sincronizará
          automáticamente en los dos móviles.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{ "week": 17, "year": 2026, ... }'
          rows={14}
          className="input font-mono text-xs resize-none"
        />

        {status && (
          <p
            className={`mt-3 text-sm ${
              status.type === 'ok' ? 'text-sage-700' : 'text-terracotta-600'
            }`}
          >
            {status.msg}
          </p>
        )}

        <button
          onClick={handleImport}
          disabled={!text.trim()}
          className="btn-primary w-full mt-4 disabled:opacity-40"
        >
          Importar semana
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   HEADER (logo/marca)
   ============================================================ */

function Header() {
  return (
    <header className="px-6 pt-5 pb-3">
      <p className="font-display text-lg text-terracotta-600 tracking-tight italic">
        Cocina Juan &amp; Magda
      </p>
    </header>
  )
}

/* ============================================================
   HELPERS VISUALES
   ============================================================ */

function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-terracotta-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function EmptyState({ title, hint }) {
  return (
    <div className="card p-8 text-center mt-4">
      <p className="font-display text-xl text-ink-900 mb-2">{title}</p>
      <p className="text-sm text-ink-500">{hint}</p>
    </div>
  )
}

/* ============================================================
   ICONOS (SVG inline)
   ============================================================ */

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function IconToday() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
    </svg>
  )
}
function IconWeek() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18M8 2v4M16 2v4M8 13h8M8 17h5" />
    </svg>
  )
}
function IconStats() {
  return (
    <svg {...iconProps}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}
function IconHistory() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
function IconImport() {
  return (
    <svg {...iconProps}>
      <path d="M12 3v13M7 11l5 5 5-5M5 21h14" />
    </svg>
  )
}
function IconRecipes() {
  return (
    <svg {...iconProps}>
      <path d="M5 4h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M9 4v3M8 11h8M8 15h6" />
    </svg>
  )
}
function IconShopping() {
  return (
    <svg {...iconProps}>
      <path d="M5 8h14l-1.5 10.5a2 2 0 0 1-2 1.5h-7a2 2 0 0 1-2-1.5L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

/* ============================================================
   INPUT BASE (via @apply estaría mejor, pero lo dejamos simple)
   ============================================================ */

// Clase CSS inline para inputs (se aplica por className="input")
// Definida en el selector global abajo; usamos tailwind arbitrary classes
// via template literals no funcionaría — lo resolvemos con clases utilitarias directamente

// Añadimos estilos de input al index.css vía @layer components (ver ese archivo).

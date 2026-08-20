import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Header,
  Loading,
  EmptyState,
  Sheet,
  Field,
  Chip,
  Tag,
  useConfirm,
  useToast,
} from '../components/ui'
import {
  CATEGORIES,
  categorize,
  extractItemsFromMenu,
  bumpQuantity,
  firstNeededIndex,
} from '../lib/ingredients'
import { withLiveRecipes } from '../lib/catalog'
import {
  useShoppingLists,
  createShoppingList,
  renameShoppingList,
  deleteShoppingList,
  addShoppingItem,
  updateShoppingItem,
  toggleShoppingItem,
  removeShoppingItem,
  clearCheckedItems,
  clearAllItems,
  importWeekIntoList,
} from '../lib/db'
import { daysUntil, weekRangeLabel, parseWeekId, shiftWeekId } from '../lib/dates'

const CATEGORY_META = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, { label: c.label, icon: c.icon }])
)
CATEGORY_META.otros = { label: 'Otros', icon: '🔸' }
const CATEGORY_ORDER = [...CATEGORIES.map((c) => c.key), 'otros']

const SUPERMARKETS = ['Lidl', 'Mercadona', 'Carrefour', 'Eroski', 'Alcampo', 'Farmacia']

export default function ShoppingView({
  todayWeekId,
  menus,
  recipesById,
  autoWeek,
  onAutoWeekUsed,
}) {
  const { lists, loading } = useShoppingLists()
  const [activeId, setActiveId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showNewList, setShowNewList] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [manageList, setManageList] = useState(false)
  const [presetWeek, setPresetWeek] = useState(null)
  const avisar = useToast()

  // Si la lista activa desaparece (borrada desde el otro móvil), se
  // salta a la primera que quede.
  useEffect(() => {
    if (!lists.length) {
      if (activeId) setActiveId(null)
      return
    }
    if (!activeId || !lists.some((l) => l.id === activeId)) setActiveId(lists[0].id)
  }, [lists, activeId])

  // Al llegar desde «Pasar ingredientes a la compra», abre el
  // importador ya apuntando a esa semana.
  useEffect(() => {
    if (!autoWeek) return
    if (!lists.length) {
      avisar('Crea primero una lista de la compra')
      onAutoWeekUsed?.()
      return
    }
    setPresetWeek(autoWeek)
    setShowImport(true)
    onAutoWeekUsed?.()
  }, [autoWeek, lists.length])

  if (loading) return <Loading />

  const list = lists.find((l) => l.id === activeId)
  const editingItem = list ? (list.items || []).find((it) => it.id === editingId) : null

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
            hint="Crea una lista por supermercado: Lidl, Mercadona, Carrefour…"
            action={
              <button onClick={() => setShowNewList(true)} className="btn-primary">
                Crear mi primera lista
              </button>
            }
          />
        ) : (
          <>
            <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar -mx-2 px-2">
              {lists.map((l) => (
                <Chip key={l.id} active={l.id === activeId} onClick={() => setActiveId(l.id)}>
                  {l.name}
                  {l.items?.length ? ` · ${l.items.filter((i) => !i.checked).length}` : ''}
                </Chip>
              ))}
            </div>

            {list && (
              <ListContent
                list={list}
                onShowAdd={() => setShowAdd(true)}
                onShowImport={() => setShowImport(true)}
                onEdit={(it) => setEditingId(it.id)}
                onManage={() => setManageList(true)}
              />
            )}
          </>
        )}
      </div>

      {showNewList && (
        <NewListModal
          onClose={() => setShowNewList(false)}
          onCreated={(id) => {
            setActiveId(id)
            setShowNewList(false)
          }}
        />
      )}

      {showAdd && list && <ItemModal list={list} item={null} onClose={() => setShowAdd(false)} />}

      {editingItem && list && (
        <ItemModal
          key={editingItem.id}
          list={list}
          item={editingItem}
          onClose={() => setEditingId(null)}
        />
      )}

      {showImport && list && (
        <ImportMenuModal
          list={list}
          menus={menus}
          recipesById={recipesById}
          todayWeekId={todayWeekId}
          presetWeek={presetWeek}
          onClose={() => {
            setShowImport(false)
            setPresetWeek(null)
          }}
        />
      )}

      {manageList && list && (
        <ManageListModal
          list={list}
          onClose={() => setManageList(false)}
          onDeleted={() => {
            setManageList(false)
            setActiveId(null)
          }}
        />
      )}
    </div>
  )
}

/* ============================================================
   CONTENIDO DE UNA LISTA
   ============================================================ */
function ListContent({ list, onShowAdd, onShowImport, onEdit, onManage }) {
  const items = list.items || []
  const confirmar = useConfirm()
  const avisar = useToast()

  const { pending, checked } = useMemo(() => {
    const p = {}
    const c = []
    for (const it of items) {
      if (it.checked) {
        c.push(it)
      } else {
        const cat = it.category || 'otros'
        if (!p[cat]) p[cat] = []
        p[cat].push(it)
      }
    }
    // Dentro de cada categoría, primero lo que se necesita antes
    for (const k of Object.keys(p)) {
      p[k].sort((a, b) => {
        const ia = firstNeededIndex(a)
        const ib = firstNeededIndex(b)
        if (ia == null && ib == null) return (a.name || '').localeCompare(b.name || '', 'es')
        if (ia == null) return 1
        if (ib == null) return -1
        return ia - ib || (a.name || '').localeCompare(b.name || '', 'es')
      })
    }
    return { pending: p, checked: c }
  }, [items])

  async function conAviso(accion, mensajeError) {
    try {
      await accion()
    } catch (e) {
      avisar(mensajeError + ': ' + (e?.message || e), 'error')
    }
  }

  async function borrarComprados() {
    const ok = await confirmar({
      title: 'Borrar los comprados',
      message: `Se quitarán de la lista los ${checked.length} productos ya marcados.`,
      confirmLabel: 'Borrar',
      danger: true,
    })
    if (!ok) return
    await conAviso(() => clearCheckedItems(list.id), 'No se han podido borrar')
  }

  async function vaciarTodo() {
    const ok = await confirmar({
      title: 'Vaciar la lista entera',
      message: `Se borrarán los ${items.length} productos de «${list.name}». Esto no se puede deshacer.`,
      confirmLabel: 'Vaciar',
      danger: true,
    })
    if (!ok) return
    await conAviso(() => clearAllItems(list.id), 'No se ha podido vaciar')
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-500">
          {items.length - checked.length} pendientes
          {checked.length > 0 && ` · ${checked.length} en el carro`}
        </p>
        <div className="flex gap-3">
          {checked.length > 0 && (
            <button onClick={borrarComprados} className="text-xs text-ink-500 font-medium">
              Borrar comprados
            </button>
          )}
          <button onClick={onManage} className="text-xs text-ink-500 font-medium">
            Lista ⚙️
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-5">
        <button onClick={onShowAdd} className="flex-1 btn-primary text-sm py-2.5">
          + Añadir producto
        </button>
        <button
          onClick={onShowImport}
          className="px-4 py-2.5 rounded-full bg-teal-50 text-teal-700 text-sm font-medium active:bg-teal-100"
        >
          🍽️ Del menú
        </button>
      </div>

      {!items.length ? (
        <EmptyState
          title="Lista vacía"
          hint="Añade productos a mano o pulsa «Del menú» para traer los ingredientes de la semana planificada."
        />
      ) : (
        <div className="space-y-5 pb-8">
          {CATEGORY_ORDER.map((cat) => {
            const its = pending[cat]
            if (!its || !its.length) return null
            const meta = CATEGORY_META[cat] || { label: cat, icon: '🔸' }
            return (
              <div key={cat}>
                <p className="label-caps text-teal-700 mb-2 flex items-center gap-1.5">
                  <span aria-hidden>{meta.icon}</span>
                  <span>{meta.label}</span>
                  <span className="text-ink-500 font-normal">· {its.length}</span>
                </p>
                <div className="space-y-1.5">
                  {its.map((it) => (
                    <Item
                      key={it.id}
                      item={it}
                      onToggle={() =>
                        conAviso(() => toggleShoppingItem(list.id, it.id), 'No se ha podido marcar')
                      }
                      onDelete={() =>
                        conAviso(() => removeShoppingItem(list.id, it.id), 'No se ha podido borrar')
                      }
                      onEdit={() => onEdit(it)}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {checked.length > 0 && (
            <div>
              <p className="label-caps text-ink-500 mb-2">En el carro · {checked.length}</p>
              <div className="space-y-1.5 opacity-50">
                {checked.map((it) => (
                  <Item
                    key={it.id}
                    item={it}
                    onToggle={() =>
                      conAviso(() => toggleShoppingItem(list.id, it.id), 'No se ha podido marcar')
                    }
                    onDelete={() =>
                      conAviso(() => removeShoppingItem(list.id, it.id), 'No se ha podido borrar')
                    }
                    onEdit={() => onEdit(it)}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            onClick={vaciarTodo}
            className="w-full py-3 text-terracotta-700 text-sm font-medium border border-terracotta-300 rounded-2xl mt-4 active:bg-terracotta-50"
          >
            Vaciar lista entera
          </button>
        </div>
      )}
    </>
  )
}

/* Etiqueta de urgencia según cuándo se necesita el producto */
function urgency(item) {
  const dates = (item.recipes || []).map((r) => r.isoDate).filter(Boolean)
  if (!dates.length) return null
  const soonest = dates.slice().sort()[0]
  const d = daysUntil(new Date(soonest + 'T00:00:00Z'))
  if (d < 0) return { text: 'Ya pasó', tone: 'neutral' }
  if (d === 0) return { text: 'Hoy', tone: 'warn' }
  if (d === 1) return { text: 'Mañana', tone: 'warn' }
  if (d <= 3) return { text: `En ${d} días`, tone: 'warn' }
  return { text: `En ${d} días`, tone: 'teal' }
}

function Item({ item, onToggle, onDelete, onEdit }) {
  const u = urgency(item)
  return (
    <div className="card flex items-start gap-3 px-4 py-3">
      <button
        onClick={onToggle}
        className={`shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          item.checked ? 'bg-terracotta-500 border-terracotta-500' : 'border-cream-400'
        }`}
        aria-label={item.checked ? `Desmarcar ${item.name}` : `Marcar ${item.name}`}
        aria-pressed={!!item.checked}
      >
        {item.checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12l5 5L20 7"
              stroke="#FDFBF7"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <div className="flex items-baseline gap-2">
          <p
            className={`text-ink-900 leading-snug ${
              item.checked ? 'line-through text-ink-500' : ''
            }`}
          >
            {item.name}
          </p>
          {item.quantity && (
            <span className="text-sm font-medium text-terracotta-700 shrink-0">
              {item.quantity}
            </span>
          )}
        </div>

        {item.recipes && item.recipes.length > 0 && (
          <div className="mt-1.5 space-y-1">
            <div className="flex flex-wrap items-center gap-1">
              {u && <Tag tone={u.tone}>⏱ {u.text}</Tag>}
              {item.recipes.slice(0, 3).map((r, i) => (
                <Tag key={i}>
                  {r.day ? r.day.slice(0, 3) : '?'} {r.dateLabel || ''}
                  {r.mealType === 'lunch' ? ' · com' : ' · cena'}
                </Tag>
              ))}
              {item.recipes.length > 3 && <Tag>+{item.recipes.length - 3}</Tag>}
            </div>
            <p className="text-[11px] text-ink-500 truncate">
              {item.recipes.map((r) => r.recipeName).filter(Boolean).join(' · ')}
            </p>
          </div>
        )}
      </button>

      <button
        onClick={onDelete}
        className="shrink-0 text-ink-500 text-lg px-2 mt-0.5"
        aria-label={`Eliminar ${item.name}`}
      >
        ×
      </button>
    </div>
  )
}

/* ============================================================
   MODALES
   ============================================================ */
function NewListModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const avisar = useToast()

  async function create(value) {
    const n = (value ?? name).trim()
    if (!n) return
    setCreating(true)
    try {
      onCreated(await createShoppingList(n))
    } catch (e) {
      avisar('No se ha podido crear: ' + (e?.message || e), 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Sheet title="Nueva lista" onClose={onClose} onCloseLabel="Cancelar">
      <div className="p-5 space-y-4">
        <Field label="Nombre" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Lidl"
            autoFocus
            className="input"
          />
        </Field>
        <div>
          <p className="label-caps text-ink-500 mb-2">Atajos</p>
          <div className="flex flex-wrap gap-2">
            {SUPERMARKETS.map((s) => (
              <Chip key={s} onClick={() => create(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
        <button
          onClick={() => create()}
          disabled={!name.trim() || creating}
          className="btn-primary w-full disabled:opacity-40"
        >
          {creating ? 'Creando…' : 'Crear lista'}
        </button>
      </div>
    </Sheet>
  )
}

function ManageListModal({ list, onClose, onDeleted }) {
  const [name, setName] = useState(list.name)
  const [busy, setBusy] = useState(false)
  const confirmar = useConfirm()
  const avisar = useToast()

  async function guardarNombre() {
    setBusy(true)
    try {
      await renameShoppingList(list.id, name.trim() || list.name)
      onClose()
    } catch (e) {
      avisar('No se ha podido guardar: ' + (e?.message || e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function eliminar() {
    const ok = await confirmar({
      title: `Eliminar «${list.name}»`,
      message: 'Se borrará la lista entera con todos sus productos. Esto no se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteShoppingList(list.id)
      onDeleted()
    } catch (e) {
      avisar('No se ha podido eliminar: ' + (e?.message || e), 'error')
      setBusy(false)
    }
  }

  return (
    <Sheet title="Ajustes de la lista" onClose={onClose}>
      <div className="p-5 space-y-4">
        <Field label="Nombre">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </Field>
        <button onClick={guardarNombre} disabled={busy} className="btn-primary w-full">
          Guardar nombre
        </button>
        <button
          onClick={eliminar}
          disabled={busy}
          className="w-full py-3 text-terracotta-700 text-sm font-medium border border-terracotta-300 rounded-2xl active:bg-terracotta-50"
        >
          Eliminar esta lista
        </button>
      </div>
    </Sheet>
  )
}

export function ItemModal({ list, item, onClose }) {
  const isNew = !item
  const [name, setName] = useState(item?.name || '')
  const [quantity, setQuantity] = useState(item?.quantity || '')
  const [category, setCategory] = useState(item?.category || 'otros')
  const [saving, setSaving] = useState(false)
  const nombreTocado = useRef(false)
  const categoriaTocada = useRef(false)
  const confirmar = useConfirm()
  const avisar = useToast()

  // Sugiere categoría mientras se escribe el nombre, pero nunca pisa
  // la que el usuario haya elegido a mano.
  useEffect(() => {
    if (!nombreTocado.current || categoriaTocada.current) return
    if (!name.trim()) return
    const c = categorize(name)
    if (c !== 'otros') setCategory(c)
  }, [name])

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const datos = {
        name: name.trim(),
        category,
        quantity: quantity.trim() || null,
      }
      if (isNew) await addShoppingItem(list.id, { ...datos, checked: false, recipes: [] })
      else await updateShoppingItem(list.id, item.id, datos)
      onClose()
    } catch (e) {
      avisar('No se ha podido guardar: ' + (e?.message || e), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    const ok = await confirmar({
      title: `Eliminar «${item.name}»`,
      message: 'Se quitará de esta lista de la compra.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setSaving(true)
    try {
      await removeShoppingItem(list.id, item.id)
      onClose()
    } catch (e) {
      avisar('No se ha podido eliminar: ' + (e?.message || e), 'error')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title={isNew ? `Añadir a ${list.name}` : 'Editar producto'}
      onClose={onClose}
      onCloseLabel="Cancelar"
      action={
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="text-terracotta-600 text-sm font-semibold disabled:opacity-40"
        >
          {saving ? '…' : 'Guardar'}
        </button>
      }
    >
      <div className="p-5 space-y-4">
        <Field label="Producto" required>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              nombreTocado.current = true
              setName(e.target.value)
            }}
            placeholder="Ej: Salmón fresco"
            autoFocus={isNew}
            className="input"
          />
        </Field>

        <Field label="Cantidad">
          <div className="flex gap-2">
            <button
              onClick={() => setQuantity((q) => bumpQuantity(q, -1))}
              className="shrink-0 w-11 rounded-2xl bg-cream-200 text-ink-700 text-xl font-medium active:bg-cream-300"
              aria-label="Menos cantidad"
            >
              −
            </button>
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ej: 500 g, 4 lomos, 2 ud"
              className="input flex-1"
            />
            <button
              onClick={() => setQuantity((q) => bumpQuantity(q, 1))}
              className="shrink-0 w-11 rounded-2xl bg-cream-200 text-ink-700 text-xl font-medium active:bg-cream-300"
              aria-label="Más cantidad"
            >
              +
            </button>
          </div>
        </Field>

        <Field label="Categoría">
          <select
            value={category}
            onChange={(e) => {
              categoriaTocada.current = true
              setCategory(e.target.value)
            }}
            className="input"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.icon} {c.label}
              </option>
            ))}
            <option value="otros">🔸 Otros</option>
          </select>
        </Field>

        {!isNew && item.recipes && item.recipes.length > 0 && (
          <div>
            <p className="label-caps text-teal-700 mb-2">Lo necesitas para</p>
            <div className="space-y-1.5">
              {item.recipes.map((r, i) => (
                <div key={i} className="text-sm text-ink-700">
                  <span className="font-medium">
                    {r.day} {r.dateLabel}
                  </span>
                  <span className="text-ink-500">
                    {' '}
                    · {r.mealType === 'lunch' ? 'comida' : 'cena'}
                  </span>
                  {r.recipeName && <div className="text-xs text-ink-500">{r.recipeName}</div>}
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-500 mt-2">
              Comprueba que la caducidad llegue al último día de uso.
            </p>
          </div>
        )}

        {!isNew && (
          <button
            onClick={remove}
            disabled={saving}
            className="w-full py-3 text-terracotta-700 text-sm font-medium border border-terracotta-300 rounded-2xl active:bg-terracotta-50"
          >
            Eliminar de la lista
          </button>
        )}
      </div>
    </Sheet>
  )
}

/* ---------- IMPORTAR INGREDIENTES DE UNA SEMANA ---------- */
export function ImportMenuModal({
  list,
  menus,
  recipesById,
  todayWeekId,
  onClose,
  presetWeek,
}) {
  const nextWeek = shiftWeekId(todayWeekId, 1)
  const available = useMemo(
    () => (menus || []).map((m) => m.id).sort().reverse(),
    [menus]
  )
  const [wid, setWid] = useState(
    () =>
      presetWeek ||
      (available.includes(nextWeek)
        ? nextWeek
        : available.includes(todayWeekId)
          ? todayWeekId
          : available[0])
  )
  const [mode, setMode] = useState('merge') // merge | replace
  const [importing, setImporting] = useState(false)
  const avisar = useToast()

  const menu = (menus || []).find((m) => m.id === wid)

  // Se usan las recetas que hay hoy en el recetario, no la copia
  // congelada dentro del menú.
  const preview = useMemo(
    () => (menu ? extractItemsFromMenu(withLiveRecipes(menu, recipesById), wid) : []),
    [menu, wid, recipesById]
  )

  async function run() {
    if (!preview.length) return
    setImporting(true)
    try {
      await importWeekIntoList(list.id, preview, mode)
      avisar(
        mode === 'replace'
          ? `Lista reemplazada con ${preview.length} productos`
          : `${preview.length} productos volcados en ${list.name}`,
        'ok'
      )
      onClose()
    } catch (e) {
      avisar('No se ha podido importar: ' + (e?.message || e), 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Sheet title={`Del menú → ${list.name}`} onClose={onClose} onCloseLabel="Cancelar" tall>
      <div className="p-5 space-y-4">
        {!available.length ? (
          <EmptyState title="No hay semanas planificadas" hint="Planifica una semana primero." />
        ) : (
          <>
            <Field label="Semana">
              <select value={wid} onChange={(e) => setWid(e.target.value)} className="input">
                {available.map((id) => {
                  const { week } = parseWeekId(id)
                  return (
                    <option key={id} value={id}>
                      Semana {week} · {weekRangeLabel(id)}
                      {id === todayWeekId ? ' (actual)' : id === nextWeek ? ' (próxima)' : ''}
                    </option>
                  )
                })}
              </select>
            </Field>

            <div className="flex gap-2">
              <Chip active={mode === 'merge'} onClick={() => setMode('merge')}>
                Añadir a lo que hay
              </Chip>
              <Chip active={mode === 'replace'} onClick={() => setMode('replace')}>
                Reemplazar la lista
              </Chip>
            </div>

            <p className="text-xs text-ink-500">
              {mode === 'merge'
                ? 'Se pueden importar varias semanas seguidas: lo que ya esté puesto no se duplica ni se vuelve a sumar.'
                : 'Se borrará lo que haya en la lista, incluido lo añadido a mano.'}
            </p>

            <div className="card p-4">
              <p className="label-caps text-teal-700 mb-2">{preview.length} productos</p>
              <div className="max-h-64 overflow-y-auto space-y-1 text-sm">
                {preview.map((p) => (
                  <div key={p.id} className="flex justify-between gap-3">
                    <span className="text-ink-700 truncate">{p.name}</span>
                    <span className="text-ink-500 shrink-0">{p.quantity || ''}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={run}
              disabled={!preview.length || importing}
              className="btn-primary w-full disabled:opacity-40"
            >
              {importing ? 'Importando…' : `Importar ${preview.length} productos`}
            </button>
          </>
        )}
      </div>
    </Sheet>
  )
}

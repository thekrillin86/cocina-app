/* ============================================================
   ACCESO A FIRESTORE

   Colecciones:
     /menus/{año-semana}   → planificación semanal
     /recipes/{id}         → catálogo de recetas (comidas y cenas)
     /shopping-lists/{id}  → listas de la compra

   Las listas de la compra guardan sus productos en un array dentro
   del documento. Para que dos móviles puedan marcar cosas a la vez
   en el supermercado sin pisarse, todas las modificaciones pasan por
   una transacción que relee el array antes de escribirlo.
   ============================================================ */
import { useState, useEffect } from 'react'
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  runTransaction,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { weekId } from './dates'
import { mergeShoppingItems } from './ingredients'

const ahora = () => new Date().toISOString()

/* ============================================================
   MENÚS SEMANALES
   ============================================================ */

export function useMenu(wid) {
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

/* Todos los menús guardados.

   Se suscribe una sola vez en App y se reparte por props: antes lo
   llamaban también Estadísticas e Histórico, lo que abría tres
   suscripciones a la colección entera. */
export function useAllMenus() {
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

export async function importMenuToFirestore(menuData) {
  const wid = weekId(menuData.year, menuData.week)
  await setDoc(doc(db, 'menus', wid), {
    ...menuData,
    importedAt: ahora(),
  })
  return wid
}

export async function deleteMenu(wid) {
  await deleteDoc(doc(db, 'menus', wid))
}

/* ============================================================
   LISTAS DE LA COMPRA
   ============================================================ */

export function useShoppingLists() {
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
      (err) => {
        console.error('Error cargando listas:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  return { lists, loading }
}

export function newItemId() {
  return 'it_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
}

export async function createShoppingList(name) {
  const id =
    name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'lista-' + Date.now()
  await setDoc(doc(db, 'shopping-lists', id), {
    name,
    items: [],
    createdAt: ahora(),
  })
  return id
}

export async function renameShoppingList(listId, name) {
  await updateDoc(doc(db, 'shopping-lists', listId), { name, updatedAt: ahora() })
}

export async function deleteShoppingList(listId) {
  await deleteDoc(doc(db, 'shopping-lists', listId))
}

/* Relee los productos dentro de la transacción y aplica `transformar`.
   Si dos móviles escriben a la vez, Firestore reintenta en lugar de
   dejar que uno sobrescriba al otro. */
async function actualizarItems(listId, transformar) {
  const ref = doc(db, 'shopping-lists', listId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists()) throw new Error('Esa lista ya no existe')
    const items = snap.data().items || []
    tx.update(ref, { items: transformar(items), updatedAt: ahora() })
  })
}

export async function addShoppingItem(listId, item) {
  await actualizarItems(listId, (items) => [
    ...items,
    { id: newItemId(), checked: false, quantity: null, recipes: [], ...item },
  ])
}

export async function updateShoppingItem(listId, itemId, cambios) {
  await actualizarItems(listId, (items) =>
    items.map((it) => (it.id === itemId ? { ...it, ...cambios } : it))
  )
}

export async function toggleShoppingItem(listId, itemId) {
  await actualizarItems(listId, (items) =>
    items.map((it) => (it.id === itemId ? { ...it, checked: !it.checked } : it))
  )
}

export async function removeShoppingItem(listId, itemId) {
  await actualizarItems(listId, (items) => items.filter((it) => it.id !== itemId))
}

export async function clearCheckedItems(listId) {
  await actualizarItems(listId, (items) => items.filter((it) => !it.checked))
}

export async function clearAllItems(listId) {
  await actualizarItems(listId, () => [])
}

/* Vuelca los ingredientes de una semana en la lista.
   `modo`: 'merge' añade sin duplicar, 'replace' sustituye la lista. */
export async function importWeekIntoList(listId, entrantes, modo = 'merge') {
  let total = 0
  await actualizarItems(listId, (items) => {
    const siguiente = modo === 'replace' ? entrantes : mergeShoppingItems(items, entrantes)
    total = siguiente.length
    return siguiente
  })
  return total
}

/* ============================================================
   BUZÓN DE RECETAS

   El asistente deja lotes en /inbox desde fuera de la app. Lo que
   haya ahí es contenido de origen externo: la app lo enseña para
   revisarlo y no aplica nada por su cuenta.
   ============================================================ */

export function useInbox() {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'inbox'), where('status', '==', 'pending')),
      (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        // Los más nuevos arriba
        lista.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        setBatches(lista)
        setError(null)
        setLoading(false)
      },
      (err) => {
        // Sin las reglas publicadas esto da permission-denied: la app
        // tiene que seguir funcionando igual.
        console.error('Error leyendo el buzón:', err)
        setError(err)
        setBatches([])
        setLoading(false)
      }
    )
    return unsub
  }, [])

  return { batches, loading, error }
}

/* El lote queda marcado, no se borra: así se sabe que se revisó */
export async function markInboxDone(loteId) {
  await updateDoc(doc(db, 'inbox', loteId), { status: 'done', doneAt: ahora() })
}

export async function deleteInboxBatch(loteId) {
  await deleteDoc(doc(db, 'inbox', loteId))
}

/* ============================================================
   CATÁLOGO DE RECETAS
   ============================================================ */

export function useRecipes() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'recipes')),
      (snap) => {
        setRecipes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.error('Error cargando recetas:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  return { recipes, loading }
}

export function newRecipeId(name) {
  const slug = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48)
  return (slug || 'receta') + '-' + Math.random().toString(36).slice(2, 6)
}

export async function saveRecipe(id, data) {
  const rid = id || newRecipeId(data.name)
  await setDoc(
    doc(db, 'recipes', rid),
    {
      ...data,
      updatedAt: ahora(),
      ...(id ? {} : { createdAt: ahora() }),
    },
    { merge: true }
  )
  return rid
}

export async function deleteRecipe(id) {
  await deleteDoc(doc(db, 'recipes', id))
}

/* Borrado masivo de recetas.

   Borrar del recetario no toca el histórico: las veces que se ha
   cocinado un plato salen de los menús guardados, no de aquí. */
export async function bulkDeleteRecipes(ids) {
  const limpios = (ids || []).filter(Boolean)
  const chunks = []
  for (let i = 0; i < limpios.length; i += 400) chunks.push(limpios.slice(i, i + 400))
  for (const chunk of chunks) {
    const batch = writeBatch(db)
    for (const id of chunk) batch.delete(doc(db, 'recipes', id))
    await batch.commit()
  }
  return limpios.length
}

/* Alta masiva de recetas (repertorio inicial / sincronización desde menús) */
export async function bulkSaveRecipes(list) {
  const chunks = []
  for (let i = 0; i < list.length; i += 400) chunks.push(list.slice(i, i + 400))
  for (const chunk of chunks) {
    const batch = writeBatch(db)
    for (const r of chunk) {
      const { id, ...data } = r
      batch.set(doc(db, 'recipes', id || newRecipeId(data.name)), data, { merge: true })
    }
    await batch.commit()
  }
  return list.length
}

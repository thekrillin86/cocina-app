/* ============================================================
   ACCESO A FIRESTORE
   Colecciones:
     /menus/{año-semana}   → planificación semanal
     /recipes/{id}         → catálogo de recetas (comidas y cenas)
     /shopping-lists/{id}  → listas de la compra
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
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { weekId } from './dates'

/* ---------- MENÚS SEMANALES ---------- */

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

/* ============================================================
   OPERACIONES DE ESCRITURA
   ============================================================ */

export async function saveMealToFirestore(wid, dayIndex, mealType, mealData, currentDays) {
  const newDays = currentDays.map((d, i) =>
    i === dayIndex ? { ...d, [mealType]: mealData } : d
  )
  await updateDoc(doc(db, 'menus', wid), { days: newDays })
}

export async function deleteMealInFirestore(wid, dayIndex, mealType, currentDays) {
  const newDays = currentDays.map((d, i) =>
    i === dayIndex ? { ...d, [mealType]: null } : d
  )
  await updateDoc(doc(db, 'menus', wid), { days: newDays })
}

export async function importMenuToFirestore(menuData) {
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

/* ---------- LISTAS DE LA COMPRA ---------- */
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
      () => setLoading(false)
    )
    return unsub
  }, [])
  return { lists, loading }
}

export async function createShoppingList(name) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'lista-' + Date.now()
  await setDoc(doc(db, 'shopping-lists', id), {
    name,
    items: [],
    createdAt: new Date().toISOString(),
  })
  return id
}

export async function updateShoppingList(listId, items) {
  await updateDoc(doc(db, 'shopping-lists', listId), { items })
}

export async function deleteShoppingList(listId) {
  await deleteDoc(doc(db, 'shopping-lists', listId))
}


export async function deleteMenu(wid) {
  await deleteDoc(doc(db, 'menus', wid))
}

/* Guarda la planificación de una semana completa */
export async function saveWeekPlan(wid, data) {
  await setDoc(doc(db, 'menus', wid), {
    ...data,
    updatedAt: new Date().toISOString(),
  })
  return wid
}

export async function renameShoppingList(listId, name) {
  await updateDoc(doc(db, 'shopping-lists', listId), { name })
}

/* ---------- CATÁLOGO DE RECETAS ---------- */

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
      updatedAt: new Date().toISOString(),
      ...(id ? {} : { createdAt: new Date().toISOString() }),
    },
    { merge: true }
  )
  return rid
}

export async function deleteRecipe(id) {
  await deleteDoc(doc(db, 'recipes', id))
}

/* Alta masiva de recetas (semilla inicial / sincronización desde menús) */
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

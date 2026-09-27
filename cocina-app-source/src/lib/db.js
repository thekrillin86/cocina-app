/* ============================================================
   ACCESO A FIRESTORE

   Colecciones:
     /menus/{año-semana}   → planificación semanal
     /recipes/{id}         → catálogo de recetas (comidas y cenas)
     /shopping-lists/{id}  → listas de la compra

   Las listas de la compra guardan sus productos en un mapa dentro
   del documento, y cada cambio escribe solo su campo. Eso es lo que
   permite marcar productos sin cobertura —la escritura se apunta en
   el móvil y se ve al instante— y a la vez que dos móviles no se
   pisen, porque tocan campos distintos y Firestore los combina.
   Ver `shoppingList.js` para el porqué en detalle.
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
  deleteField,
  FieldPath,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { weekId } from './dates'
import { mergeShoppingItems } from './ingredients'
import { asItems, isItemMap, itemsToMap, newItemId, findItem } from './shoppingList'

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

/* Además de las listas, devuelve cómo va la sincronización:

     sinConexion — lo que se ve sale de la caché del móvil, no del
                   servidor. Se sigue pudiendo marcar y añadir.
     porSubir    — hay cambios hechos aquí que todavía no han subido.

   Firestore lo cuenta en los metadatos de cada snapshot, pero solo
   los manda si se piden con `includeMetadataChanges`. */
export function useShoppingLists() {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState({ sinConexion: false, porSubir: false })

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'shopping-lists')),
      { includeMetadataChanges: true },
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'))
        setLists(list)
        setSync({
          sinConexion: snap.metadata.fromCache,
          porSubir: snap.metadata.hasPendingWrites,
        })
        setLoading(false)
      },
      (err) => {
        console.error('Error cargando listas:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  return { lists, loading, sync }
}

export async function createShoppingList(name) {
  const id =
    name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'lista-' + Date.now()
  await setDoc(doc(db, 'shopping-lists', id), {
    name,
    items: {},
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

/* ============================================================
   CAMBIOS EN LOS PRODUCTOS

   Todas las operaciones reciben la lista tal y como está en
   pantalla, no solo su identificador: de ahí sale el estado actual
   de cada producto y si la lista todavía está guardada como array.

   Ninguna usa transacciones a propósito. Son escrituras normales,
   que Firestore apunta primero en el móvil: la casilla se marca al
   instante aunque no haya cobertura y sube cuando vuelva la señal.
   ============================================================ */

const refLista = (list) => doc(db, 'shopping-lists', list.id)

/* Las listas de antes guardaban los productos como array, y sobre un
   array no se puede escribir un campo suelto. La primera vez que se
   toca una, se convierte a mapa. Pasa una sola vez por lista y la
   conversión es la misma se haga desde el móvil que se haga, así que
   no importa si los dos la convierten a la vez. */
async function asegurarMapa(list) {
  if (isItemMap(list)) return
  await updateDoc(refLista(list), { items: itemsToMap(asItems(list)) })
}

/* Ruta al campo de un producto.

   Con FieldPath cada segmento va suelto, así que el identificador se
   toma tal cual. Escribiéndolo como texto —`items.${id}.checked`—
   Firestore parte por los puntos, y un producto como
   "Leche 1.5% materia grasa" acababa escribiendo en una rama que no
   existía: la casilla no se movía y no saltaba ningún error. Los
   caracteres '~', '*', '/', '[' y ']' directamente dan error.

   Los productos nuevos ya llevan identificadores limpios, pero los
   que hay guardados de antes no, y con esto se siguen pudiendo
   tocar sin migrar nada. */
const campoDe = (itemId, ...resto) => new FieldPath('items', itemId, ...resto)

/* `pares` es una lista de [campo, valor] */
async function escribirCampos(list, pares) {
  if (!pares.length) return
  await asegurarMapa(list)
  await updateDoc(refLista(list), ...pares.flat(), 'updatedAt', ahora())
}

export async function addShoppingItem(list, item) {
  const id = item.id || newItemId()
  await escribirCampos(list, [
    [campoDe(id), { id, checked: false, quantity: null, recipes: [], ...item }],
  ])
  return id
}

export async function updateShoppingItem(list, itemId, cambios) {
  const pares = Object.entries(cambios).map(([clave, valor]) => [campoDe(itemId, clave), valor])
  await escribirCampos(list, pares)
}

/* El estado nuevo sale del que hay en pantalla, que con la caché
   local es el bueno aunque no haya cobertura. */
export async function toggleShoppingItem(list, itemId) {
  const item = findItem(list, itemId)
  if (!item) return
  await escribirCampos(list, [[campoDe(itemId, 'checked'), !item.checked]])
}

export async function removeShoppingItem(list, itemId) {
  await escribirCampos(list, [[campoDe(itemId), deleteField()]])
}

export async function clearCheckedItems(list) {
  const pares = asItems(list)
    .filter((it) => it.checked)
    .map((it) => [campoDe(it.id), deleteField()])
  if (!pares.length) return 0
  await escribirCampos(list, pares)
  return pares.length
}

export async function clearAllItems(list) {
  await updateDoc(refLista(list), { items: {}, updatedAt: ahora() })
}

/* Vuelca los ingredientes de una semana en la lista.
   `modo`: 'merge' añade sin duplicar, 'replace' sustituye la lista.

   Esto sí reescribe los productos enteros, pero es una acción
   deliberada que se hace en casa antes de salir, no en mitad del
   pasillo, y `mergeShoppingItems` es idempotente. */
export async function importWeekIntoList(list, entrantes, modo = 'merge') {
  const siguientes = modo === 'replace' ? entrantes : mergeShoppingItems(asItems(list), entrantes)
  await updateDoc(refLista(list), {
    items: itemsToMap(siguientes),
    updatedAt: ahora(),
  })
  return siguientes.length
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

/* ============================================================
   PRODUCTOS DE UNA LISTA DE LA COMPRA

   Los productos viven dentro del documento de la lista, y se guardan
   como un MAPA con el identificador de cada uno como clave:

     items: { it_a3f9: { id: 'it_a3f9', name: 'Leche', ... }, ... }

   No es un capricho. Con un array, cambiar una casilla obliga a
   reescribir la lista entera, y eso pedía una transacción para que
   dos móviles no se pisaran en el supermercado. Pero las
   transacciones de Firestore NO pasan por la caché del móvil: van
   directas al servidor y reintentan. Sin cobertura se quedaban
   colgadas y la lista dejaba de responder, que es justo donde más
   falta hace.

   Con el mapa, marcar un producto es escribir un solo campo
   (`items.it_a3f9.checked`). Eso es una escritura normal: se apunta
   en el móvil, se ve al instante y se sincroniza al volver la señal.
   Y como cada móvil toca campos distintos, Firestore los combina sin
   que nadie pise a nadie.

   Las listas creadas antes de esto todavía son un array. Se leen
   igual y se convierten solas la primera vez que se tocan.
   ============================================================ */

/* Los productos, siempre como lista, venga como venga guardado */
export function asItems(list) {
  const items = list?.items
  if (!items) return []
  if (Array.isArray(items)) return items.filter((it) => it && it.id)
  return Object.entries(items)
    .filter(([, it]) => it && typeof it === 'object')
    .map(([clave, it]) => ({ ...it, id: it.id || clave }))
}

/* ¿Está ya guardada como mapa? Las que no, hay que convertirlas
   antes de poder escribir campo a campo. */
export function isItemMap(list) {
  const items = list?.items
  return !!items && !Array.isArray(items) && typeof items === 'object'
}

/* De lista a mapa por identificador */
export function itemsToMap(items) {
  const mapa = {}
  for (const it of items || []) {
    if (it && it.id) mapa[it.id] = { ...it, id: it.id }
  }
  return mapa
}

export function newItemId() {
  return 'it_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
}

/* Un producto suelto de la lista, o null */
export function findItem(list, itemId) {
  return asItems(list).find((it) => it.id === itemId) || null
}

/* Cuántos quedan por comprar */
export function countPending(list) {
  return asItems(list).filter((it) => !it.checked).length
}

/* ============================================================
   IDENTIFICADORES SEGUROS

   El identificador de un producto se usa como clave dentro del
   documento. Firestore reserva unos cuantos caracteres en las rutas
   de campo: '~', '*', '/', '[' y ']' dan error, y el PUNTO es peor
   todavía, porque parte la ruta en trozos sin avisar. Un producto
   llamado "Leche 1.5% materia grasa" generaba
   `auto_leche_1.5%_materia_grasa`, y marcarlo escribía en un sitio
   que no existía: la casilla no se movía y no aparecía ningún error.

   Los que se generan a partir del nombre pasan por aquí. Los que ya
   estén guardados con un identificador raro se siguen pudiendo tocar,
   porque al escribir se usa `FieldPath` con segmentos sueltos en vez
   de una ruta con puntos.
   ============================================================ */
export function safeItemId(texto) {
  const limpio = String(texto || '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/(^_|_$)/g, '')
  return limpio || 'x'
}

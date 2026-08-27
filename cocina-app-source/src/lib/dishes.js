/* ============================================================
   PLATOS DE UN HUECO

   Un hueco (la comida o la cena de un día) puede llevar más de un
   plato: "carne torrada + ensalada de tomate". Cada plato es
   completo — tiene su receta, sus calorías y su nota — porque si no
   la lista de la compra no recogería los ingredientes del segundo ni
   contaría en las estadísticas.

   Lo guardado en Firestore puede tener tres formas:
     · null                    → hueco vacío
     · un objeto               → un plato (formato anterior)
     · una lista de objetos    → varios platos

   Al escribir se conserva el objeto suelto cuando solo hay un plato.
   Así los menús que ya existen no cambian de forma y solo los huecos
   que de verdad se doblan usan lista.

   Este módulo es puro a propósito: lo usan tanto el planificador
   como la extracción de ingredientes, que se prueba sin Firebase.
   ============================================================ */

/* Los platos de un hueco, siempre como lista */
export function asDishes(slot) {
  if (!slot) return []
  const lista = Array.isArray(slot) ? slot : [slot]
  return lista.filter((d) => d && d.name)
}

/* De vuelta al formato de guardado */
export function fromDishes(dishes) {
  const limpios = (dishes || []).filter((d) => d && d.name)
  if (!limpios.length) return null
  return limpios.length === 1 ? limpios[0] : limpios
}

/* ¿Tiene algo este hueco? */
export function hasDishes(slot) {
  return asDishes(slot).length > 0
}

/* Nombres unidos: "Carne torrada + Ensalada de tomate" */
export function dishesLabel(slot, separador = ' + ') {
  return asDishes(slot)
    .map((d) => d.name)
    .join(separador)
}

/* Calorías del hueco entero: suman las de todos sus platos.
   Devuelve null si ninguno las tiene. */
export function slotCalories(slot) {
  const platos = asDishes(slot)
  let total = null
  for (const d of platos) {
    if (typeof d.calories === 'number' && !Number.isNaN(d.calories)) {
      total = (total || 0) + d.calories
    }
  }
  return total
}

/* Recorre todos los platos de un menú.
   visitar(plato, { dayIndex, day, mealType, dishIndex }) */
export function forEachDish(menu, visitar) {
  if (!menu?.days) return
  menu.days.forEach((d, dayIndex) => {
    for (const mealType of ['lunch', 'dinner']) {
      asDishes(d[mealType]).forEach((plato, dishIndex) => {
        visitar(plato, { dayIndex, day: d.day || null, mealType, dishIndex })
      })
    }
  })
}

/* ============================================================
   IMPORTAR RECETAS AL RECETARIO

   Valida el JSON que se pega en «Importar» y lo deja listo para
   `bulkSaveRecipes`.

   Dos reglas que mandan sobre todo lo demás:

   1. O valida todo, o no se escribe nada. Un lote a medias deja el
      recetario en un estado que nadie pidió.

   2. Un nombre que ya está en el recetario se FUSIONA con su ficha,
      no crea una copia. Esto hay que hacerlo a mano: `newRecipeId`
      añade un sufijo aleatorio, así que dos altas con el mismo
      nombre generan dos identificadores distintos y `{merge:true}`
      no llega a fusionar nada. Aquí se busca por nombre normalizado
      y se reutiliza el identificador que ya existe.

   Al fusionar solo se escriben los campos que trae el JSON: lo que
   no venga se deja como está, para no borrar valoraciones ni
   recetas con una importación incompleta.
   ============================================================ */
import { DISH_CATEGORIES, guessCategory } from './catalog'
import { normalize } from './ingredients'
import { asLines } from './format'

export const TIPOS_VALIDOS = ['comida', 'cena']

const CATEGORIAS_VALIDAS = new Set([...DISH_CATEGORIES.map((c) => c.key), 'otro'])

/* ============================================================
   QUÉ SE HA PEGADO
   ============================================================ */

export function detectPayload(json) {
  if (Array.isArray(json)) return 'recetas'
  if (!json || typeof json !== 'object') return 'desconocido'
  if (Array.isArray(json.recipes)) return 'recetas'
  if (json.week && json.year && Array.isArray(json.days)) return 'menu'
  return 'desconocido'
}

function listaDeRecetas(json) {
  if (Array.isArray(json)) return json
  if (json && Array.isArray(json.recipes)) return json.recipes
  return null
}

/* ============================================================
   NORMALIZACIÓN DE UNA RECETA
   ============================================================ */

function textoONulo(valor) {
  if (valor == null) return null
  const t = String(valor).trim()
  return t || null
}

/* Las proteínas se admiten como texto o como lista: ['Pollo','huevo']
   se guarda igual que lo escribe el editor a mano, "Pollo + huevo". */
function proteinasONulo(valor) {
  if (Array.isArray(valor)) {
    const partes = valor.map((v) => String(v).trim()).filter(Boolean)
    return partes.length ? partes.join(' + ') : null
  }
  return textoONulo(valor)
}

function numeroONulo(valor) {
  if (valor == null || valor === '') return null
  const n = typeof valor === 'number' ? valor : parseInt(String(valor).trim(), 10)
  return Number.isFinite(n) ? n : null
}

/* El cuerpo de la receta se emite entero —las cuatro claves— o no se
   emite. Firestore fusiona los mapas anidados clave a clave, así que
   mandar solo una parte dejaría mezclados los pasos viejos con los
   ingredientes nuevos. */
function cuerpoDeReceta(cruda) {
  if (!cruda || typeof cruda !== 'object' || Array.isArray(cruda)) return null
  const method = textoONulo(cruda.method)
  const source = textoONulo(cruda.source)
  const ingredients = asLines(cruda.ingredients)
  const steps = asLines(cruda.steps)
  if (!method && !source && !ingredients.length && !steps.length) return null
  return { method, source, ingredients, steps }
}

/* ============================================================
   VALIDACIÓN Y PREPARACIÓN DEL LOTE
   ============================================================ */

/**
 * @param json            lo que se ha pegado, ya parseado
 * @param recetasActuales el recetario, para detectar nombres repetidos
 * @param opciones        { ahora } fecha de alta de las nuevas
 * @returns { ok, recipes, errors, nuevas, colisiones }
 */
export function parseRecipesPayload(json, recetasActuales = [], opciones = {}) {
  const { ahora = new Date().toISOString() } = opciones
  const vacio = { ok: false, recipes: [], errors: [], nuevas: 0, colisiones: [] }

  const tipo = detectPayload(json)
  if (tipo === 'menu') {
    return {
      ...vacio,
      errors: [{ etiqueta: 'El JSON', problema: 'es un menú semanal, no un lote de recetas' }],
    }
  }
  if (tipo !== 'recetas') {
    return {
      ...vacio,
      errors: [
        {
          etiqueta: 'El JSON',
          problema:
            'no se reconoce. Se espera una lista de recetas, un objeto con "recipes", o un menú con "week", "year" y "days"',
        },
      ],
    }
  }

  const crudas = listaDeRecetas(json)
  if (!crudas.length) {
    return { ...vacio, errors: [{ etiqueta: 'El JSON', problema: 'no trae ninguna receta' }] }
  }

  const porNombre = new Map(
    (recetasActuales || []).filter((r) => r && r.name).map((r) => [normalize(r.name), r])
  )

  const errors = []
  const recipes = []
  const colisiones = []
  const vistos = new Map() // nombres repetidos dentro del propio lote

  crudas.forEach((cruda, i) => {
    const etiqueta = textoONulo(cruda?.name) || `Receta ${i + 1}`

    if (!cruda || typeof cruda !== 'object' || Array.isArray(cruda)) {
      errors.push({ etiqueta: `Receta ${i + 1}`, problema: 'no es un objeto' })
      return
    }

    const name = textoONulo(cruda.name)
    if (!name) {
      errors.push({ etiqueta, problema: 'le falta el nombre' })
      return
    }

    const type = textoONulo(cruda.type)?.toLowerCase()
    if (!type || !TIPOS_VALIDOS.includes(type)) {
      errors.push({
        etiqueta,
        problema: type
          ? `tiene el tipo "${cruda.type}" y solo vale "comida" o "cena"`
          : 'le falta el tipo ("comida" o "cena")',
      })
      return
    }

    const clave = normalize(name)
    if (vistos.has(clave)) {
      errors.push({
        etiqueta,
        problema: `está repetida dentro del propio lote (también en la posición ${vistos.get(clave) + 1})`,
      })
      return
    }
    vistos.set(clave, i)

    // Una categoría que no exista se trata como si no viniera
    const categoriaDada = textoONulo(cruda.category)
    const category =
      categoriaDada && CATEGORIAS_VALIDAS.has(categoriaDada)
        ? categoriaDada
        : guessCategory(name)

    const existente = porNombre.get(clave)
    const receta = { name, type, category }

    /* En las nuevas se rellenan los huecos; en las que fusionan solo
       se manda lo que trae el JSON, para no pisar lo que ya hay. */
    const ponerSiViene = (campo, valor, porDefecto) => {
      if (valor != null) receta[campo] = valor
      else if (!existente) receta[campo] = porDefecto
    }

    ponerSiViene('proteins', proteinasONulo(cruda.proteins), null)
    ponerSiViene('calories', numeroONulo(cruda.calories), null)
    ponerSiViene('rating', numeroONulo(cruda.rating), 0)
    ponerSiViene('source', textoONulo(cruda.source), null)
    ponerSiViene('recipe', cuerpoDeReceta(cruda.recipe), null)

    if (existente) {
      receta.id = existente.id
      colisiones.push(name)
    } else {
      /* Fecha de alta, para poder enseñarlas como nuevas durante unos
         días. Solo en las que se crean: fusionar no las rejuvenece. */
      receta.createdAt = ahora
    }

    recipes.push(receta)
  })

  if (errors.length) return { ...vacio, errors }

  return {
    ok: true,
    recipes,
    errors: [],
    nuevas: recipes.length - colisiones.length,
    colisiones,
  }
}

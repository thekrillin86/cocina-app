/* Formato de valores para mostrar en pantalla */

/* Un array o un texto multilínea se enseñan igual: una cosa por línea */
export function asMultiline(value) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join('\n')
  return String(value)
}

/* El camino contrario: un texto con saltos de línea (o ya un array)
   a array de líneas limpias. Es lo que se guarda en las recetas
   importadas, para que queden como las del repertorio base. */
export function asLines(value) {
  if (!value) return []
  const lista = Array.isArray(value) ? value : String(value).split('\n')
  return lista.map((l) => String(l).trim()).filter(Boolean)
}

/* Proteínas (array o texto) como "Merluza + huevo" */
export function formatProteins(value) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(' + ')
  return String(value)
}

/* "A, B y 3 más" — para no llenar un diálogo de nombres */
export function listaLegible(nombres, tope = 5) {
  const l = (nombres || []).filter(Boolean)
  if (!l.length) return ''
  if (l.length <= tope) return l.join(', ')
  return `${l.slice(0, tope).join(', ')} y ${l.length - tope} más`
}

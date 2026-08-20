/* Formato de valores para mostrar en pantalla */

/* Un array o un texto multilínea se enseñan igual: una cosa por línea */
export function asMultiline(value) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join('\n')
  return String(value)
}

/* Proteínas (array o texto) como "Merluza + huevo" */
export function formatProteins(value) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(' + ')
  return String(value)
}

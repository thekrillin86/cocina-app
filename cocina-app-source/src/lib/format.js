/* Formato de valores */

// Convierte valor array o string a string multilinea para mostrar
export function asMultiline(value) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join('\n')
  return String(value)
}

// Convierte proteins (array o string) a texto breve para mostrar
export function formatProteins(value) {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(' + ')
  return String(value)
}

/* ============================================================
   HELPERS DE LISTA DE LA COMPRA
   ============================================================ */

export function generateItemId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

/* ============================================================
   CONSTANTES
   ============================================================ */

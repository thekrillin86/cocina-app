/* ============================================================
   INGREDIENTES: limpieza, alias, cantidades y categorías
   ============================================================ */

import { DAYS_ES, dateForDay, formatDayMonth } from './dates'

/* ============================================================
   NORMALIZACIÓN Y ALIASES PARA DEDUPLICACIÓN INTELIGENTE
   ============================================================ */

// Quita acentos, minúsculas, espacios
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Aliases: si un texto coincide con la regex → se sustituye por el nombre canónico.
// Esto fusiona "aceite", "aceite de oliva", "aceite de oliva virgen extra" en uno solo.
export const CANONICAL_ALIASES = [
  // Despensa base
  { canon: 'Aceite de oliva', match: /^aceite(\s+de\s+oliva)?(\s+virgen(\s+extra)?)?$|^aove$/ },
  { canon: 'Sal', match: /^sal(\s+marina|\s+gruesa|\s+fina|\s+yodada)?$/ },
  { canon: 'Pimienta', match: /^pimienta(\s+negra|\s+blanca|\s+molida)?$/ },
  { canon: 'Vinagre', match: /^vinagre(\s+de\s+(manzana|vino|jerez|modena|arroz))?$/ },
  { canon: 'Azúcar', match: /^azucar(\s+blanco|\s+moreno)?$/ },
  { canon: 'Harina', match: /^harina(\s+de\s+\w+)?$/ },
  { canon: 'Mantequilla', match: /^mantequilla$/ },

  // Proteínas frecuentes
  { canon: 'Huevos', match: /^huevo(s)?$/ },
  { canon: 'Pollo', match: /^pollo$|^pechuga(s)?(\s+de\s+pollo)?$/ },
  { canon: 'Ternera', match: /^ternera$|^carne\s+de\s+ternera$/ },
  { canon: 'Salmón', match: /^salmon(\s+fresco)?$|^lomos?\s+de\s+salmon$/ },
  { canon: 'Atún en lata', match: /^atun(\s+en\s+lata)?$|^lata(s)?\s+de\s+atun$/ },
  { canon: 'Merluza', match: /^merluza$|^lomos?\s+de\s+merluza$/ },
  { canon: 'Bacalao', match: /^bacalao$|^lomos?\s+de\s+bacalao$/ },
  { canon: 'Dorada', match: /^dorada$/ },
  { canon: 'Sepia', match: /^sepia(\s+limpia)?$/ },
  { canon: 'Pavo', match: /^pavo$|^solomillo(s)?\s+de\s+pavo$|^pechuga(s)?\s+de\s+pavo$/ },
  { canon: 'Conejo', match: /^conejo(\s+troceado)?$/ },
  { canon: 'Gambas', match: /^gambas$/ },

  // Verduras frecuentes
  { canon: 'Ajo', match: /^ajo(s)?$|^dientes?\s+de\s+ajo$/ },
  { canon: 'Cebolla', match: /^cebolla(s)?(\s+morada(s)?)?$/ },
  { canon: 'Tomate', match: /^tomate(s)?(\s+maduro(s)?)?$/ },
  { canon: 'Tomate cherry', match: /^tomate(s)?\s+cherry$/ },
  { canon: 'Tomate triturado', match: /^tomate\s+triturado$/ },
  { canon: 'Tomate frito', match: /^tomate\s+frito$/ },
  { canon: 'Calabacín', match: /^calabacin(es)?$/ },
  { canon: 'Pimiento rojo', match: /^pimiento(s)?\s+rojo(s)?$/ },
  { canon: 'Pimiento verde', match: /^pimiento(s)?\s+verde(s)?$/ },
  { canon: 'Pimiento', match: /^pimiento(s)?$/ },
  { canon: 'Pimientos asados', match: /^pimientos\s+asados$|^bote(s)?\s+de\s+pimientos\s+asados$/ },
  { canon: 'Zanahoria', match: /^zanahoria(s)?$/ },
  { canon: 'Patata', match: /^patata(s)?$/ },
  { canon: 'Espárragos trigueros', match: /^esparragos(\s+trigueros)?$/ },
  { canon: 'Champiñones', match: /^champinon(es)?$/ },
  { canon: 'Lechuga', match: /^lechuga(\s+variada)?$/ },
  { canon: 'Canónigos', match: /^canonigos$/ },
  { canon: 'Rúcula', match: /^rucula$/ },
  { canon: 'Pepino', match: /^pepino(s)?$/ },
  { canon: 'Aguacate', match: /^aguacate(s)?$/ },
  { canon: 'Guisantes', match: /^guisantes$/ },
  { canon: 'Espinacas', match: /^espinaca(s)?$/ },
  { canon: 'Puerro', match: /^puerro(s)?$/ },
  { canon: 'Albahaca', match: /^albahaca(\s+fresca)?$/ },
  { canon: 'Perejil', match: /^perejil(\s+fresco)?$/ },

  // Frutas
  { canon: 'Limón', match: /^limon(es)?(\s+amarillo|\s+verde)?$|^zumo\s+de\s+limon$/ },
  { canon: 'Lima', match: /^lima(s)?$|^zumo\s+de\s+lima$/ },
  { canon: 'Manzana', match: /^manzana(s)?$/ },
  { canon: 'Pera', match: /^pera(s)?(\s+conferencia)?$/ },
  { canon: 'Naranja', match: /^naranja(s)?$/ },
  { canon: 'Mango', match: /^mango(s)?(\s+maduro)?$/ },
  { canon: 'Uva blanca', match: /^uva(s)?(\s+blanca(s)?)?$/ },
  { canon: 'Piña', match: /^pina(\s+en\s+rodajas)?$/ },

  // Lácteos
  { canon: 'Mozzarella', match: /^mozzarella(\s+fresca)?$/ },
  { canon: 'Queso parmesano', match: /^queso\s+parmesano$|^parmesano$/ },
  { canon: 'Queso rallado', match: /^queso\s+rallado$/ },
  { canon: 'Queso tierno', match: /^queso(\s+tierno|\s+fresco)?$/ },
  { canon: 'Leche', match: /^leche(\s+entera|\s+desnatada|\s+semidesnatada)?$/ },
  { canon: 'Nata', match: /^nata(\s+para\s+cocinar|\s+liquida)?$/ },

  // Legumbres y cereales
  { canon: 'Lentejas', match: /^lentejas(\s+cocidas)?$/ },
  { canon: 'Garbanzos', match: /^garbanzos(\s+cocidos)?$/ },
  { canon: 'Arroz', match: /^arroz(\s+blanco|\s+integral|\s+basmati)?$/ },
  { canon: 'Quinoa', match: /^quinoa$/ },
  { canon: 'Pasta', match: /^pasta(\s+fresca|\s+seca)?$/ },

  // Salsas / aliños
  { canon: 'Salsa de soja', match: /^salsa\s+de\s+soja$|^soja$/ },
  { canon: 'Mostaza', match: /^mostaza(\s+dijon)?$/ },
  { canon: 'Miel', match: /^miel$/ },
  { canon: 'Aceitunas negras', match: /^aceitunas\s+negras$/ },
  { canon: 'Aceitunas', match: /^aceitunas$/ },
  { canon: 'Alcaparras', match: /^alcaparras$/ },

  // Especias
  { canon: 'Pimentón', match: /^pimenton(\s+dulce|\s+picante|\s+de\s+la\s+vera)?$/ },
  { canon: 'Orégano', match: /^oregano$/ },
  { canon: 'Comino', match: /^comino(s)?(\s+molido)?$/ },
  { canon: 'Curry', match: /^curry(\s+en\s+polvo)?$/ },
  { canon: 'Tomillo', match: /^tomillo$/ },
  { canon: 'Eneldo', match: /^eneldo$/ },
  { canon: 'Nuez moscada', match: /^nuez\s+moscada$/ },
  { canon: 'Ajo en polvo', match: /^ajo\s+en\s+polvo$/ },

  // Caldos y otros
  { canon: 'Caldo de pescado', match: /^caldo\s+de\s+pescado$/ },
  { canon: 'Caldo de pollo', match: /^caldo\s+de\s+pollo$/ },
  { canon: 'Caldo de verduras', match: /^caldo\s+de\s+verduras$/ },
  { canon: 'Vino blanco', match: /^vino(\s+blanco)?$/ },
]

// Texto a descartar siempre (residuos del parseo o frases sueltas)
export const BLACKLIST = [
  /^al\s+gusto$/,
  /^opcional$/,
  /^para\s+servir$/,
  /^para\s+(la|el)\s+(salsa|aliño|aderezo)$/,
  /^(un|una|unos|unas)\s+(poco|poca|pocos|pocas|poquito|pizca|chorrito|chorro|punado|punadito|toque)s?$/,
  /^c\.?\s*s\.?$/,         // c/s o c.s.
  /^cucharad/,            // "cucharadas" suelto
  /^pizca/,
  /^chorrito/,
  /^a\s+tu\s+gusto$/,
  // Residuos típicos de adjetivos huérfanos
  /^(picad|laminad|rallad|trocead|cocid|fresc|madur|seco|salteado|asad|frito)[oa]s?$/,
  /^(entero|pequeno|grande|medio|mediano|fino|grueso)[s]?$/,
  /^duro[s]?$/,           // "huevos duros" → "huevos" + "duros"
  /^cruda$|^crudo[s]?$/,
  /^limpia(s)?$|^limpio(s)?$/,
  /^en\s+\w+$/,           // "en dados", "en tiras" como residuos
  // Líneas que no son ingredientes reales
  /^la\s+(musaka|ensalada|sopa|crema)/,
  /^el\s+/,
]

export function isBlacklisted(text) {
  const n = normalize(text)
  if (n.length < 2) return true
  return BLACKLIST.some((r) => r.test(n))
}

// Devuelve el nombre canónico si hay alias, o el texto original capitalizado
export function toCanonical(cleanedText) {
  const n = normalize(cleanedText)
  for (const a of CANONICAL_ALIASES) {
    if (a.match.test(n)) return a.canon
  }
  // Capitalizar
  return cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1)
}

/* ============================================================
   VISTA: COMPRA (listas de la compra)
   ============================================================ */

// Categorización por palabras clave
export const CATEGORIES = [
  { key: 'carne', label: 'Carne', icon: '🥩', keywords: ['pollo', 'pechuga', 'ternera', 'pavo', 'cerdo', 'conejo', 'jamón', 'jamon', 'lomo de cerdo', 'lomo cerdo', 'carne picada', 'carne de ternera', 'solomillo', 'contramuslo', 'muslitos', 'jamoncito', 'albóndiga', 'albondiga', 'hamburguesa', 'salchicha', 'chorizo', 'morcilla', 'bacon', 'panceta'] },
  { key: 'pescado', label: 'Pescado y marisco', icon: '🐟', keywords: ['salmón', 'salmon', 'merluza', 'bacalao', 'dorada', 'lubina', 'sepia', 'calamar', 'gambas', 'atún en lata', 'atun en lata', 'atún', 'atun', 'pulpo', 'rape', 'mejillones', 'almejas', 'langostinos', 'pescado', 'marisco', 'anchoa', 'sardina', 'boquerón', 'boqueron', 'caballa', 'berberechos'] },
  { key: 'verdura', label: 'Verdura', icon: '🥦', keywords: ['calabacín', 'calabacin', 'pimiento', 'tomate', 'ajo', 'lechuga', 'cebolla', 'cebolleta', 'zanahoria', 'pepino', 'espinaca', 'espárrago', 'esparrago', 'champiñón', 'champiñon', 'champinon', 'brócoli', 'brocoli', 'coliflor', 'judía', 'judia', 'alcachofa', 'perejil', 'albahaca', 'cilantro', 'canónigo', 'canonigo', 'rúcula', 'rucula', 'patata', 'boniato', 'apio', 'puerro', 'rábano', 'rabano', 'remolacha', 'aguacate', 'guisantes', 'lombarda', 'kale', 'endivia', 'achicoria', 'berro', 'col', 'acelga', 'pimentón fresco', 'guindilla', 'jengibre fresco'] },
  { key: 'fruta', label: 'Fruta', icon: '🍎', keywords: ['limón', 'limon', 'manzana', 'pera', 'naranja', 'lima', 'uva', 'mango', 'plátano', 'platano', 'fresa', 'melón', 'melon', 'sandía', 'sandia', 'piña', 'pina', 'kiwi', 'frambuesa', 'arándano', 'arandano', 'mandarina', 'cereza', 'melocotón', 'melocoton', 'albaricoque', 'higo', 'granada', 'pomelo', 'paraguayo'] },
  { key: 'lacteos', label: 'Lácteos y huevos', icon: '🥛', keywords: ['huevo', 'leche', 'queso', 'mozzarella', 'ricotta', 'yogur', 'mantequilla', 'nata', 'queso batido', 'parmesano', 'manchego', 'feta', 'requesón', 'requeson', 'cuajada', 'kefir', 'crème fraîche', 'creme fraiche'] },
  { key: 'pasta_arroz', label: 'Pasta, arroz y legumbres', icon: '🍝', keywords: ['arroz', 'pasta integral', 'pasta', 'quinoa', 'macarrones', 'espagueti', 'fideos', 'lentejas', 'garbanzos', 'alubias', 'frijoles', 'judías blancas', 'judias blancas', 'cous cous', 'couscous', 'mijo', 'bulgur', 'pasta de lentejas', 'pasta legumbre', 'pasta fresca'] },
  { key: 'conservas', label: 'Conservas', icon: '🥫', keywords: ['tomate triturado', 'tomate frito', 'pimientos asados', 'aceitunas', 'alcaparras', 'maíz', 'maiz', 'remolacha en conserva', 'sardinas en lata', 'caballa en lata', 'mejillones en lata', 'piña en almíbar', 'pina en almibar', 'piña en rodajas', 'pina en rodajas', 'bonito en lata'] },
  { key: 'panaderia', label: 'Panadería', icon: '🥖', keywords: ['pan', 'tortilla de trigo', 'tortilla trigo', 'tortilla de maíz', 'hojaldre', 'baguette', 'biscote', 'pita', 'wrap', 'masa quebrada', 'masa de pizza', 'masa filo', 'pan rallado', 'lasaña', 'cannelloni'] },
  { key: 'despensa', label: 'Despensa', icon: '🧂', keywords: ['aceite', 'vinagre', 'sal', 'pimienta', 'pimentón', 'pimenton', 'orégano', 'oregano', 'comino', 'curry', 'azúcar', 'azucar', 'salsa de soja', 'soja', 'miel', 'mostaza', 'caldo', 'eneldo', 'tomillo', 'romero', 'laurel', 'nuez moscada', 'almendras', 'castañas', 'castanas', 'frutos secos', 'harina', 'levadura', 'canela', 'vainilla', 'piñones', 'pinones', 'nueces', 'pasas', 'sésamo', 'sesamo', 'cúrcuma', 'curcuma', 'jengibre en polvo', 'ajo en polvo', 'sirope', 'ketchup', 'mayonesa', 'guacamole'] },
  { key: 'bebidas', label: 'Bebidas', icon: '🥤', keywords: ['vino blanco', 'vino tinto', 'vino', 'cerveza', 'agua', 'zumo', 'refresco', 'café', 'cafe', 'té', 'infusión', 'infusion', 'leche vegetal', 'horchata', 'kombucha'] },
  { key: 'higiene', label: 'Baño / Higiene', icon: '🧴', keywords: ['champú', 'champu', 'gel de baño', 'gel ducha', 'gel hidroalcohólico', 'jabón', 'jabon', 'pasta de dientes', 'pasta dientes', 'desodorante', 'colonia', 'crema corporal', 'crema facial', 'maquinilla', 'cuchillas afeitar', 'tampones', 'compresas', 'papel higiénico', 'papel higienico', 'pañuelos', 'hilo dental', 'enjuague bucal', 'protector solar', 'after sun'] },
  { key: 'lavanderia', label: 'Lavandería y limpieza', icon: '🧺', keywords: ['detergente', 'suavizante', 'lejía', 'lejia', 'quitamanchas', 'limpiacristales', 'fregasuelos', 'limpia hornos', 'lavavajillas', 'estropajo', 'bayeta', 'guantes de limpieza', 'multiusos'] },
  { key: 'hogar', label: 'Hogar', icon: '🧹', keywords: ['servilletas', 'papel de cocina', 'papel cocina', 'bolsas de basura', 'bolsas basura', 'film transparente', 'film', 'papel de aluminio', 'aluminio', 'pilas', 'bombillas', 'velas', 'cerillas', 'mecheros', 'palillos', 'papel de horno', 'papel horno'] },
]

/* Casos que hay que resolver antes de mirar palabras clave
   (p. ej. "caldo de pescado" es despensa, no pescadería) */
const CATEGORY_OVERRIDES = [
  [/^caldo\b|^fumet\b|^concentrado\b/i, 'despensa'],
  [/^vino\b|^brandy\b|^coñac\b|^conac\b|^jerez\b/i, 'despensa'],
  [/^tomate (triturado|frito|concentrado)|^tomate en conserva/i, 'conservas'],
  [/^leche de coco|^bebida de/i, 'despensa'],
  [/^pan rallado|^harina/i, 'despensa'],
  [/^aceitunas|^alcaparras|^pepinillos|^maíz|^maiz\b/i, 'conservas'],
  [/^atún|^atun|^sardinas|^caballa|^berberechos|^bonito/i, 'conservas'],
  [/^zumo /i, 'bebidas'],
]

export function categorize(name) {
  const lower = name.toLowerCase()
  for (const [re, cat] of CATEGORY_OVERRIDES) {
    if (re.test(lower)) return cat
  }
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((k) => lower.includes(k))) return cat.key
  }
  return 'otros'
}

/* ============================================================
   UNIDADES RECONOCIDAS AL PRINCIPIO DE UN INGREDIENTE

   El orden importa: las que comparten prefijo van de más larga a
   más corta, y detrás va un límite de palabra. Sin eso, la "l" de
   litro se comía el principio de otras palabras y "2 latas de
   anchoas" acababa como «Atas de anchoas · 2 l».
   ============================================================ */
const RE_CANTIDAD =
  /^([\d,.½¼¾\s]+(kilogramos?|kilos?|kg|gramos?|gr|g|mililitros?|ml|centilitros?|cl|litros?|cucharaditas?|cucharones?|cucharad[ao]s?|chorritos?|chorros?|pizcas?|pellizcos?|pu[ñn]ados?|gotas?|dientes?|filetes?|lonchas?|lomos?|láminas?|laminas?|latas?|l|hojitas?|hojas?|trozos?|tiras?|rodajas?|rebanadas?|botes?|bolsas?|bandejas?|barras?|briks?|pastillas?|paquetes?|sobres?|ramitas?|ramas?|manojos?|matas?|vasos?|tazas?|huevos?|piezas?|unidad(?:es)?|uds?)\b\.?(?:\s+(?:colmad|ras|generos|escas)[ao]s?)?\s*(?:de\s+)?)/i

/* Algunas recetas ponen la cantidad detrás: "Garbanzos 300 g",
   "Tomate 1 unidad". Se exige una unidad explícita al final para no
   confundirla con nombres que llevan números ("Arroz 3 delicias"). */
const RE_CANTIDAD_FINAL =
  /\s([\d,.½¼¾]+\s*(?:kilogramos?|kilos?|kg|gramos?|gr|g|mililitros?|ml|centilitros?|cl|litros?|l|cucharaditas?|cucharad[ao]s?|pizcas?|dientes?|filetes?|lonchas?|láminas?|laminas?|latas?|hojitas?|hojas?|trozos?|rodajas?|botes?|paquetes?|sobres?|ramas?|piezas?|unidad(?:es)?|uds?))\.?$/i

// Parsea un ingrediente bruto devolviendo { name, quantity } o null
export function parseIngredient(raw) {
  if (!raw || typeof raw !== 'string') return null
  let text = raw.trim()

  // Saltar las líneas de porciones de Juan/Magdalena
  if (/Juan:|Magdalena|niños:|niños y/i.test(text)) {
    const m = text.match(/de\s+([^\(→]+)/i)
    if (m) text = m[1].trim()
    else return null
  }

  // Viñetas y puntuación al principio: "- 2 dientes de ajo", "• Sal".
  // Se quita cualquier carácter que no sea letra ni número, sea cual
  // sea el guion o el símbolo que haya usado la receta.
  text = text.replace(/^[^\p{L}\p{N}]+/u, '').trim()

  // Rangos: "90 - 100 g de jamón" o "1-2 dientes de ajo". Para una
  // lista de la compra manda el extremo alto, que es lo que hay que
  // comprar para no quedarse corto.
  text = text.replace(/^([\d,.½¼¾]+)\s*[-–—]\s*([\d,.½¼¾]+)/, '$2').trim()

  // Quitar texto entre paréntesis
  text = text.replace(/\([^)]*\)/g, '').trim()
  text = text.replace(/\.+$/, '').trim()

  // Extraer la cantidad del principio
  let quantity = null
  const qtyMatch = text.match(RE_CANTIDAD)
  if (qtyMatch) {
    // Quita el "de" final y el calificativo:
    // "600 g de" → "600 g"; "1 cucharadita colmada de" → "1 cucharadita"
    quantity = qtyMatch[1]
      .replace(/\s+de\s*$/i, '')
      .replace(/\s+(?:colmad|ras|generos|escas)[ao]s?\s*$/i, '')
      .trim()
    text = text.slice(qtyMatch[0].length).trim()
  } else {
    // Cantidad simple: "1 limón", "2 zanahorias"
    const simpleMatch = text.match(/^([\d,.½¼¾]+)\s+/)
    if (simpleMatch) {
      quantity = simpleMatch[1].trim()
      text = text.slice(simpleMatch[0].length).trim()
    }
  }
  // Cantidad escrita detrás: "Garbanzos 300 g" → "Garbanzos" + "300 g"
  if (!quantity) {
    const finalMatch = text.match(RE_CANTIDAD_FINAL)
    if (finalMatch) {
      quantity = finalMatch[1].replace(/\s+/g, ' ').trim()
      text = text.slice(0, finalMatch.index).trim()
    }
  }

  // "de" colgante al principio del nombre: "de sepia limpia" → "sepia limpia"
  text = text.replace(/^de\s+/i, '').trim()

  // Quitar adjetivos/participios típicos
  const stripAdj = [
    'picad[oa]s?', 'laminad[oa]s?', 'rallad[oa]s?', 'trocead[oa]s?', 'cocid[oa]s?',
    'cortad[oa]s?', 'pelad[oa]s?', 'lavad[oa]s?', 'hervid[oa]s?', 'asad[oa]s?',
    'frit[oa]s?', 'congelad[oa]s?', 'escurrid[oa]s?', 'desmenuzad[oa]s?',
    'median[oa]s?', 'grandes?', 'pequeñ[oa]s?', 'peque[nñ]as?',
    'fresc[oa]s?', 'madur[oa]s?', 'sec[oa]s?', 'limpi[oa]s?',
    'en trozos', 'en dados', 'en tiras', 'en rodajas', 'en láminas', 'en laminas',
    'en cuartos', 'en juliana', 'en gajos', 'en bastones',
    'al natural', 'al gusto', 'en aceite', 'sin pepitas', 'sin piel',
    'sin hueso', 'sin sal', 'duros?', 'crud[oa]s?',
    'fin[oa]s?', 'gruesos?', 'enter[oa]s?', 'batid[oa]s?'
  ]
  for (const a of stripAdj) {
    text = text.replace(new RegExp(',?\\s*\\b' + a + '\\b', 'gi'), '')
  }

  text = text.replace(/\s+/g, ' ').trim()
  text = text.replace(/^[,.\s]+|[,.\s]+$/g, '').trim()

  if (text.length < 2) return null
  if (isBlacklisted(text)) return null

  const name = text.charAt(0).toUpperCase() + text.slice(1)
  return { name, quantity: quantity || null }
}

// Mantener cleanIngredient como wrapper para compatibilidad
export function cleanIngredient(raw) {
  const parsed = parseIngredient(raw)
  return parsed ? parsed.name : null
}

/* ============================================================
   CANTIDADES: parse + sumar
   ============================================================ */

// Normaliza fracciones unicode a decimales
export function fracToNumber(s) {
  return s.replace(/½/g, '.5').replace(/¼/g, '.25').replace(/¾/g, '.75')
}

// Normaliza unidades a su forma singular canónica
export const UNIT_NORMAL = {
  g: 'g', gr: 'g', gramo: 'g', gramos: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  ml: 'ml', mililitro: 'ml', mililitros: 'ml',
  cl: 'cl', centilitro: 'cl', centilitros: 'cl',
  l: 'l', litro: 'l', litros: 'l',
  loncha: 'loncha', lonchas: 'loncha',
  cucharada: 'cucharada', cucharadas: 'cucharada', cucharado: 'cucharada', cucharados: 'cucharada',
  cucharadita: 'cucharadita', cucharaditas: 'cucharadita',
  pizca: 'pizca', pizcas: 'pizca',
  pellizco: 'pellizco', pellizcos: 'pellizco',
  chorro: 'chorro', chorros: 'chorro',
  chorrito: 'chorrito', chorritos: 'chorrito',
  gota: 'gota', gotas: 'gota',
  pastilla: 'pastilla', pastillas: 'pastilla',
  ramita: 'ramita', ramitas: 'ramita',
  bolsa: 'bolsa', bolsas: 'bolsa',
  diente: 'diente', dientes: 'diente',
  filete: 'filete', filetes: 'filete',
  lomo: 'lomo', lomos: 'lomo',
  hoja: 'hoja', hojas: 'hoja', hojita: 'hojita', hojitas: 'hojita',
  trozo: 'trozo', trozos: 'trozo',
  lámina: 'lámina', láminas: 'lámina', lamina: 'lámina', laminas: 'lámina',
  rodaja: 'rodaja', rodajas: 'rodaja',
  bote: 'bote', botes: 'bote',
  lata: 'lata', latas: 'lata',
  paquete: 'paquete', paquetes: 'paquete',
  sobre: 'sobre', sobres: 'sobre',
  rama: 'rama', ramas: 'rama',
  huevo: 'huevo', huevos: 'huevo',
  pieza: 'pieza', piezas: 'pieza',
  unidad: 'ud', unidades: 'ud', ud: 'ud', uds: 'ud',
}

// Parsea "200 g", "4 filetes", "1,5 kg", "½ taza" → { value, unit, raw }
export function parseQuantity(qStr) {
  if (!qStr) return null
  let s = fracToNumber(String(qStr)).trim()
  // Soportar formato europeo "1,5"
  const m = s.match(/^([\d.,]+)\s*([a-záéíóúñ]+)?$/i)
  if (!m) return { value: null, unit: null, raw: qStr }
  const value = parseFloat(m[1].replace(',', '.'))
  if (isNaN(value)) return { value: null, unit: null, raw: qStr }
  const rawUnit = (m[2] || '').toLowerCase()
  const unit = UNIT_NORMAL[rawUnit] || rawUnit || null
  return { value, unit, rawUnit: m[2] || null, raw: qStr }
}

// Sube o baja la cantidad respetando la unidad original
export function bumpQuantity(qStr, dir) {
  const p = parseQuantity(qStr)
  if (!p || p.value == null) return qStr || ''
  let step = 1
  if (p.unit === 'g' || p.unit === 'ml') step = 50
  else if (p.unit === 'kg' || p.unit === 'l') step = 0.5
  const next = Math.max(0, p.value + dir * step)
  if (next === 0) return ''
  const u = p.rawUnit || ''
  return u ? `${formatNumber(next)} ${u}` : formatNumber(next)
}

/* Familias de unidades convertibles entre sí. Se suma siempre en la
   unidad base y se promociona a la grande a partir de 1000, vengan
   como vengan las dos cantidades: así "800 g + 500 g" da "1,3 kg" y
   no "1300 g", igual que ya hacía "800 g + 1 kg". */
const FAMILIAS_UNIDAD = [
  { base: 'g', grande: 'kg', factores: { g: 1, kg: 1000 } },
  { base: 'ml', grande: 'l', factores: { ml: 1, cl: 10, l: 1000 } },
]

function familiaDeUnidad(unit) {
  if (!unit) return null
  return FAMILIAS_UNIDAD.find((f) => f.factores[unit] != null) || null
}

/* Suma dos cantidades sueltas. Devuelve null si no son compatibles. */
function combinarSimple(a, b) {
  const pa = parseQuantity(a)
  const pb = parseQuantity(b)
  if (!pa || !pb || pa.value == null || pb.value == null) return null

  // Masa o volumen: convertibles entre sí
  const fa = familiaDeUnidad(pa.unit)
  if (fa && fa === familiaDeUnidad(pb.unit)) {
    const total = pa.value * fa.factores[pa.unit] + pb.value * fa.factores[pb.unit]
    return total >= 1000
      ? `${formatNumber(total / 1000)} ${fa.grande}`
      : `${formatNumber(total)} ${fa.base}`
  }

  // Unidades contables iguales: dientes, filetes, latas…
  // (conservando el plural original: "dientes", no "diente")
  if (pa.unit === pb.unit) {
    const total = pa.value + pb.value
    const unit =
      total > 1
        ? (pb.value > 1 ? pb.rawUnit : null) ||
          (pa.value > 1 ? pa.rawUnit : null) ||
          pa.rawUnit ||
          pa.unit
        : pa.rawUnit || pa.unit
    return unit ? `${formatNumber(total)} ${unit}` : formatNumber(total)
  }

  return null
}

const SEPARADOR_CADENA = ' + '

/* Combina dos cantidades.

   Cuando no son compatibles se encadenan con " + ", pero al añadir
   una tercera se busca primero un sumando compatible dentro de la
   cadena. Así el aceite que sale de cuatro recetas queda en
   "4 cucharadas + 180 g" y no en una ristra de cinco trozos. */
export function combineQuantities(a, b) {
  if (!a) return b ?? null
  if (!b) return a

  const partes = String(a).split(SEPARADOR_CADENA)
  for (let i = 0; i < partes.length; i++) {
    const fusion = combinarSimple(partes[i], b)
    if (fusion) {
      partes[i] = fusion
      return partes.join(SEPARADOR_CADENA)
    }
  }

  return `${a}${SEPARADOR_CADENA}${b}`
}

export function formatNumber(n) {
  if (Number.isInteger(n)) return String(n)
  return Number(n.toFixed(2)).toString().replace('.', ',')
}

/* ============================================================
   TROCEADO DE UNA LÍNEA DE INGREDIENTES

   Una línea puede traer varios ingredientes ("sal y pimienta",
   "cebolla, ajo"). Antes de partir hay que blindar los decimales
   escritos a la europea: partir "1,5 kg de patatas" por la coma
   convertía la cantidad en "5 kg".
   ============================================================ */

const MARCA_DECIMAL = '\u0000'

export function splitIngredientLine(raw) {
  return String(raw)
    // 1,5 → 1<marca>5, para que la coma decimal sobreviva al troceado
    .replace(/(\d)\s*,\s*(\d)/g, `$1${MARCA_DECIMAL}$2`)
    .split(/,| y /i)
    .map((s) => s.replace(new RegExp(MARCA_DECIMAL, 'g'), ','))
    .map((s) => s.trim())
    .filter(Boolean)
}

/* ============================================================
   EXTRACCIÓN DE INGREDIENTES DE UN MENÚ SEMANAL

   Deduplica por nombre canónico, suma cantidades y anota, para
   cada producto, en qué recetas y qué días hace falta. Cada
   referencia guarda además su propia cantidad y la semana de la
   que salió, que es lo que permite reimportar sin duplicar.
   ============================================================ */
export function extractItemsFromMenu(menu, wid) {
  if (!menu || !menu.days) return []
  const seen = new Map()
  const weekKey =
    wid ||
    menu.id ||
    (menu.year && menu.week ? `${menu.year}-${String(menu.week).padStart(2, '0')}` : null)

  menu.days.forEach((d, dayIndex) => {
    let isoDate = null
    if (weekKey) {
      try {
        isoDate = dateForDay(weekKey, dayIndex).toISOString().slice(0, 10)
      } catch (e) {
        isoDate = null
      }
    }

    for (const type of ['lunch', 'dinner']) {
      const meal = d[type]
      if (!meal || !meal.recipe) continue
      const ings = meal.recipe.ingredients
      if (!ings) continue
      const arr = Array.isArray(ings) ? ings : String(ings).split('\n')

      const refBase = {
        recipeName: meal.name || null,
        day: d.day || DAYS_ES[dayIndex] || null,
        dayIndex,
        weekId: weekKey,
        isoDate,
        dateLabel: isoDate ? formatDayMonth(new Date(isoDate + 'T00:00:00Z')) : d.date || null,
        mealType: type,
      }

      for (const linea of arr) {
        for (const trozo of splitIngredientLine(linea)) {
          const parsed = parseIngredient(trozo)
          if (!parsed) continue
          const canonical = toCanonical(parsed.name)
          const key = normalize(canonical)
          if (key.length < 2) continue
          if (isBlacklisted(canonical)) continue

          const existing = seen.get(key)
          if (!existing) {
            seen.set(key, {
              id: 'auto_' + key.replace(/\s+/g, '_'),
              name: canonical,
              quantity: parsed.quantity,
              category: categorize(canonical),
              checked: false,
              recipes: refBase.recipeName ? [{ ...refBase, qty: parsed.quantity }] : [],
            })
            continue
          }

          existing.quantity = combineQuantities(existing.quantity, parsed.quantity)
          if (!refBase.recipeName) continue
          // El mismo ingrediente puede repetirse dentro de una receta:
          // no se duplica la referencia, se acumula en la que ya hay.
          const yaEsta = existing.recipes.find((r) => refKeyLoose(r) === refKeyLoose(refBase))
          if (yaEsta) yaEsta.qty = combineQuantities(yaEsta.qty, parsed.quantity)
          else existing.recipes.push({ ...refBase, qty: parsed.quantity })
        }
      }
    }
  })

  const items = Array.from(seen.values())
  for (const it of items) {
    it.recipes.sort((a, b) => (a.dayIndex ?? 9) - (b.dayIndex ?? 9))
  }
  return items
}

/* ============================================================
   FUSIÓN CON UNA LISTA EXISTENTE

   Reimportar la misma semana no debe duplicar nada. Cada
   referencia se identifica por semana + día + comida + receta;
   si ya está, ni se añade ni se vuelve a sumar su cantidad.
   ============================================================ */

/* Clave laxa (sin la semana) para reconocer también las
   referencias guardadas antes de que existiera `weekId`. */
function refKeyLoose(ref) {
  return [ref.dayIndex ?? '', ref.mealType || '', normalize(ref.recipeName || '')].join('|')
}

export function refKey(ref) {
  return [ref.weekId || '', refKeyLoose(ref)].join('|')
}

/* ¿Esta referencia ya estaba en el producto?

   Si ambas saben de qué semana vienen se comparan enteras: el mismo
   plato, el mismo día y la misma comida en DOS semanas distintas son
   dos necesidades reales y deben sumarse. La comparación laxa queda
   solo para las referencias guardadas antes de que existiera
   `weekId`, que si no se duplicarían en la primera reimportación. */
function yaEstaLaReferencia(existentes, nueva) {
  return existentes.some((r) =>
    r.weekId && nueva.weekId
      ? refKey(r) === refKey(nueva)
      : refKeyLoose(r) === refKeyLoose(nueva)
  )
}

export function mergeShoppingItems(existing, incoming) {
  const salida = (existing || []).map((it) => ({
    ...it,
    recipes: [...(it.recipes || [])],
  }))
  const porNombre = new Map(salida.map((it) => [normalize(it.name), it]))

  for (const nuevo of incoming || []) {
    const clave = normalize(nuevo.name)
    const encontrado = porNombre.get(clave)

    if (!encontrado) {
      const copia = { ...nuevo, recipes: [...(nuevo.recipes || [])] }
      salida.push(copia)
      porNombre.set(clave, copia)
      continue
    }

    const nuevas = (nuevo.recipes || []).filter(
      (r) => !yaEstaLaReferencia(encontrado.recipes, r)
    )
    // Ya estaba importado por completo: no se toca la cantidad.
    if (!nuevas.length) continue

    encontrado.recipes.push(...nuevas)
    let aporte = null
    for (const r of nuevas) aporte = combineQuantities(aporte, r.qty)
    if (aporte) encontrado.quantity = combineQuantities(encontrado.quantity, aporte)
    encontrado.recipes.sort((a, b) => (a.dayIndex ?? 9) - (b.dayIndex ?? 9))
  }

  return salida
}

/* Primer día (índice 0-6) en que hace falta un producto, o null */
export function firstNeededIndex(item) {
  const dias = (item.recipes || [])
    .map((r) => r.dayIndex)
    .filter((i) => typeof i === 'number')
  if (!dias.length) return null
  return Math.min(...dias)
}

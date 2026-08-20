/* ============================================================
   REPERTORIO INICIAL
   Todos los platos del recetario, listos para usar en la
   planificación semanal. Los que tienen receta documentada la
   incluyen; el resto se completa solo al sincronizar con los
   menús ya guardados (o a mano desde la ficha del plato).
   ============================================================ */

/* [nombre, tipo, categoría, valoración, receta?] */
const COMIDAS = [
  ['Ensalada de lentejas', 'legumbres', 2, {
    method: 'Sin cocción',
    source: 'Receta propia',
    ingredients: [
      '2 botes de lentejas cocidas',
      '2 latas de anchoas',
      '2 botes de alcachofas',
      'Tomatitos cherry',
      'Queso tierno',
    ],
    steps: [
      '🔧 Método: sin cocción, solo montaje.',
      'Escurre y enjuaga las lentejas.',
      'Trocea las alcachofas, los tomatitos y el queso.',
      'Mezcla todo en un bol con las anchoas. Sin atún, sin huevo, sin pimiento.',
    ],
  }],
  ['Salmón con guisantes', 'pescado', 0],
  ['Ensalada de arroz y pera con pollo', 'ensalada', 0],
  ['Calabacines rellenos', 'verduras', 0],
  ['Muslitos de pollo', 'carne', 0],
  ['Dorada con puerro y zanahorias', 'pescado', 0],
  ['Arroz tres delicias', 'arroz', 0],
  ['Ensalada de quinoa con atún y uva', 'ensalada', 0],
  ['Hojaldre de pavo y pisto', 'carne', 0],
  ['Ensalada de pasta y lentejas', 'ensalada', 0],
  ['Pisto con lubina', 'pescado', 0],
  ['Dorada con ensaladilla', 'pescado', 0],
  ['Lasaña boloñesa con champiñones', 'pasta', 0],
  ['Arroz negro con calamares TM6', 'arroz', 0],
  ['Pollo a la pizzaiola con pasta fresca', 'carne', 0],
  ['Guiso de sepia', 'pescado', 0],
  ['Jamoncitos de pollo al vino', 'carne', 0],
  ['Merluza en salsa verde con almejas TM6', 'pescado', 0],
  ['Pollo al curry con arroz basmati TM6', 'carne', 0],
  ['Bowl mediterráneo', 'ensalada', 0],
  ['Pollo al horno con boniato y castañas', 'carne', 0],
  ['Pavo con pisto de verduras', 'carne', 0],
  ['Musaka de calabacín', 'verduras', 0, {
    method: 'Thermomix TM6 + horno',
    source: 'Cookidoo — "Moussaka griega", adaptada con calabacín',
    ingredients: [],
    steps: [
      '🔧 Método: TM6 para la bechamel y el sofrito, gratinado final al horno.',
      'Adaptación de la moussaka griega de Cookidoo sustituyendo la berenjena por calabacín.',
      'Bechamel hecha en el vaso de la TM6.',
    ],
  }],
  ['Hamburguesa con queso', 'carne', 0],
  ['Arroz con tomate y huevo', 'arroz', 0],
  ['Pollo con almendras', 'carne', 0],
  ['Espaguetis con verduras y gambas', 'pasta', 0],
  ['Dorada a la mallorquina', 'pescado', 0],
  ['Ensalada de guisantes y atún', 'ensalada', 0],
  ['Tortilla de patata, calabacín y ricotta', 'huevos', 0],
  ['Fajitas con ricotta y canónigos', 'carne', 0],
  ['Macarrones boloñesa', 'pasta', 0],
  ['Dorada al horno', 'pescado', 0],
  ['Hojaldre de carne picada', 'carne', 0],
  ['Pastel de verduras, huevo y queso', 'huevos', 0],
  ['Ensalada de garbanzos', 'legumbres', 0],
  ['Lasaña', 'pasta', 0],
  ['Pasta con salmón y gambas', 'pasta', 0],
  ['Lubina en papillote', 'pescado', 0],
  ['Crema de espinacas', 'crema', 0],
  ['Pasta de lentejas con calabacín', 'pasta', 0, {
    method: 'Vitro',
    source: 'Receta propia',
    ingredients: [
      '165 g de pasta de lentejas',
      '480 g de calabacín',
      '300 g de tomate',
      '2 dientes de ajo',
      '50 g de parmesano',
      '4 cucharadas de aceite de oliva',
      'Orégano',
    ],
    steps: [
      '🔧 Método: vitro, sartén amplia + olla para la pasta.',
      'Sofríe el ajo, añade el calabacín y después el tomate.',
      'Cuece la pasta de lentejas y mézclala con el sofrito.',
      'Termina con parmesano y orégano.',
    ],
  }],
  ['Rape al horno con verduras', 'pescado', 0],
  ['Albóndigas de ternera TM6', 'carne', 0],
  ['Pimientos rellenos de carne', 'carne', 0],
  ['Bacalao al horno con pisto', 'pescado', 0],
  ['Ensalada templada de quinoa y salmón', 'ensalada', 0],
  ['Contramuslos de pollo al horno mediterráneo', 'carne', 0],
  ['Sepia con patatas y guisantes TM6', 'pescado', 0],
  ['Solomillo de cerdo con manzana al horno', 'carne', 0],
  ['Dorada en papillote con limón', 'pescado', 0],
  ['Pasta integral con pollo y espinacas', 'pasta', 0],
  ['Ensalada de pulpo a la plancha', 'ensalada', 0],
  ['Arroz meloso de gambas TM6', 'arroz', 2, {
    method: 'Thermomix TM6',
    source: 'Cookidoo',
    ingredients: [
      'Arroz 320 g',
      'Fumet de pescado 1000 g',
      'Gambas',
    ],
    steps: [
      '🔧 Método: Thermomix TM6.',
      'Cantidades ajustadas para 4 personas.',
      'Receta completa en Cookidoo.',
    ],
  }],
  ['Merluza al horno con pimientos caramelizados TM6', 'pescado', 0, {
    method: 'Thermomix TM6 + horno',
    source: 'Cookidoo',
    ingredients: [
      'Lomo de merluza 800 g',
      'Pimiento rojo 400 g',
      'Cebolla 300 g',
      'Aceitunas negras 100 g',
      'Aceite de oliva 45 g',
      'Vinagre balsámico 20 g',
      'Azúcar ½ cucharadita',
    ],
    steps: [
      '🔧 Método: Thermomix TM6 para los pimientos caramelizados, acabado al horno.',
      'Receta para 4 raciones.',
      'Receta completa en Cookidoo.',
    ],
  }],
  ['Espaguetis integrales con pollo y verduras', 'pasta', 0],
  ['Sepia en salsa con verduras y arroz', 'pescado', 0],
  ['Dorada al vapor con verduras agridulces', 'pescado', 0, {
    method: 'Thermomix TM6 (Varoma)',
    source: 'Cookidoo r280709',
    ingredients: [],
    steps: [
      '🔧 Método: Thermomix TM6, cocción al Varoma.',
      'Receta completa en Cookidoo (referencia r280709).',
    ],
  }],
  ['Lomos de pescado con guisantes, jamón y pimentón', 'pescado', 0],
  ['Ensalada de arroz integral con vinagreta de frutos secos', 'ensalada', 0, {
    method: 'Thermomix TM6',
    source: 'Cookidoo, adaptada con pollo salteado en lugar de jamón curado',
    ingredients: [],
    steps: [
      '🔧 Método: Thermomix TM6.',
      'Adaptación: pollo salteado en lugar de jamón curado.',
    ],
  }],
  ['Hamburguesas de garbanzos al horno', 'legumbres', 0, {
    method: 'Horno',
    source: '@laraprohens_nutricio',
    ingredients: [],
    steps: [
      '🔧 Método: horno.',
      'Preparar siempre en dos versiones: original (con cebolla) y adaptada (sin cebolla, sustituida por ajo y perejil).',
      'Servir con ensalada mixta y vinagreta de yogur.',
      'Apta para tupper.',
    ],
  }],
  ['Pastel de bacalao con tomate y huevo', 'pescado', 2],
  ['Bacalao en papillote con verduras', 'pescado', 0],
  ['Bacalao con espinacas al horno gratinado', 'pescado', 0],
  ['Brandada de bacalao con verduras asadas', 'pescado', 0],
  ['Bacalao a la vizcaína', 'pescado', 0],
]

const CENAS = [
  ['Revuelto de verduras y huevo', 'huevos', 0],
  ['Ensalada caprese', 'ensalada', 0],
  ['Contramuslos de pollo torrados', 'carne', 0],
  ['Salteado de verduras', 'verduras', 0],
  ['Salmón con salsa de soja', 'pescado', 0],
  ['Arroz hervido', 'arroz', 0],
  ['Ensalada mixta', 'ensalada', 0],
  ['Tortilla de huevo', 'huevos', 0],
  ['Moluscos al vapor', 'pescado', 0],
  ['Crema de verduras', 'crema', 0],
  ['Fajitas de pollo sin tortilla', 'carne', 0],
  ['Crema de espárragos', 'crema', 0],
  ['Ensalada caliente', 'ensalada', 0],
  ['Conejo a la huertana TM6', 'carne', 0],
  ['Huevo al horno con espirales de verduras', 'huevos', 0],
  ['Carpaccio de calabacín', 'verduras', 0],
  ['Salmón con ensalada de tomate y alcaparras', 'pescado', 0],
  ['Pimientos de padrón', 'verduras', 0],
  ['Wrap de tomate y huevo hervido', 'huevos', 0],
  ['Tiras de ternera salteada', 'carne', 0],
  ['Ensalada de pollo', 'ensalada', 0],
  ['Bol de arroz shawarma', 'arroz', 0],
  ['Pan torrado con trampó y salmón', 'pescado', 0],
  ['Bacalao a la plancha con pisto', 'pescado', 0],
  ['Sepia a la plancha con verduras', 'pescado', 0],
  ['Huevos al plato con tomate y pimientos', 'huevos', 0],
  ['Merluza a la plancha con verduras salteadas', 'pescado', 0],
  ['Solomillo de pavo a la plancha con pimientos', 'carne', 0],
  ['Ensalada de pollo, mango y aguacate', 'ensalada', 2],
  ['Tortilla de espinacas y queso con ensalada', 'huevos', 0],
  ['Tacos de pollo con verduras y guacamole sin tortilla', 'carne', 0],
  ['Pollo con piña al curry en papillote TM6', 'carne', 0, {
    method: 'Thermomix TM6 (Varoma)',
    source: 'Cookidoo',
    ingredients: [
      'Contramuslo de pollo 1000 g',
      'Caramelo líquido',
      'Curry',
      'Mantequilla',
      'Piña fresca',
    ],
    steps: [
      '🔧 Método: Thermomix TM6, cocción al Varoma en papillote.',
      'Vale igual como comida o como cena.',
      'Receta completa en Cookidoo.',
    ],
  }],
]

function slug(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 52)
}

function build(rows, type) {
  return rows.map(([name, category, rating, recipe]) => ({
    id: 'r-' + slug(name),
    name,
    type,
    category,
    rating: rating || 0,
    calories: null,
    proteins: null,
    recipe: recipe
      ? {
          method: recipe.method || null,
          ingredients: recipe.ingredients && recipe.ingredients.length ? recipe.ingredients : null,
          steps: recipe.steps || null,
        }
      : null,
    source: recipe?.source || null,
    seeded: true,
  }))
}

export const SEED_RECIPES = [...build(COMIDAS, 'comida'), ...build(CENAS, 'cena')]

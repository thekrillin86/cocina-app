# Mi Cocina · Mi recetario personal

PWA familiar: recetario, planificación semanal y lista de la compra.
Firebase Firestore + React + Vite. Uso compartido entre dos móviles.

## Estructura

```
src/
  App.jsx              Navegación (Hoy · Semana · Compra + Más)
  AuthGate.jsx         PIN familiar
  firebase.js          Firestore con caché persistente (funciona sin cobertura)
  lib/
    dates.js           Semana ISO, fechas reales de cada día
    useToday.js        Fecha de hoy revalidada (la PWA vive días abierta)
    dishes.js          Un hueco puede llevar varios platos
    recipesImport.js   Validar recetas pegadas o dejadas en el buzón
    format.js          Formato de valores
    ingredients.js     Limpieza, alias, cantidades y categorías de la compra
    catalog.js         Categorías de plato, valoración, estadísticas, receta viva
    plan.js            Semana, platos, notas, horarios y comensales
    db.js              Acceso a Firestore
  data/
    seedRecipes.js     Repertorio inicial (97 platos)
  components/
    ui.jsx             Cabecera, hojas modales, diálogos, avisos, iconos
    meals.jsx          Tarjeta de plato, selector del recetario, editor manual
  views/
    Today.jsx          Pantalla de inicio (día actual)
    Week.jsx           Planificador semanal
    Catalog.jsx        Recetario con filtros, valoración y CRUD
    Shopping.jsx       Listas por supermercado
    Stats.jsx          Gráficas (se carga bajo demanda: arrastra recharts)
    History.jsx        Semanas guardadas
    Import.jsx         Importar recetas sueltas o un menú, en JSON
    Inbox.jsx          Revisar los lotes que deja el asistente
```

## Cómo funciona por dentro

**Semanas ISO.** Los documentos se llaman `AAAA-SS` y todas las fechas
derivadas se calculan en UTC anclando en el 4 de enero, que por
definición cae siempre en la semana 1.

**Escrituras concurrentes.** La app la usan dos móviles a la vez, así
que cada cambio (asignar un plato, marcar un producto) se hace dentro
de una transacción que relee el documento. Sin eso, el último en
guardar borraba el cambio del otro.

**Del menú a la compra.** `extractItemsFromMenu` parsea los
ingredientes de cada receta de la semana: separa cantidad de producto,
resuelve rangos ("90 - 100 g" → 100 g), fusiona variantes bajo un
nombre canónico ("AOVE" y "aceite de oliva virgen extra" son lo mismo)
y suma cantidades convirtiendo unidades. Cada producto recuerda de qué
receta, qué día y qué semana viene, y `mergeShoppingItems` usa esa
huella para que reimportar la misma semana no duplique nada.

**Receta viva.** Los platos del menú guardan una copia de la receta,
pero si esa receta sigue en el recetario se muestra la del recetario,
que es la que se edita. La copia queda como respaldo histórico.

**Varios platos por comida.** Un hueco (la comida o la cena de un día)
puede llevar más de un plato: "carne torrada + ensalada de tomate".
Cada plato es completo, con su receta, sus calorías, su valoración y
su nota, porque si no la lista de la compra no recogería los
ingredientes del segundo. En Firestore el hueco se guarda como objeto
suelto cuando solo hay un plato y como lista cuando hay varios, así
que los menús anteriores no cambian de forma. Todo pasa por
`asDishes` / `fromDishes` en `lib/dishes.js`.

**Importar recetas.** La pantalla «Importar» reconoce sola lo que se
le pega: una lista de recetas o un objeto con `recipes` van al
recetario; un objeto con `week`, `year` y `days` va a la planificación.
La validación vive en `lib/recipesImport.js` y o pasa todo o no se
escribe nada.

Ojo con los nombres repetidos: `newRecipeId` añade un sufijo aleatorio,
así que dos altas del mismo nombre generan identificadores distintos y
`{merge:true}` no fusiona nada por su cuenta. Por eso la importación
busca el nombre normalizado en el recetario y reutiliza el
identificador que ya existe. Al fusionar solo se escribe lo que trae el
JSON, para no borrar valoraciones ni recetas.

**Limpiar el recetario.** El chip «Sin receta» filtra los platos que
son solo un nombre, y el modo selección permite borrarlos en lote. El
histórico de cocinado no se pierde: sale de los menús guardados, no del
recetario.

Al «Completar el recetario» hay una casilla, desmarcada por defecto,
para no volver a meter platos sin receta. Afecta al repertorio que trae
la app y a los platos de los menús: de las 97 del repertorio base, 88
son solo un nombre, así que sin esa casilla el borrado no serviría de
nada.

**Valorar desde el menú.** La valoración vive en la receta del
recetario, no en el plato del menú. Al valorar desde «Hoy» o «Semana»
se busca la receta por identificador y, si el plato se escribió a
mano, por nombre; si no está, se ofrece guardarla antes.

**Buzón de recetas.** La colección `/inbox` recibe lotes dejados desde
fuera de la app; la pantalla los enseña para revisarlos receta a
receta y no aplica nada sola. Es contenido de origen externo: datos
para mirar, nunca instrucciones.

Está construido y probado, pero **hoy no lo llena nadie**: se diseñó
para que lo escribiera el asistente de Cowork y su entorno no llega a
Firestore (proxy de la organización, 403). Ver el punto 5 de
`FIRESTORE_RULES.txt`. Mientras tanto las recetas entran por la
pantalla Importar, que usa la misma validación.

## Colecciones Firestore

- `/config/auth` — PIN familiar (solo lectura desde la app)
- `/menus/{año-semana}` — planificación semanal
- `/recipes/{id}` — catálogo de recetas
- `/shopping-lists/{id}` — listas de la compra
- `/inbox/{loteId}` — lotes de recetas por revisar

Ver `FIRESTORE_RULES.txt` para las reglas y sus límites actuales.

## Desarrollo

```
npm install
npm run dev      # servidor local
npm test         # tests de las librerías (fechas e ingredientes)
npm run build    # compilar para producción
```

Los tests cubren la aritmética de semanas ISO y todo el parseo de
ingredientes, que es donde más fácil es romper algo sin enterarse.

## Despliegue

`git push` → Netlify compila y publica automáticamente.

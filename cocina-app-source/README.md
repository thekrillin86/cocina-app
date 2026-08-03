# Mi Cocina · Mi recetario personal

PWA familiar: recetario, planificación semanal y lista de la compra.
Firebase Firestore + React + Vite. Uso compartido entre dos móviles.

## Estructura

```
src/
  App.jsx              Navegación (Hoy · Semana · Compra + Más)
  AuthGate.jsx         PIN familiar
  firebase.js          Configuración Firestore
  lib/
    dates.js           Semana ISO, fechas reales de cada día
    format.js          Formato de valores
    ingredients.js     Limpieza, alias, cantidades y categorías de la compra
    catalog.js         Categorías de plato, valoración, estadísticas de uso
    plan.js            Crear semana, asignar platos, notas y horarios
    db.js              Acceso a Firestore
  data/
    seedRecipes.js     Repertorio inicial (97 platos)
  components/
    ui.jsx             Cabecera, hojas modales, chips, iconos
    meals.jsx          Tarjeta de plato, selector del recetario, editor manual
  views/
    Today.jsx          Pantalla de inicio (día actual)
    Week.jsx           Planificador semanal
    Catalog.jsx        Recetario con filtros, valoración y CRUD
    Shopping.jsx       Listas por supermercado
    Extras.jsx         Estadísticas, histórico e importar JSON
```

## Colecciones Firestore

- `/config/auth` — PIN familiar (solo lectura desde la app)
- `/menus/{año-semana}` — planificación semanal
- `/recipes/{id}` — catálogo de recetas
- `/shopping-lists/{id}` — listas de la compra

## Despliegue

`git push` → Netlify compila y publica automáticamente.

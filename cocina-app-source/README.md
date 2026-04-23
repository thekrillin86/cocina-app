# Cocina Juan & Magdalena — App v2.1

App PWA familiar con sincronización en tiempo real vía Firebase Firestore y autenticación con PIN familiar.

## Archivos importantes de este paquete

- `FIRESTORE_RULES.txt` — reglas de seguridad a pegar en la consola de Firebase
- `menu_semana18_con_calorias.json` — menú listo para importar desde la app
- `dist/` — build de producción (subir esta carpeta a Netlify)
- `src/` — código fuente React

## Cómo funciona la seguridad

- El PIN se guarda en Firestore en `/config/auth` con reglas de acceso **bloqueadas** desde el cliente
- Las reglas de Firestore leen ese PIN en el servidor (con `get()`) para validar nuevos dispositivos
- Cada dispositivo que acierta el PIN se añade a `/allowed-users/{uid}` con su UID anónimo
- Sesión persistente: la app pide el PIN **una sola vez por dispositivo**

## Scripts

```bash
npm install       # primera vez
npm run dev       # dev local (http://localhost:5173)
npm run build     # genera dist/
npm run preview   # sirve dist/
```

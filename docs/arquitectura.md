# Arquitectura

Aplicación estática React + TypeScript + Vite, preparada para una ruta de proyecto de GitHub Pages mediante `base: "./"` y `HashRouter`.

## Capas

- `src/app`: composición, rutas y pantallas.
- `src/features`: servicios de unidades, activos y copias.
- `src/db`: esquema Dexie e IndexedDB.
- `src/schemas`: contratos Zod y tipos de dominio.
- `src/data/curriculum`: conjunto curricular versionado.
- `src/styles`: interfaz y reglas de impresión A4.

IndexedDB es la fuente de verdad. React observa las tablas mediante `useLiveQuery`; cada edición escribe inmediatamente y actualiza `updatedAt`. No hay servidor permanente, secretos ni llamadas remotas.

Los doce apartados se materializan como contenido generado. Cada mutación relevante refresca únicamente los apartados que siguen en modo automático. Los apartados editados manualmente o bloqueados se conservan.

## Evolución

El identificador `projectId` deja preparado el nivel Programación. Una versión futura puede añadir sincronización con Supabase manteniendo UUID, marcas temporales y versiones de esquema.

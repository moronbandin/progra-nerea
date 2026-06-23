# Modelo de datos

La jerarquía principal es `Project → Unit → UnitSection / Session → Activity`. Los activos pertenecen a una unidad y se almacenan como Blob.

Colecciones Dexie:

- `projects`
- `units`
- `unitSections`
- `sessions`
- `activities`
- `assets`
- `curriculumRelations`
- `assessmentInstruments`
- `versions`
- `settings`

Todas las entidades usan UUID, `createdAt`, `updatedAt` y `schemaVersion`.

Los apartados guardan `generated`, `sourceTemplate`, `manuallyEdited` y `locked`. Las selecciones curriculares guardan identificadores; los textos legales no se duplican en cada unidad.

`generated=true` y `manuallyEdited=false` activa la sincronización automática. Una edición manual suspende la sobrescritura hasta que la usuaria devuelve el apartado a modo automático.

Los paquetes `.udpack` incluyen `manifest.json`, `unit.json`, `assets/` y `preview.png`. La importación valida versión y crea una copia con UUID nuevos.

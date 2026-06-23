# Cuaderno de unidades · Lengua Castellana y Literatura 4.º ESO

PMV local-first para crear unidades didácticas basadas en los tres modelos DOCX de Nerea Bouzas y en el currículo gallego de Lengua Castellana y Literatura de 4.º ESO (Decreto 156/2022).

## Ejecutar

```bash
npm install
npm run dev
```

Compilación de producción:

```bash
npm run build
npm run preview
```

## Funciones

- proyecto y unidades persistentes en IndexedDB mediante Dexie;
- doce apartados fijos con editor Tiptap y sincronización automática desde la configuración y el currículo;
- selección de objetivos, criterios y contenidos curriculares;
- relaciones normativas automáticas con objetivos de materia y descriptores;
- una sesión inicial, sesiones añadidas progresivamente, reordenación y actividades renumeradas por posición;
- matriz de evaluación, advertencias y banco DUA;
- imágenes comprimidas como Blob;
- previsualización A4 con tablas curriculares, paginado Paged.js e impresión como PDF;
- exportación/importación `.udpack` y copia `.udproject`;
- unidad de demostración basada en la UD 1.

## Currículo

Los JSON versionados están en `src/data/curriculum` y se publican también en `public/curriculum`. Pueden regenerarse desde el PDF fuente con:

```bash
python3 scripts/extract_curriculum.py
```

Las relaciones criterio–objetivo y objetivo–descriptor son normativas. El decreto agrupa los contenidos por bloque y no ofrece una relación individual criterio–contenido; por eso esa selección es manual.

## GitHub Pages

1. Crear un repositorio y subir la rama `main`.
2. En Settings → Pages, elegir **GitHub Actions**.
3. El workflow `.github/workflows/deploy.yml` instala, compila y publica `dist`.

Vite usa `base: "./"` y la navegación usa `HashRouter`, por lo que funciona bajo rutas de proyecto y al recargar.

## PDF y copias editables

El PDF es el documento de lectura: se obtiene en la pestaña «Vista previa y PDF» mediante **Guardar como PDF**.

Un archivo `.udpack` no es un PDF ni un Word. Es una copia editable comprimida de una unidad, con sus datos e imágenes. Para abrirla se utiliza **Restaurar copia** en la pantalla inicial de esta misma aplicación.

## Datos y copias

Los datos quedan en el navegador y dispositivo actuales. No se sincronizan entre equipos. Se recomienda descargar copias `.udpack` y `.udproject`. Borrar los datos del sitio elimina IndexedDB. Una segunda fase puede añadir Supabase.

## Documentación

- [Análisis de modelos](docs/analisis-modelos.md)
- [Arquitectura](docs/arquitectura.md)
- [Modelo de datos](docs/modelo-datos.md)
- [Exportación PDF](docs/exportacion-pdf.md)
- [Uso](docs/uso.md)

## Limitaciones del PMV

- La impresión usa el motor nativo; Chrome/Chromium es el navegador recomendado.
- El preflight geométrico avanzado y QR renderizado quedan para una segunda fase.
- No hay autenticación, sincronización remota ni colaboración multiusuario.

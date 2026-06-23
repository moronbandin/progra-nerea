# Uso y persistencia

Los datos quedan en IndexedDB dentro del navegador. Persisten al recargar y al volver otro día desde el mismo navegador, perfil y dispositivo.

No existe sincronización automática entre equipos. Borrar los datos del sitio o usar otro navegador puede dejar las unidades inaccesibles. Por ello:

- descargar periódicamente `.udpack` de cada unidad;
- descargar `programacion.udproject` como copia global;
- guardar las copias fuera del navegador.

Una futura versión podrá incorporar Supabase u otro backend con autenticación y sincronización.

La unidad demo se basa en la UD 1 y sirve para probar selección curricular, seis sesiones y actividades iniciales.

## Diferencia entre PDF y UDpack

- **PDF:** documento final visible e imprimible. Se genera desde «Vista previa y PDF».
- **UDpack:** copia editable de seguridad. Solo se abre restaurándola desde la propia aplicación.

Los apartados que conservan el estado «automático» se refrescan cuando cambian los datos generales, el currículo, las sesiones, las actividades o las medidas DUA. Cuando Nerea modifica manualmente un apartado, queda protegido frente a esa actualización hasta pulsar «Volver a automático».

## Currículo y bloques

Cada criterio `CEN.X` habilita el bloque de contenidos `BN`. No se pueden seleccionar contenidos de un bloque sin haber seleccionado al menos un criterio de ese mismo bloque. Si se retira el último criterio del bloque, la aplicación elimina automáticamente sus contenidos de la unidad y de las asociaciones de sesiones y actividades.

## Medios en las actividades

Cada actividad admite imágenes, vídeos, documentos y enlaces:

- las imágenes se redimensionan y se guardan en IndexedDB;
- los vídeos locales generan una miniatura cuando el navegador puede leer el archivo;
- los vídeos de YouTube utilizan su miniatura pública;
- otros vídeos se representan mediante una tarjeta identificable;
- los archivos se muestran como anexos;
- todos los medios se limitan al ancho útil de la página A4 y se incluyen en `.udpack`.

En el PDF los vídeos no se reproducen: aparecen como miniatura, título, pie y URL para que el documento siga siendo imprimible.

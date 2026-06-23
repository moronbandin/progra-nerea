# Análisis de los modelos de unidad

## Fuentes y método

Se analizaron los tres DOCX mediante extracción OOXML, conversión a texto y renderizado visual completo a A4:

| Modelo | Páginas | Párrafos | Imágenes | Actividades detectadas |
|---|---:|---:|---:|---:|
| UD 1 · *El mundo está loco… o quizá no* | 41 | 339 | 3 | 18 |
| UD 2 · *No estoy loca, es el mundo* | 32 | 227 | 5 | 14 |
| UD 3 · *Cielo, infierno y zona gris* | 39 | 292 | 5 | 15 |

Los tres documentos son A4, emplean Arial 11 pt como cuerpo y una jerarquía principalmente construida con formato directo. Las tablas-resumen de sesión se repiten visualmente, aunque parte de su estructura está contenida en formas o cajas de Word y no siempre como tablas nativas de primer nivel.

## Estructura común fija

1. Introducción.
2. Justificación.
3. Objetivos de etapa.
4. Objetivos de la unidad.
5. Contenidos.
6. Competencias clave.
7. Plan de lectura.
8. Interdisciplinariedad.
9. Metodología, actividades y temporalización.
10. Situaciones de aprendizaje.
11. Síntesis de la evaluación y atención a la diversidad.
12. Conclusión.

El PMV normaliza el título 10 como «Situación de aprendizaje y desarrollo de las sesiones» y el 11 como «Evaluación y atención a la diversidad», conservando contenido y orden. Se añaden portada y contraportada porque forman parte de la estructura obligatoria del producto.

## Patrón de las sesiones

Todas las unidades declaran seis sesiones de 50 minutos. Cada sesión presenta:

1. Título con contenido y bloque curricular.
2. Texto explicativo para la defensa: propósito, progresión, agrupamientos y cierre.
3. Tabla-resumen con contenidos, criterios, actividades, agrupamiento y espacio.
4. Desarrollo correlativo de actividades.

La progresión recurrente es: activación y contextualización; comprensión/análisis; desarrollo lingüístico o literario; aplicación guiada; producción; evaluación y cierre.

## Patrón de las actividades

Las actividades combinan cuatro capas:

- título numerado;
- descripción de lo que hará el alumnado;
- caja o párrafo explícito de «Finalidad didáctica»;
- material directo para el alumnado: texto, cuestiones, tablas, imágenes, esquemas, enlaces, consignas y espacios de respuesta.

Se detectan lectura guiada, comprensión, mapas lingüísticos, comparación de fuentes, análisis dialectal, análisis literario, reflexión gramatical, producción escrita/oral, cooperación, autoevaluación y producto final.

En la UD 3 existe una numeración duplicada de «Actividad 7»; el PMV evita esta clase de error calculando el número desde la posición.

## Elementos fijos, repetitivos y variables

| Categoría | Elementos |
|---|---|
| Fijos | doce apartados, orden, numeración, secuencia sesión → tabla → actividades, finalidad didáctica, síntesis final |
| Repetitivos | introducción normativa, metodología activa, mención DUA, patrón habitual de seis sesiones en los modelos, competencias clave, cierre |
| Configurables | título, fechas, evaluación, eje, textos, producto final, color, duración, agrupamientos, recursos, visibilidad |
| Específicos | tema, corpus textual, preguntas, imágenes, producto, conmemoraciones e interdisciplinariedad |
| Generables desde currículo | textos legales seleccionados, objetivo de materia asociado al criterio, descriptores y competencias clave |
| Manuales | objetivos didácticos, explicación docente, instrucciones, actividades, evidencias, instrumentos y selección de contenidos |

## Evaluación y diversidad

Los modelos relacionan criterios con objetivos y bloques, cierran con síntesis de instrumentos y medidas y utilizan autoevaluaciones mediante tablas. El PMV estructura esas relaciones para generar una matriz y advertencias. Las medidas DUA se asocian sin almacenar diagnósticos ni datos personales.

## Reglas editoriales deducidas

- Cuerpo sobrio, negro, legible y predominantemente Arial.
- Títulos numerados con separación amplia y sin ornamentación infantil.
- Tablas compactas con cabecera, bordes finos y columnas desiguales según contenido.
- «Finalidad didáctica» visible antes del material del alumnado.
- Imágenes centradas, con fuente o referencia cuando procede.
- Las sesiones pueden continuar varias páginas; no se debe impedir su partición completa.
- Las cabeceras de actividad, tablas cortas, figuras y pies deben mantenerse unidos.

## Decisiones del PMV

- La unidad se guarda como entidades, no como HTML monolítico.
- Una unidad nueva comienza con una sesión para evitar una pantalla inicial abrumadora; la unidad demo conserva las seis sesiones deducidas de los modelos.
- Los apartados admiten HTML enriquecido, pero mantienen metadatos de generación, edición manual y bloqueo.
- La relación criterio → objetivo de materia → descriptores es normativa.
- La relación criterio → contenido individual no se inventa: el decreto presenta contenidos por bloque, de modo que la selección queda manual y puede etiquetarse como sugerida en una fase futura.
- La impresión usa HTML semántico y CSS Paged Media; Chrome/Chromium es el navegador recomendado.

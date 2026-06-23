# Exportación PDF

La salida se genera en el navegador mediante HTML semántico, CSS Paged Media e impresión nativa. El formato es DIN A4, con márgenes espejo, portada y contraportada sin cabecera y reglas para viudas, huérfanas, tablas y cabeceras.

Flujo recomendado:

1. Abrir «Vista previa / PDF».
2. Revisar la previsualización o activar «Ver paginado final».
3. Pulsar «Guardar como PDF».
4. En Chrome o Chromium, seleccionar «Guardar como PDF».
5. Elegir A4, orientación vertical, escala 100 % y márgenes predeterminados.
6. Activar gráficos de fondo y desactivar los encabezados y pies añadidos por el navegador.

La geometría usa un lienzo A4 sin margen del navegador. Las cubiertas ocupan el lienzo completo y las páginas interiores incorporan sus márgenes físicos dentro de la propia caja. No se utilizan márgenes negativos, transformaciones ni escalados, por lo que el navegador no debe reducir el documento para hacerlo caber.

La vista «Revisión» detecta apartados vacíos, sesiones sin actividades, actividades sin finalidad y criterios sin uso. La detección geométrica avanzada de páginas casi vacías, resolución efectiva y títulos huérfanos queda señalada como mejora de segunda fase.

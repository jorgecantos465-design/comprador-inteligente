# Comprador Inteligente

MVP web para comparar listas de precios de múltiples proveedores y generar una
estrategia de compra. Todo se procesa localmente en el navegador: no hay login,
backend ni base de datos remota. La última sesión se guarda en `localStorage`
para poder reutilizar listas procesadas sin subir archivos a un servidor.

## Requisitos

- Node.js 20 o superior.
- npm.

## Ejecutar

```bash
npm install
npm run dev
```

Abrir la URL local que muestra Astro, normalmente
[`http://localhost:4321`](http://localhost:4321).

Para validar el build de producción:

```bash
npm run build
```

## Uso

1. Crear uno o más proveedores. La distancia y las observaciones son opcionales.
2. Adjuntar todas las listas correspondientes a cada proveedor. Se admiten
   `.xlsx`, `.xls`, `.csv` y `.pdf`.
3. Revisar y corregir las filas importadas. Cada precio conserva su archivo y
   fila de origen.
4. Agregar productos al pedido manual, indicando comprador, cantidad y unidad.
   También se puede pegar una lista de WhatsApp o texto libre, previsualizar los
   campos detectados y corregirlos antes de incorporarlos al pedido.
5. Revisar los productos sin coincidencia. Confirmar un alias sugerido o crear
   uno manual cuando dos nombres representen realmente el mismo producto.
6. Consultar la estrategia óptima, los totales y la alternativa de comprar todo
   a un único proveedor cuando exista.
7. Descargar el reporte CSV.

## Formato recomendado para listas

Excel y CSV funcionan mejor con encabezados como:

| producto | precio | unidad | contenido |
| --- | --- | --- | --- |
| Almendras naturales | 8500 | kg | 1 |
| Semillas de chía | 2100 | g | 500 |

La aplicación intenta reconocer también encabezados habituales como
`descripción`, `artículo`, `importe`, `valor`, `presentación`, `peso` y
`cantidad`. Si una detección no coincide con el archivo real, la tabla importada
se puede corregir manualmente.

Los PDFs usan extracción básica de texto. La interfaz muestra siempre la
advertencia `Revisar datos extraídos del PDF` y permite editar las filas
resultantes. Los PDFs escaneados sin texto seleccionable requieren OCR y quedan
fuera del alcance de esta versión. Para esos casos también se puede crear una
lista manual dentro del proveedor y completar, agregar o quitar filas.

## Normalización

- Convierte texto a minúsculas.
- Quita tildes y puntuación.
- Aplica singularización básica.
- Agrupa coincidencias exactas.
- Sugiere variantes parecidas para confirmación manual.
- Mantiene aliases en la sesión local del navegador.

Las variantes dudosas no se fusionan automáticamente.

## Guardado local

La aplicación guarda automáticamente proveedores, listas procesadas, aliases y
el pedido actual en este navegador. No conserva los archivos originales. La
pantalla incluye controles para guardar manualmente, limpiar solo el pedido,
borrar la sesión guardada o borrar todo.

## Límites de Fase 1

La estrategia óptima selecciona el menor precio comparable de cada producto.
Todavía no contempla stock, envío, impuestos complejos, mínimos por proveedor,
descuentos por volumen ni condiciones de pago.

La especificación completa está en
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

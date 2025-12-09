# Guía rápida de proyecciones

Objetivo: estimar agotamiento y stock proyectado por producto a un horizonte (default 90 días) usando:
- Ventas recientes (Excel de ventas) → demanda diaria.
- Stock inicial (Excel de stock; si no está o es 0 y existe en DB, se usa el stock del producto).
- Arribos futuros desde lotes no recibidos (lote + contenedor).
- Persistencia de resultados en `producto.model`.

## Modelos clave
- Producto
  - Campos relevantes: `codigo`, `nombre`, `stockActual`, `ventasPeriodo`, `ventasProyectadas`, `stockProyectado`, `diasHastaAgotarStock`, `seAgota`, `active`.
  - `stockActual` solo cambia al recibir lotes; los campos de proyección se recalculan con el servicio.
- Pedido
  - `numeroPedido`, `estado`, `productos[{producto, cantidad}]`.
- Contenedor
  - `codigo`, `fechaEstimadaLlegada`.
- Lote (nodo central)
  - `pedido`, `contenedor` (opcional), `producto`, `cantidad`, `recibido`, `fechaEstimadaDeLlegada` (si no hay contenedor).
  - Fecha de arribo:
    - Si tiene contenedor → `contenedor.fechaEstimadaLlegada`.
    - Si no tiene contenedor → `lote.fechaEstimadaDeLlegada`.

## Flujo de proyección (API)
1) **Controller (`proyeccionController`)**
   - Recibe siempre dos Excels: ventas y stock (multer en memoria).
   - Convierte a JSON con `excelBufferToJson` y limpia ventas con `limpiarDatosVentas`.
   - Obtiene `dateDiff` de las ventas con `getDatesFromExcel` (usa fechas del body si son válidas).
   - Envía `ventasData`, `stockData`, `dateDiff` y `horizonte` (default 90) al servicio.
   - Devuelve resultado + links de los archivos en Drive.

2) **Service (`proyeccionService`)**
   - Repos: `ProductoRepository`, `LoteRepository` (lotes pendientes con contenedor poblado).
   - Demanda: por código → `demandaDiaria = ventasPeriodo / dateDiff` (solo datos del Excel).
   - Stock inicial: prioridad Excel; si no existe, usa `stockActual` del producto (o 0 si no hay producto).
   - Arribos: lotes con `recibido=false`; cada lote aporta `{dia, cantidad}` donde `dia` es la diferencia en días desde hoy hasta la fecha de arribo.
   - Simulación por producto (event-based):
     - Recorre días hasta horizonte consumiendo `demandaDiaria`.
     - Suma arribos en su día.
     - Marca `seAgota` y `diasHastaAgotarStock` si el stock cae a 0 antes de un arribo que lo evite.
     - `stockProyectado` = stock al final del horizonte; `ventasProyectadas` = demanda diaria * horizonte.
   - Persistencia en producto (si existe en DB):
     - `stockProyectado`, `ventasProyectadas`, `diasHastaAgotarStock`, `seAgota`.
   - Respuesta por producto:
     - `{ codigo, productoId?, nombre, stockInicial, ventasPeriodo, ventasProyectadas, diasHastaAgotarStock, stockProyectado, seAgota, horizonteDias }`.

## Repositorios
- `productoRepository`: findByCodigos, updateProyeccionFields.
- `loteRepository`: findPendientesByProducto (recibido=false, popula contenedor).
- `pedidoRepository`, `contenedorRepository`: creados para mantener la capa de acceso a datos (ampliables).

## Reglas prácticas
- Horizonte default: 90 días, parametrizable.
- Solo se consideran lotes `recibido=false`.
- El Excel de ventas siempre define la demanda; no se calculan promedios fuera de ese rango.
- El Excel de stock manda: si no hay stock en DB o es 0, se usa el del Excel; si el Excel trae valor, se prioriza ese valor.
- Campos guardados en `Producto`: `stockProyectado`, `ventasProyectadas`, `diasHastaAgotarStock`, `seAgota`.

## Para depurar
- Si un producto no existe en DB pero está en los Excels, se calcula la proyección y se devuelve en la respuesta, pero no se persiste.
- Si un lote no tiene fecha de arribo válida, se ignora para la proyección.
- Si la demanda diaria es 0, no se agota y el stock proyectado solo sube con arribos.

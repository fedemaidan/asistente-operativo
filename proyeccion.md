# Guía rápida de proyecciones

Objetivo: estimar agotamiento y stock proyectado por producto a un horizonte (default 90 días) usando:
- Ventas recientes (Excel de ventas) → demanda diaria.
- Stock inicial (Excel de stock; si no está o es 0 y existe en DB, se usa el stock del producto).
- Arribos futuros desde lotes pendientes (estado PENDIENTE).
- Persistencia de resultados en `producto.model`.

## Modelos clave (estado real en Lote)
- Producto
  - `codigo`, `nombre`, `stockActual`, `ventasPeriodo`, `ventasProyectadas`, `stockProyectado`, `diasHastaAgotarStock`, `seAgota`, `active`, `proyeccionCalculo` (desglose auditable).
  - `stockActual` cambia al recibir lotes; `stockProyectado` se ajusta al crear/cambiar estado de lotes.
- Pedido
  - `numeroPedido`, `estado` (cache), `productos[{producto, cantidad}]` como intención original; las operaciones se basan en lotes.
- Contenedor
  - `codigo`, `fechaEstimadaLlegada`. **No guarda estado**; el estado se deriva: `ENTREGADO` si tiene lotes y ninguno pendiente, si no, `PENDIENTE`.
- Lote (fuente de verdad)
  - `pedido`, `contenedor` (opcional), `producto`, `cantidad`, `estado: ["PENDIENTE","ENTREGADO"]`, `fechaEntrega` (cuando pasa a ENTREGADO), `fechaEstimadaDeLlegada` (si no hay contenedor).
  - Virtual `recibido`: true ⇔ `estado==="ENTREGADO"` (compatibilidad).
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
   - Repos: `ProductoRepository`, `LoteRepository` (lotes con `estado="PENDIENTE"` y contenedor poblado).
   - Demanda: por código → `demandaDiaria = ventasPeriodo / dateDiff` (solo datos del Excel).
   - Stock inicial: prioridad Excel; si no existe, usa `stockActual` del producto (o 0 si no hay producto).
   - Arribos: lotes con `estado="PENDIENTE"`; cada lote aporta `{dia, cantidad}` donde `dia` es la diferencia en días desde hoy hasta la fecha de arribo.
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
- `loteRepository`: findPendientesByProducto (usa `estado="PENDIENTE"`, popula contenedor).
- `pedidoRepository`, `contenedorRepository`: capa de acceso a datos; el estado de contenedor se deriva en servicios.

## Reglas prácticas
- Horizonte default: 90 días, parametrizable.
- Solo se consideran lotes con `estado="PENDIENTE"`.
- El Excel de ventas siempre define la demanda; no se calculan promedios fuera de ese rango.
- El Excel de stock manda: si no hay stock en DB o es 0, se usa el del Excel; si el Excel trae valor, se prioriza ese valor.
- Campos guardados en `Producto`: `stockProyectado`, `ventasProyectadas`, `diasHastaAgotarStock`, `seAgota`, `proyeccionCalculo`.
- Ajustes de `stockProyectado` en runtime:
  - Crear lote(s): +cantidad.
  - PENDIENTE → ENTREGADO: -cantidad.
  - ENTREGADO → PENDIENTE: +cantidad.

## Arribos pendientes atrasados
- Si un lote está **PENDIENTE** y su fecha estimada de llegada es **anterior** a la fecha base de la proyección, se considera **atrasado**.
- En lugar de descartarlo, se incluye en la simulación como arribo en **día 0** (inicio del horizonte).
- Así se evita subestimar stock cuando un pedido sigue en camino aunque su ETA ya pasó.
- Implementación: `proyeccionHelper.buildArribosPorProducto` — cuando `diffDias < 0` se asigna `dia = 0` y `atrasado = true`.

## Desglose auditable (proyeccionCalculo)
- Cada producto persiste un objeto `proyeccionCalculo` con el detalle del cálculo para transparencia.
- Estructura:
  - `inputs`: `stockInicial`, `ventasPeriodo`, `diasPeriodo`, `diasConStock`, `ventasDiarias`, `horizonte90`, `horizonteCompra200`, `diasAnticipacion100`, `fechaBase`.
  - `arribos`: lista de arribos usados (cada uno con `dia`, `cantidad`, `atrasado`).
  - `resultadosIntermedios`: `demanda90`, `demanda200`, `oferta200`, `faltanteNeto`, `stockAlDia90`, `diaAgotamiento`.
  - `flags`: `incluyoArribosAtrasados`, `seAgota`, `agotamientoExcede365Dias`.
- Se calcula en `proyeccionService.calcularProductoProyeccion` y se persiste junto con el resto de campos de proyección.
- `simularProyeccion` (proyeccionHelper) devuelve `calculo` en su resultado.

## Ventas diarias (sin inflar demanda)
- `ventasDiarias = ventasPeriodo / diasConStock` (valor real, sin redondeo hacia arriba).
- Antes se usaba `Math.ceil(ventasDiarias)` lo que inflaba productos de baja rotación a 1 venta/día.
- Ahora se usa el valor decimal directo para proyección y simulación.

## Frontend: Tab Cálculo (productDetailModal)
- En el modal de detalle de producto (`factudata-react/.../productDetailModal.js`) hay un tab **Cálculo**.
- Muestra cómo se obtuvo cada métrica usando `producto.proyeccionCalculo`:
  1. **Ventas proyectadas (90 días)**: `ventasDiarias × 90` con explicación del período.
  2. **Días hasta agotar stock**: resultado de la simulación día a día.
  3. **Stock proyectado (día 90)**: stock final al horizonte.
  4. **Fecha agotamiento**: fecha en que el stock llega a 0.
  5. **Cantidad a comprar (200 días)**: `demanda200 − oferta200` con detalle.
  6. **Fecha compra sugerida**: fecha base + (día agotamiento − 100 días).
  7. **Pedidos considerados**: chips con arribos; los atrasados se marcan como "al inicio".
- El tab se deshabilita si el producto no tiene `proyeccionCalculo` (requiere recalcular la proyección).
- Textos pensados para usuarios no técnicos.

## Para depurar
- Si un producto no existe en DB pero está en los Excels, se calcula la proyección y se devuelve en la respuesta, pero no se persiste.
- Si un lote no tiene fecha de arribo válida, se ignora para la proyección.
- Si la demanda diaria es 0, no se agota y el stock proyectado solo sube con arribos.

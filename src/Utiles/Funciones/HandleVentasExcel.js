
const { normalizeExcelDate } = require("./HandleDates");
const { excelBufferToJson } = require("./Excel/excelHandler");

const limpiarDatosVentas = (data) => {
  return Object.values(data).map((item) => {
    const itemLimpio = {};

    Object.keys(item).forEach((key) => {
      const keyLimpia = key.trim();

      if (keyLimpia === "Artículo") {
        itemLimpio["Codigo"] = item[key];
      } else if (
        keyLimpia === "Cantidad" ||
        keyLimpia === "Costo" ||
        keyLimpia === "Venta"
      ) {
        itemLimpio[keyLimpia] =
          typeof item[key] === "string"
            ? parseFloat(item[key].replace(",", "."))
            : Number(item[key]);
      } else {
        itemLimpio[keyLimpia] = item[key];
      }
    });

    return itemLimpio;
  });
};

const toNumber = (value, fallback = 0) => {
  const n = Number(
    typeof value === "string" ? value.replace(",", ".").trim() : value
  );
  return Number.isFinite(n) ? n : fallback;
};

const normalizeKeys = (item) => {
  const out = {};
  const obj = item && typeof item === "object" ? item : {};
  Object.keys(obj).forEach((k) => {
    const nk =
      typeof k === "string"
        ? k.trim().toLowerCase().replace(/\s+/g, " ")
        : String(k).trim().toLowerCase();
    out[nk] = obj[k];
  });
  return out;
};

const limpiarDatosStockDesdeQuiebreExcel = (data) => {
  const rows = Array.isArray(data) ? data : Object.values(data || {});
  const results = [];

  for (const raw of rows) {
    const normalized = normalizeKeys(raw);
    const codigo =
      normalized["artículo"] ?? normalized["articulo"] ?? normalized["codigo"];
    const descripcion =
      normalized["descripción"] ??
      normalized["descripcion"] ??
      normalized["descrip"] ??
      normalized["nombre"];

    const descripcionStr =
      typeof descripcion === "string" ? descripcion.trim() : "";
    if (!codigo || !descripcionStr) continue;
    if (descripcionStr.toLowerCase().includes("subtotal")) continue;

    const cantidad = toNumber(
      normalized["cantidad"] ??
        normalized["stock actual"] ??
        normalized["stock"] ??
        0,
      0
    );

    results.push({
      Codigo: String(codigo).trim(),
      Descripcion: descripcionStr,
      Cantidad: cantidad,
    });
  }

  return results;
};

const safeParseExcelBuffer = (file) => {
  try {
    const parsed = excelBufferToJson(file.buffer);
    return {
      success: Boolean(parsed?.success),
      data: parsed?.data,
      error: null,
    };
  } catch (error) {
    return { success: false, data: null, error: error?.message || String(error) };
  }
};

/**
 * Parser del Excel de quiebre/ingresos.
 *
 * Normaliza nombres de columnas y convierte fechas (incluye serial de Excel) a Date.
 * Devuelve un array de filas con una forma estable para usar en la lógica de negocio.
 *
 * Output por fila:
 * - codigo: string
 * - descripcion: string
 * - fechaIngreso: Date | null
 * - cantidadIngreso: number
 * - fechaQuiebre: Date | null
 */
const limpiarDatosQuiebre = (data) => {
  const rows = Array.isArray(data) ? data : Object.values(data || {});

  const results = [];

  for (const raw of rows) {
    const item = raw && typeof raw === "object" ? raw : {};

    const normalized = {};
    Object.keys(item).forEach((k) => {
      const nk =
        typeof k === "string"
          ? k.trim().toLowerCase().replace(/\s+/g, " ")
          : String(k).trim().toLowerCase();
      normalized[nk] = item[k];
    });

    const codigo = normalized["artículo"] ?? normalized["articulo"] ?? normalized["codigo"];
    const descripcion = normalized["descripción"] ?? normalized["descripcion"];

    // Filtramos categorías/subtotales: no tienen descripción (o la tienen como "Subtotal")
    const descripcionStr = typeof descripcion === "string" ? descripcion.trim() : "";
    if (!codigo || !descripcionStr) continue;
    if (descripcionStr.toLowerCase().includes("subtotal")) continue;

    const fechaQuiebre = normalizeExcelDate(
      normalized["fecha cero"] ??
        normalized["fecha quiebre stock (en 0 o en negativo)"] ??
        normalized["fecha quiebre"]
    );

    const fechaIngreso = normalizeExcelDate(normalized["fecha ingreso"]);
    const cantidadIngreso = toNumber(
      normalized["ult. ingreso"] ??
        normalized["ult ingreso"] ??
        normalized["cantidad ingreso"] ??
        normalized["ultimo ingreso"] ??
        normalized["último ingreso"],
      0
    );

    const base = {
      codigo: String(codigo).trim(),
      descripcion: descripcionStr,
    };

    if (fechaQuiebre) {
      results.push({
        ...base,
        fechaIngreso: null,
        cantidadIngreso: 0,
        fechaQuiebre,
      });
    }

    if (fechaIngreso) {
      results.push({
        ...base,
        fechaIngreso,
        cantidadIngreso,
        fechaQuiebre: null,
      });
    }
  }

  return results;
};

const proyectarStock = async (
  dataStock,
  dataVentas,
  dateDiff,
  GOOGLE_SHEET_ID,
  proyeccionId
) => {

  const stockProyeccion = [];
  for (const itemStock of dataStock) {
    const itemVentas = dataVentas.find(
      (item) => item.Codigo === itemStock.Codigo
    );

    if (!itemVentas) {
      continue;
    }
    const ventasDiarias = itemVentas.Cantidad / dateDiff;
    let diasSinStock = 0;

    if (itemStock.Cantidad <= 0) {
      diasSinStock = 0;
    } else if (ventasDiarias > 0) {
      diasSinStock = itemStock.Cantidad / ventasDiarias;
    }

    const itemStockProyeccion = {
      codigo: itemStock.Codigo,
      descripcion: itemStock.Descripcion,
      cantidad: itemStock.Cantidad,
      ventasPeriodo: itemVentas.Cantidad,
      ventasProyectadas: Math.round(ventasDiarias * 90),
      diasSinStock: Math.round(diasSinStock),
      proyeccionId,
    };
    stockProyeccion.push(itemStockProyeccion);
  }
  return stockProyeccion;
};

module.exports = {
  limpiarDatosVentas,
  limpiarDatosQuiebre,
  limpiarDatosStockDesdeQuiebreExcel,
  safeParseExcelBuffer,
  proyectarStock,
};

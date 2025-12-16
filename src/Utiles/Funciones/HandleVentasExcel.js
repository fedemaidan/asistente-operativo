
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

const normalizeDateToNoon = (dateLike) => {
  if (!dateLike) return null;
  const d = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(12, 0, 0, 0);
  return d;
};

// Excel serial date (Windows): days since 1899-12-30
const excelSerialToDate = (serial) => {
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  const d = new Date(1899, 11, 30);
  d.setDate(d.getDate() + Math.floor(n));
  d.setHours(12, 0, 0, 0);
  return d;
};

const normalizeExcelDate = (value) => {
  if (value == null || value === "") return null;
  if (value instanceof Date) return normalizeDateToNoon(value);
  if (typeof value === "number") return excelSerialToDate(value);
  return normalizeDateToNoon(value);
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

  return rows
    .map((raw) => {
      const item = raw && typeof raw === "object" ? raw : {};
      const normalized = {};
      Object.keys(item).forEach((k) => {
        const nk = typeof k === "string" ? k.trim().toLowerCase() : String(k);
        normalized[nk] = item[k];
      });

      const codigo = normalized["codigo"];
      if (!codigo) return null;

      return {
        codigo: String(codigo).trim(),
        descripcion: normalized["descripcion"] ? String(normalized["descripcion"]).trim() : "",
        fechaIngreso: normalizeExcelDate(normalized["fecha ingreso"]),
        cantidadIngreso: toNumber(normalized["cantidad ingreso"], 0),
        fechaQuiebre: normalizeExcelDate(
          normalized["fecha quiebre stock (en 0 o en negativo)"]
        ),
      };
    })
    .filter(Boolean);
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
  proyectarStock,
};

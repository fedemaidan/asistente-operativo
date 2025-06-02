const {
  getArticulosIgnoradosFromSheet,
} = require("../GoogleServices/Sheets/proyeccionStock");

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

const proyectarStock = async (dataStock, dataVentas, dateDiff) => {
  const articulosIgnorados = await getArticulosIgnoradosFromSheet();

  const codigosIgnorados = new Set(
    articulosIgnorados.map((item) => item.codigo)
  );

  const stockProyeccion = [];
  for (const itemStock of dataStock) {
    if (codigosIgnorados.has(itemStock.Codigo)) {
      console.log(
        `Omitiendo artículo ignorado: ${itemStock.Codigo} - ${itemStock.Descripcion}`
      );
      continue;
    }

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
      ventas15Dias: itemVentas.Cantidad,
      ventasProyectadas: Math.round(ventasDiarias * 90),
      diasSinStock: Math.round(diasSinStock),
    };
    stockProyeccion.push(itemStockProyeccion);
  }
  console.log("STOCK PROYECCION 1", stockProyeccion);
  return stockProyeccion;
};

module.exports = {
  limpiarDatosVentas,
  proyectarStock,
};

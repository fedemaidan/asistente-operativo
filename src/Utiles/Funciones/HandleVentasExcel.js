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

const proyectarStock = (dataStock, dataVentas) => {
  console.log("DATA STOCK", dataStock.slice(0, 5));

  const stockProyeccion = [];
  for (const itemStock of dataStock) {
    const itemVentas = dataVentas.find(
      (item) => item.Codigo === itemStock.Codigo
    );

    if (!itemVentas) {
      continue;
    }
    const ventasDiarias = itemVentas.Cantidad / 15;
    let diasSinStock = 0;

    if (ventasDiarias > 0) {
      diasSinStock = itemStock.Cantidad / ventasDiarias;
    }

    const itemStockProyeccion = {
      codigo: itemStock.Codigo,
      descripcion: itemStock.Descripcion,
      ventas15Dias: itemVentas.Cantidad,
      ventasProyectadas: itemVentas.Cantidad * 6,
      diasSinStock,
    };
    stockProyeccion.push(itemStockProyeccion);
  }
  return stockProyeccion;
};

module.exports = {
  limpiarDatosVentas,
  proyectarStock,
};

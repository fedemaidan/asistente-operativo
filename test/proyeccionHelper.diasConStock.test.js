const { buildDiasConStockPorCodigo } = require("../src/Utiles/proyeccionHelper");

describe("buildDiasConStockPorCodigo", () => {
  test("si quiebre e ingreso ocurren el mismo día, no debe contar días sin stock", () => {
    const fechaInicio = new Date("2025-12-18T00:00:00.000Z");
    const fechaFin = new Date("2025-12-23T00:00:00.000Z");
    const dateDiff = 5; // 18 -> 23

    const quiebreData = [
      {
        codigo: "A",
        fechaQuiebre: "2025-12-19",
        fechaIngreso: "2025-12-19",
        cantidadIngreso: 1,
      },
    ];

    const map = buildDiasConStockPorCodigo({ quiebreData, fechaInicio, fechaFin, dateDiff });
    expect(map.get("A")).toBe(dateDiff);
  });

  test("si quiebre es un día y el ingreso es al día siguiente, debe restar 1 día sin stock", () => {
    const fechaInicio = new Date("2025-12-18T00:00:00.000Z");
    const fechaFin = new Date("2025-12-23T00:00:00.000Z");
    const dateDiff = 5; // 18 -> 23

    const quiebreData = [
      {
        codigo: "A",
        fechaQuiebre: "2025-12-19",
        fechaIngreso: "2025-12-20",
        cantidadIngreso: 10,
      },
    ];

    const map = buildDiasConStockPorCodigo({ quiebreData, fechaInicio, fechaFin, dateDiff });
    expect(map.get("A")).toBe(4);
  });
});



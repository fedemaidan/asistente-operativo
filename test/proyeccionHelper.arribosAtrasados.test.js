const {
  buildArribosPorProducto,
  simularProyeccion,
} = require("../src/Utiles/proyeccionHelper");

describe("buildArribosPorProducto - arribos atrasados", () => {
  test("arribo con fecha anterior a fechaBase se incluye en día 0 como atrasado", () => {
    const fechaBase = new Date("2026-03-18T12:00:00.000Z");
    const lotesPendientes = [
      {
        producto: "prod1",
        cantidad: 100,
      },
    ];
    const getFechaArribo = () => new Date("2026-03-11T12:00:00.000Z");

    const map = buildArribosPorProducto(lotesPendientes, getFechaArribo, fechaBase);
    const arribos = map.get("prod1");
    expect(arribos).toBeDefined();
    expect(arribos).toHaveLength(1);
    expect(arribos[0].dia).toBe(0);
    expect(arribos[0].cantidad).toBe(100);
    expect(arribos[0].atrasado).toBe(true);
  });

  test("arribo con fecha posterior a fechaBase se incluye en día correspondiente", () => {
    const fechaBase = new Date("2026-03-18T12:00:00.000Z");
    const lotesPendientes = [
      {
        producto: "prod1",
        cantidad: 50,
      },
    ];
    const getFechaArribo = () => new Date("2026-03-25T12:00:00.000Z");

    const map = buildArribosPorProducto(lotesPendientes, getFechaArribo, fechaBase);
    const arribos = map.get("prod1");
    expect(arribos).toBeDefined();
    expect(arribos).toHaveLength(1);
    expect(arribos[0].dia).toBeGreaterThan(0);
    expect(arribos[0].atrasado).toBe(false);
  });
});

describe("simularProyeccion - calculo auditable", () => {
  test("devuelve objeto calculo con inputs, arribos, resultadosIntermedios y flags", () => {
    const resultado = simularProyeccion({
      horizonte: 90,
      stockInicial: 85,
      ventasDiarias: 0.33,
      arribos: [{ dia: 0, cantidad: 100, atrasado: true }],
      fechaBase: new Date("2026-03-18"),
    });

    expect(resultado.calculo).toBeDefined();
    expect(resultado.calculo.arribos).toHaveLength(1);
    expect(resultado.calculo.arribos[0].atrasado).toBe(true);
    expect(resultado.calculo.resultadosIntermedios).toBeDefined();
    expect(resultado.calculo.resultadosIntermedios.demanda90).toBeCloseTo(29.7, 1);
    expect(resultado.calculo.flags.incluyoArribosAtrasados).toBe(true);
  });
});

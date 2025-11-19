const mongoose = require("mongoose");
const { setupDB, teardownDB, clearDB } = require("../setupMongo");

// Mock de cotizaciones para evitar dependencias externas
jest.mock("../../src/services/monedasService/dolarService.js", () => ({
  obtenerValoresDolar: jest.fn().mockResolvedValue({
    blue: { venta: 1000, compra: 1000 },
    oficial: { venta: 900, compra: 900 },
  }),
}));

const CajaController = require("../../src/controllers/cajaController");
const MovimientoController = require("../../src/controllers/movimientoController");
const Caja = require("../../src/models/caja.model");
const Movimiento = require("../../src/models/movimiento.model");

function signo(x) {
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

describe("Movimientos compuestos - crear y editar", () => {
  beforeAll(async () => {
    await setupDB();
    if (Caja.syncIndexes) await Caja.syncIndexes();
    if (Movimiento.syncIndexes) await Movimiento.syncIndexes();
  });

  afterAll(async () => {
    await teardownDB();
  });

  afterEach(async () => {
    await clearDB();
  });

  test(
    "crear compuesto EGRESO+INGRESO (mismo monto, signos opuestos, cajas distintas) y luego editar preservando magnitudes",
    async () => {
      // 1) Crear cajas
      const ezeResp = await CajaController.createCaja({ nombre: "EZE" });
      expect(ezeResp).toBeDefined();
      expect(ezeResp.success).toBe(true);
      const eze = ezeResp.data && ezeResp.data.data ? ezeResp.data.data : null;
      expect(eze && eze._id).toBeDefined();
      const enshopResp = await CajaController.createCaja({ nombre: "ENSHOP" });
      expect(enshopResp).toBeDefined();
      expect(enshopResp.success).toBe(true);
      const enshop =
        enshopResp.data && enshopResp.data.data ? enshopResp.data.data : null;
      expect(enshop && enshop._id).toBeDefined();

      // 2) Crear movimiento compuesto como AgregarAporteModal:
      //    EGRESO desde EZE y INGRESO en ENSHOP, misma magnitud y signos opuestos
      const monto = 1000;
      const movimiento1 = {
        type: "EGRESO",
        cliente: { nombre: "APORTE CAPITAL" },
        cuentaCorriente: "ARS",
        moneda: "ARS",
        tipoFactura: "transferencia",
        caja: eze._id,
        nombreUsuario: "tester",
        tipoDeCambio: 1,
        estado: "CONFIRMADO",
        empresaId: "celulandia",
        concepto: "Aporte inicial",
      };
      const movimiento2 = {
        type: "INGRESO",
        cliente: { nombre: "APORTE EZE" },
        cuentaCorriente: "ARS",
        moneda: "ARS",
        tipoFactura: "transferencia",
        caja: enshop._id,
        nombreUsuario: "tester",
        tipoDeCambio: 1,
        estado: "CONFIRMADO",
        empresaId: "celulandia",
        concepto: "Aporte recibido",
      };

      const createRes = await MovimientoController.createCompuesto(
        movimiento1,
        -monto,
        movimiento2,
        monto,
        true,
        true
      );
      expect(createRes).toBeDefined();
      expect(createRes.success).toBe(true);
      expect(createRes.data).toBeDefined();
      const mov1 = createRes.data.movimiento1;
      const mov2 = createRes.data.movimiento2;
      expect(mov1).toBeDefined();
      expect(mov2).toBeDefined();

      // 2.1) Complementarios
      expect(String(mov1.movimientoComplementario)).toBe(String(mov2._id));
      expect(String(mov2.movimientoComplementario)).toBe(String(mov1._id));

      // 2.2) Cajas diferentes
      expect(String(mov1.caja._id)).toBe(String(eze._id));
      expect(String(mov2.caja._id)).toBe(String(enshop._id));

      // 2.3) Mismo monto en ARS pero signos opuestos
      const m1ARS = Number(mov1.total.ars || 0);
      const m2ARS = Number(mov2.total.ars || 0);
      expect(Math.abs(m1ARS)).toBe(monto);
      expect(Math.abs(m2ARS)).toBe(monto);
      expect(signo(m1ARS)).toBe(-1); // EGRESO
      expect(signo(m2ARS)).toBe(1); // INGRESO

      // 3) Editar compuesto: cambiar monto del 1 y sincroniza magnitud al 2 (con signos preservados)
      const nuevoMonto = 2500;
      const editarRes = await MovimientoController.editarCompuesto(
        mov1._id,
        { montoEnviado: nuevoMonto },
        mov2._id,
        {},
        "tester-editor"
      );
      expect(editarRes).toBeDefined();
      expect(editarRes.success).toBe(true);
      const mov1Edit = editarRes.data.movimiento1;
      const mov2Edit = editarRes.data.movimiento2;
      expect(mov1Edit).toBeDefined();
      expect(mov2Edit).toBeDefined();

      const m1ARSEdit = Number(mov1Edit.total.ars || 0);
      const m2ARSEdit = Number(mov2Edit.total.ars || 0);

      // Magnitudes iguales al editar
      expect(Math.abs(m1ARSEdit)).toBe(nuevoMonto);
      expect(Math.abs(m2ARSEdit)).toBe(nuevoMonto);

      // Signos preservados (EGRESO negativo, INGRESO positivo)
      expect(signo(m1ARSEdit)).toBe(-1);
      expect(signo(m2ARSEdit)).toBe(1);

      // Complementarios y cajas se mantienen
      expect(String(mov1Edit.movimientoComplementario)).toBe(String(mov2Edit._id));
      expect(String(mov2Edit.movimientoComplementario)).toBe(String(mov1Edit._id));
      expect(String(mov1Edit.caja._id)).toBe(String(eze._id));
      expect(String(mov2Edit.caja._id)).toBe(String(enshop._id));
    },
    60000
  );
});



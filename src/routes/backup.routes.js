const express = require('express');
const router = express.Router();
const { getSheetIdFromLink } = require('../Utiles/GoogleServices/Sheets/getSheetIdFromLink');
const { importarMasivo } = require('../../dev_tools/importarMasivo');
const { deleteCollections } = require('../DBConnection');
const { importarComprobantesAlternativo } = require('../Utiles/GoogleServices/Sheets/comprobanteAlternativo');
const { importarPagosAlternativo } = require('../Utiles/GoogleServices/Sheets/pagoAlternativo');
const { importarEntregasAlternativo } = require('../Utiles/GoogleServices/Sheets/entregaAlternativo');
const MovimientoController = require('../controllers/movimientoController');
const CuentaPendienteController = require('../controllers/cuentaPendienteController');

router.post('/restore-db', async(req, res) => {
  const { linkGoogleSheet } = req.body;

  if (!linkGoogleSheet) {
    return res.status(400).json({ success: false, error: 'Link Google Sheet is required' });
  }

  const sheetId = getSheetIdFromLink(linkGoogleSheet);
  if (!sheetId) {
    return res.status(400).json({ success: false, error: 'No se pudo extraer el ID de Google Sheet del link provisto' });
  }

  try {
    await deleteCollections(['cuentapendientes', 'movimientos', 'cajas', 'clientes'])
    await importarMasivo(sheetId)
    return res.status(200).json({ success: true, message: 'Backup restored successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sync-alt-sheet', async(req, res) => {
  try {
    const [comprobantesRes, pagosRes, entregasRes] = await Promise.all([
      importarComprobantesAlternativo(),
      importarPagosAlternativo(),
      importarEntregasAlternativo(),
    ]);

    const overallSuccess = comprobantesRes.success && pagosRes.success && entregasRes.success;
    const allCreatedDocs = [
      ...(comprobantesRes.createdDocs || []),
      ...(pagosRes.createdDocs || []),
      ...(entregasRes.createdDocs || []),
    ];

    const payload = {
      success: overallSuccess,
      resumen: {
        comprobantes: { created: comprobantesRes.created, errors: comprobantesRes.errors },
        pagos: { created: pagosRes.created, errors: pagosRes.errors },
        entregas: { created: entregasRes.created, errors: entregasRes.errors },
        totalCreated: allCreatedDocs.length,
      },
      createdDocs: allCreatedDocs,
      detalle: {
        comprobantes: comprobantesRes,
        pagos: pagosRes,
        entregas: entregasRes,
      },
    };

    if (!overallSuccess) {
      return res.status(500).json(payload);
    }
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/confirm-alt-sheet', async(req, res) => {
  try {
    const { movimientoIds = [], cuentaPendienteIds = [] } = req.body || {};
    const [movRes, cpRes] = await Promise.all([
      MovimientoController.confirmMovimientos(movimientoIds),
      CuentaPendienteController.confirmCuentas(cuentaPendienteIds),
    ]);
    const success = (movRes?.success !== false) && (cpRes?.success !== false);
    const payload = {
      success,
      movimientos: movRes,
      cuentasPendientes: cpRes,
    };
    return res.status(success ? 200 : 500).json(payload);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});


module.exports = router;
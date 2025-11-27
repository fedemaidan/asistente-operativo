const express = require('express');
const router = express.Router();
const { getSheetIdFromLink } = require('../Utiles/GoogleServices/Sheets/getSheetIdFromLink');
const { importarMasivo } = require('../../dev_tools/importarMasivo');
const { deleteCollections } = require('../DBConnection');

router.post('/restore-db', async(req, res) => {
  const { linkGoogleSheet } = req.body;

  if (!linkGoogleSheet) {
    return res.status(400).json({ error: 'Link Google Sheet is required' });
  }

  const sheetId = getSheetIdFromLink(linkGoogleSheet);
  if (!sheetId) {
    return res.status(400).json({ error: 'No se pudo extraer el ID de Google Sheet del link provisto' });
  }

  try {
    await deleteCollections(['cuentapendientes', 'movimientos', 'cajas', 'clientes'])
    await importarMasivo(sheetId)
    return res.status(200).json({ message: 'Backup restored successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
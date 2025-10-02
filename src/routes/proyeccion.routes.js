const express = require('express');
const multer = require('multer');
const proyeccionController = require('../controllers/proyeccionController');
const stockProyeccionController = require('../controllers/stockProyeccionController');
const productosIgnorarController = require('../controllers/productosIgnorarController');
const productoProyeccionController = require('../controllers/productoProyeccionController');
const Tag = require('../models/tag.model');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      populate = '',
      limit = 20,
      offset = 0,
      sortField = 'fechaCreacion',
      sortDirection = 'desc',
    } = req.query;

    const sort = {};
    if (sortField) {
      sort[sortField] = sortDirection === 'asc' ? 1 : -1;
    }

    const options = {
      filter: {},
      populate,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort,
    };

    const result = await proyeccionController.getAllPaginado(options);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
    console.error(error);
  }
});

router.get('/ignorar', async (req, res) => {
  try {
    const result = await productosIgnorarController.getAll();
    return res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/ignorar', async (req, res) => {
  try {
    console.log('req.body', req.body);
    const { codigos } = req.body;
    const result = await productosIgnorarController.createMany(
      codigos.map((codigo) => {
        return { codigo: codigo.trim() };
      })
    );
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/ignorar', async (req, res) => {
  try {
    const { id } = req.body;
    const result = await productosIgnorarController.delete(id);
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/producto', async (req, res) => {
  try {
    const { id } = req.body;
    const result = await productoProyeccionController.delete(id);
    return res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/tags', async (req, res) => {
  try {
    const { productosProyeccionId, tag, persist = false } = req.body;
    const result = await proyeccionController.agregarTags(
      productosProyeccionId,
      tag,
      persist
    );
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
    console.error(error);
  }
});

router.delete('/tags', async (req, res) => {
  try {
    const { productosProyeccionId } = req.body;
    const result = await proyeccionController.eliminarTags(
      productosProyeccionId
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const {
      populate = '',
      limit = 20,
      offset = 0,
      sortField = 'codigo',
      sortDirection = 'asc',
      tag = '',
    } = req.query;

    const sort = {};
    if (sortField) {
      sort[sortField] = sortDirection === 'asc' ? 1 : -1;
    }

    const options = {
      filter: { proyeccionId: id },
      populate,
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort,
    };

    if (tag && tag !== 'Todos') {
      const tagsByName = await Tag.find({ nombre: tag }, { codigos: 1 }).lean();
      const codigosSet = new Set(
        tagsByName.flatMap((t) => (Array.isArray(t.codigos) ? t.codigos : []))
      );
      const orConds = [{ tags: tag }];
      if (codigosSet.size > 0) {
        orConds.push({ codigo: { $in: Array.from(codigosSet) } });
      }
      options.filter = { $and: [options.filter, { $or: orConds }] };
    }

    const result = await stockProyeccionController.getAllPaginado(options);

    const items = Array.isArray(result?.data) ? result.data : [];
    const codigos = Array.from(
      new Set(
        items.map((p) => (p?.codigo || '').toString().trim()).filter(Boolean)
      )
    );

    let codeToTagNames = {};
    if (codigos.length > 0) {
      const tagsDocs = await Tag.find(
        { codigos: { $in: codigos } },
        { nombre: 1, codigos: 1 }
      ).lean();
      for (const t of tagsDocs) {
        const nombre = t?.nombre;
        const lista = Array.isArray(t?.codigos) ? t.codigos : [];
        for (const c of lista) {
          if (!codigos.includes(c)) continue;
          if (!codeToTagNames[c]) codeToTagNames[c] = [];
          if (nombre && !codeToTagNames[c].includes(nombre))
            codeToTagNames[c].push(nombre);
        }
      }
      var tagsDisponiblesSet = new Set(
        tagsDocs.map((t) => t?.nombre).filter(Boolean)
      );
    } else {
      var tagsDisponiblesSet = new Set();
    }

    const enriched = items.map((p) => {
      const existing = Array.isArray(p?.tags)
        ? p.tags
        : typeof p?.tags === 'string' && p.tags.trim() !== ''
        ? [p.tags]
        : [];
      const permanentes = codeToTagNames[p?.codigo] || [];
      const merged = Array.from(new Set([...existing, ...permanentes]));
      merged.forEach((t) => tagsDisponiblesSet.add(t));
      return { ...p, tags: merged };
    });

    res.json({
      ...result,
      data: enriched,
      tagsDisponibles: Array.from(tagsDisponiblesSet).sort(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  '/',
  upload.fields([
    { name: 'ventas', maxCount: 1 },
    { name: 'stock', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { fechaInicio, fechaFin } = req.body;
      const ventasFile = req.files?.ventas?.[0];
      const stockFile = req.files?.stock?.[0];

      const result = await proyeccionController.createProyeccion({
        fechaInicio,
        fechaFin,
        ventasFile,
        stockFile,
      });

      res.json(result);
    } catch (error) {
      const payload = error?.payload;
      if (payload) {
        return res.status(400).json(payload);
      }
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = router;

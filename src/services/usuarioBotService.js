const UsuarioBotRepository = require("../repository/usuarioBotRepository");

const LEGACY_USUARIOS = [
  { telefono: "5493876147003", perfilKey: "celulandiaDev", nombres: ["Martin", "Fede"] },
  { telefono: "5493416569286", perfilKey: "drive", nombres: ["Diego"] },
  { telefono: "5493413191527", perfilKey: "drive", nombres: ["Abel"] },
  { telefono: "5493416820179", perfilKey: "drive", nombres: ["Gabriel"] },
  { telefono: "5491162948395", perfilKey: "celulandiaDev", nombres: ["Federico"] },
  { telefono: "5491136322541", perfilKey: "drive", nombres: ["Facu"] },
  { telefono: "5491154709252", perfilKey: "celulandia", nombres: ["Ezequiel"] },
  { telefono: "140746145439868", perfilKey: "celulandia", nombres: ["Ezequiel"] },
  { telefono: "175501037551671", perfilKey: "celulandia", nombres: ["Ezequiel"] },
  { telefono: "5491126032204", perfilKey: "celulandia", nombres: ["Matias", "Naomi"] },
  { telefono: "5491165000590", perfilKey: "celulandia", nombres: ["Nicolas"] },
  { telefono: "81295308767471", perfilKey: "celulandia", nombres: ["Nicolas"] },
  { telefono: "5493424421565", perfilKey: "celulandia", nombres: ["Matias"] },
  { telefono: "5491131906768", perfilKey: "financiera", nombres: ["-"] },
  { telefono: "5491133929019", perfilKey: "financiera", nombres: ["-"] },
];

class UsuarioBotService {
  constructor() {
    this.usuarioBotRepository = new UsuarioBotRepository();
  }

  normalizeTelefono(telefono) {
    return String(telefono || "").split("@")[0].trim();
  }

  static normalizeIngresoTelefono(input) {
    return String(input || "").replace(/\D/g, "");
  }
  async findDocumentoPorTelefonoDigitos(digitos) {
    const d = UsuarioBotService.normalizeIngresoTelefono(digitos);
    if (!d) return null;
    return this.usuarioBotRepository.findByTelefono(d);
  }

  async crearVinculoRemitente(jidLocal, textoTelefonoDeclarado) {
    const jid = this.normalizeTelefono(jidLocal);
    if (!jid) {
      return { ok: false, reason: "invalid_jid" };
    }
    const digitos = UsuarioBotService.normalizeIngresoTelefono(textoTelefonoDeclarado);
    if (!digitos) {
      return { ok: false, reason: "invalid_input" };
    }

    const existenteRemitente = await this.usuarioBotRepository.findByTelefono(jid);
    if (existenteRemitente) {
      return {
        ok: true,
        entry: this.toEntry(existenteRemitente),
        alreadyExisted: true,
      };
    }

    const fuente = await this.usuarioBotRepository.findByTelefono(digitos);
    if (!fuente) {
      return { ok: false, reason: "not_found" };
    }

    try {
      const src = typeof fuente.toObject === "function" ? fuente.toObject() : fuente;
      const nombresCopy = Array.isArray(src.nombres)
        ? src.nombres.map(String)
        : src.nombres != null && src.nombres !== ""
          ? [String(src.nombres)]
          : [];
      const created = await this.usuarioBotRepository.create({
        telefono: jid,
        perfilKey: src.perfilKey,
        nombres: nombresCopy,
      });
      return { ok: true, entry: this.toEntry(created) };
    } catch (error) {
      const dup =
        error?.code === 11000 ||
        /E11000|duplicate key/i.test(String(error?.message || ""));
      if (dup) {
        const doc = await this.usuarioBotRepository.findByTelefono(jid);
        if (doc) {
          return {
            ok: true,
            entry: this.toEntry(doc),
            alreadyExisted: true,
          };
        }
      }
      throw error;
    }
  }

  /**
   * @param {import("mongoose").Document|Object|null} doc
   * @returns {{ perfil: Object, nombre: string[] }|null}
   */
  toEntry(doc) {
    if (!doc) return null;
    const { getPerfilByKey } = require("../Utiles/Usuarios/usuariosPerfiles");
    const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
    const perfil = getPerfilByKey(plain.perfilKey);
    return { perfil, nombre: plain.nombres || [] };
  }

  /**
   * Obtiene usuario por teléfono (sin @s.whatsapp.net) y devuelve perfil hidratado + nombre.
   * @returns {Promise<{ perfil: Object, nombre: string[] }|null>}
   */
  async get(telefono) {
    const t = this.normalizeTelefono(telefono);
    if (!t) return null;
    const doc = await this.usuarioBotRepository.findByTelefono(t);
    return this.toEntry(doc);
  }

  /**
   * @returns {Promise<{ perfil: Object, nombre: string[] }>}
   */
  async create({ telefono, perfilKey, nombres }) {
    const t = this.normalizeTelefono(telefono);
    const list = Array.isArray(nombres)
      ? nombres.map(String)
      : nombres != null && nombres !== ""
        ? [String(nombres)]
        : [];
    const created = await this.usuarioBotRepository.create({
      telefono: t,
      perfilKey,
      nombres: list,
    });
    return this.toEntry(created);
  }

  /**
   * Si existe devuelve la entrada; si no, crea con los defaults.
   * @returns {Promise<{ perfil: Object, nombre: string[] }>}
   */
  async getOrCreate(telefono, defaults) {
    const existing = await this.get(telefono);
    if (existing) return existing;
    return this.create({
      telefono,
      perfilKey: defaults.perfilKey,
      nombres: defaults.nombres ?? ["-"],
    });
  }

  /**
   * Mapa en memoria compatible con el uso anterior (clave teléfono, valor { perfil, nombre }).
   * @returns {Promise<Map<string, { perfil: Object, nombre: string[] }>>}
   */
  async loadUsersMap() {
    const docs = await this.usuarioBotRepository.find({}, { sort: { telefono: 1 } });
    const map = new Map();
    for (const doc of docs) {
      const entry = this.toEntry(doc);
      if (entry) {
        map.set(doc.telefono, entry);
      }
    }
    return map;
  }

  /**
   * Carga inicial: si no hay documentos, inserta el listado legacy (equivalente al mapa hardcodeado).
   */
  async seedLegacyIfEmpty() {
    const count = await this.usuarioBotRepository.count({});
    if (count > 0) {
      return { seeded: false, count: 0 };
    }
    await this.usuarioBotRepository.createMany(LEGACY_USUARIOS);
    return { seeded: true, count: LEGACY_USUARIOS.length };
  }
}

module.exports = UsuarioBotService;

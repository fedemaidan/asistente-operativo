const { db, admin } = require('./firebase/firebaseUtils');

class ProveedoresService {
    constructor() {
        this.collection = db.collection('f_proveedores'); // Nombre de la colección en Firebase
    }

    // Obtener todos los proveedores desde Firebase
    async obtenerProveedores() {
        try {
            const snapshot = await this.collection.get();
            if (snapshot.empty) {
                console.log('No se encontraron proveedores.');
                return [];
            }

            const proveedores = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            return proveedores;
        } catch (error) {
            console.error('Error obteniendo proveedores desde Firebase:', error);
            return [];
        }
    }

    // Agregar un nuevo proveedor
    async agregarProveedor(nombre) {
        try {
            const nuevoProveedor = {
                nombre: nombre,
                creadoEn: admin.firestore.FieldValue.serverTimestamp(),
            };

            const docRef = await this.collection.add(nuevoProveedor);
            console.log(`Proveedor agregado con ID: ${docRef.id}`);

            return { id: docRef.id, ...nuevoProveedor };
        } catch (error) {
            console.error('Error agregando proveedor:', error);
            return null;
        }
    }

    // Eliminar un proveedor por su ID
    async eliminarProveedor(id) {
        try {
            await this.collection.doc(id).delete();
            console.log(`Proveedor con ID ${id} eliminado correctamente.`);
            return true;
        } catch (error) {
            console.error('Error eliminando proveedor:', error);
            return false;
        }
    }
}

module.exports = new ProveedoresService();

const { Pool } = require('pg');

const pool = new Pool({
    user: "sorby_development",
    host: 'localhost',
    database: 'sorby_development',
    password: "sorby_development",
    port: 5432,
});

(async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('Conexión exitosa:', res.rows[0]);
    } catch (err) {
        console.error('Error conectando a la base de datos:', err.message);
    } finally {
        await pool.end();
    }
})();

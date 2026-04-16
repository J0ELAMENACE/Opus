require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// ── INIT DB ──
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id          TEXT PRIMARY KEY,
      cat         TEXT NOT NULL CHECK (cat IN ('game','movie','series','anime','book')),
      title       TEXT NOT NULL,
      creator     TEXT,
      year        TEXT,
      cover       TEXT,
      genre       TEXT,
      status      TEXT NOT NULL DEFAULT 'todo'
                  CHECK (status IN ('todo','doing','done','dropped')),
      rating      INTEGER NOT NULL DEFAULT 0
                  CHECK (rating BETWEEN 0 AND 5),
      note        TEXT,
      added       BIGINT NOT NULL DEFAULT extract(epoch from now())*1000
    )
  `);
  console.log('✅ Table "items" prête');
}

// ── ROUTES ──

// GET tous les items
app.get('/api/items', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items ORDER BY added DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET un item
app.get('/api/items/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST créer
app.post('/api/items', async (req, res) => {
  try {
    const { id, cat, title, creator, year, cover, genre, status, rating, note, added } = req.body;
    if (!id || !cat || !title) return res.status(400).json({ error: 'id, cat, title requis' });
    const { rows } = await pool.query(
      `INSERT INTO items (id,cat,title,creator,year,cover,genre,status,rating,note,added)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [id, cat, title, creator||null, year||null, cover||null, genre||null,
       status||'todo', rating||0, note||null, added||Date.now()]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT modifier
app.put('/api/items/:id', async (req, res) => {
  try {
    const { cat, title, creator, year, cover, genre, status, rating, note } = req.body;
    const { rows } = await pool.query(
      `UPDATE items
       SET cat=$1, title=$2, creator=$3, year=$4, cover=$5,
           genre=$6, status=$7, rating=$8, note=$9
       WHERE id=$10 RETURNING *`,
      [cat, title, creator||null, year||null, cover||null, genre||null,
       status, rating||0, note||null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE supprimer
app.delete('/api/items/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM items WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── START ──
const PORT = process.env.PORT || 3001;
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 API Opus démarrée sur le port ${PORT}`));
}).catch(e => {
  console.error('❌ Erreur init DB:', e.message);
  process.exit(1);
});

require('dotenv').config();
const express   = require('express');
const { Pool }  = require('pg');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

/* ─── VALIDATION DÉMARRAGE ── */
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL manquant dans .env');
  process.exit(1);
}
if (!process.env.CORS_ORIGIN) {
  console.error('❌ CORS_ORIGIN manquant dans .env');
  process.exit(1);
}

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/* ─── MIDDLEWARES ── */
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json({ limit: '50kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

/* ─── VALIDATION ── */
const VALID_CATS     = new Set(['game', 'movie', 'series', 'anime', 'book']);
const VALID_STATUSES = new Set(['todo', 'doing', 'done', 'dropped']);

function validateItemBody(body) {
  const { id, cat, title, status, rating } = body;
  if (!id || typeof id !== 'string' || id.length > 64)          return 'id invalide';
  if (!title || typeof title !== 'string' || title.length > 500) return 'title invalide';
  if (!VALID_CATS.has(cat))                                      return 'cat invalide';
  if (status && !VALID_STATUSES.has(status))                     return 'status invalide';
  if (rating != null && (rating < 0 || rating > 5 || !Number.isInteger(+rating))) return 'rating invalide (0-5)';
  return null;
}

/* ─── INIT DB ── */
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

/* ─── ROUTES ── */

app.get('/api/items', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items ORDER BY added DESC');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/items', async (req, res) => {
  const err = validateItemBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const { id, cat, title, creator, year, cover, genre, status, rating, note, added } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO items (id,cat,title,creator,year,cover,genre,status,rating,note,added)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [id, cat, title, creator||null, year||null, cover||null, genre||null,
       status||'todo', rating||0, note||null, added||Date.now()]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Item déjà existant' });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.put('/api/items/:id', async (req, res) => {
  const err = validateItemBody({ id: req.params.id, ...req.body });
  if (err) return res.status(400).json({ error: err });

  const { cat, title, creator, year, cover, genre, status, rating, note } = req.body;
  try {
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
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM items WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

/* ─── DÉMARRAGE ── */
const PORT = process.env.PORT || 3001;
initDB()
  .then(() => app.listen(PORT, () => console.log(`🚀 API Opus sur le port ${PORT}`)))
  .catch(e => {
    console.error('❌ Erreur init DB:', e.message);
    process.exit(1);
  });

// Minimal, dependency-free JSON-file "database".
// Chosen over sqlite/postgres so the backend runs anywhere with just
// `npm install && npm start` — no native build tools, no external DB server.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_SHAPE = {
  users: [],
  pets: [],
  careItems: [],
  vaccines: [],
  weightLogs: [],
  conditions: [],
  vetNotes: [],
  products: [],
  scanHistory: [],
  priceNotes: [],
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_SHAPE, null, 2));
  }
}

function load() {
  ensureFile();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SHAPE, ...parsed };
  } catch (err) {
    console.error('db.json bozuk görünüyor, varsayılan şema ile başlatılıyor.', err);
    return { ...DEFAULT_SHAPE };
  }
}

let state = load();
let writeTimer = null;

function persist() {
  // Debounce disk writes so bursts of updates don't thrash the filesystem.
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
    writeTimer = null;
  }, 25);
}

function persistNow() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

const db = {
  all(table) {
    if (!state[table]) state[table] = [];
    return state[table];
  },
  find(table, predicate) {
    return db.all(table).find(predicate);
  },
  filter(table, predicate) {
    return db.all(table).filter(predicate);
  },
  insert(table, row) {
    db.all(table).push(row);
    persist();
    return row;
  },
  update(table, id, patch) {
    const list = db.all(table);
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    persist();
    return list[idx];
  },
  remove(table, id) {
    const list = db.all(table);
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    persist();
    return true;
  },
  removeWhere(table, predicate) {
    const list = db.all(table);
    const remaining = list.filter((r) => !predicate(r));
    const removedCount = list.length - remaining.length;
    state[table] = remaining;
    persist();
    return removedCount;
  },
  replaceAll(table, rows) {
    state[table] = rows;
    persist();
  },
  raw() {
    return state;
  },
  reload() {
    state = load();
  },
  persistNow,
};

module.exports = db;

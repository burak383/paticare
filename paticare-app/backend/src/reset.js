// Deletes the local JSON database and reseeds it with demo data.
// Run with: npm run seed:reset
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');
if (fs.existsSync(DB_FILE)) {
  fs.unlinkSync(DB_FILE);
  console.log('Eski veritabanı silindi.');
}

const seed = require('./seed');
seed();
console.log('Veritabanı yeniden oluşturuldu.');

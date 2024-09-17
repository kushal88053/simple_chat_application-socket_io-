const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Return a promise-based database connection
const sqlconnect = async () => {
    const db = await open({
        filename: 'chat.db',
        driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_offset TEXT UNIQUE,
          content TEXT,
          sender TEXT

      );
    `);

    return db; // Make sure db supports db.all(), db.run(), etc.
};

module.exports = sqlconnect;

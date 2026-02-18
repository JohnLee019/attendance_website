import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { SEED_SEATS } from "./seedSeats.js";

const dataDir = path.join(process.cwd(), "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "attendance.db");

export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS Person (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    displayOrder INTEGER NOT NULL UNIQUE,
    color INTEGER NOT NULL DEFAULT 0,
    memo TEXT
  );
`); // color: 0 = black, 1 = blue

db.exec(`
  CREATE TABLE IF NOT EXISTS Seat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seatNo INTEGER NOT NULL UNIQUE,
    personId INTEGER,
    r INTEGER NOT NULL,
    c INTEGER NOT NULL,
    rs INTEGER NOT NULL,
    cs INTEGER NOT NULL,
    FOREIGN KEY (personId) REFERENCES Person(id)
      ON DELETE SET NULL
  );
`);

function seedSeatsIfEmpty() {
  const row = db.prepare(`SELECT COUNT(*) AS cnt FROM Seat;`).get();

  if (row.cnt > 0) return;

  const insert = db.prepare(`
    INSERT INTO Seat (seatNo, personId, r, c, rs, cs)
    VALUES (@seatNo, NULL, @r, @c, @rs, @cs);
  `);

  const insertMany = db.transaction((seats) => {
    for (const s of seats) {
      insert.run(s);
    }
  });

  insertMany(SEED_SEATS);
}

seedSeatsIfEmpty();

db.exec(`
  CREATE TABLE IF NOT EXISTS Attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    seatId INTEGER NOT NULL,
    personId INTEGER,
    present INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (seatId) REFERENCES Seat(id)
      ON DELETE SET NULL,
    FOREIGN KEY (personId) REFERENCES Person(id)
      ON DELETE SET NULL,

    UNIQUE(date, seatId)
  );
`);

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { SEED_SEATS, SeatSeed } from "./seedSeats";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

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
`); //color은 0은 black, 1은 blue

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
  const row = db.prepare(`SELECT COUNT(*) AS cnt FROM Seat;`).get() as { cnt: number};
  if (row.cnt > 0) return;

  const insert = db.prepare(`
    INSERT INTO Seat (seatNo, personId, r, c, rs, cs)
    VALUES (@seatNo, NULL, @r, @c, @rs, @cs);
    `)

  const insertMany = db.transaction((seats: SeatSeed[]) => {
    for (const s of seats) insert.run(s);
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
`); //present에서 미 참석시 0, 참석시 1

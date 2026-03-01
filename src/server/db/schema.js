import { pool } from "./connection.js";

export async function initSchema() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Person (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      color INTEGER NOT NULL DEFAULT 0,
      memo TEXT DEFAULT ''
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Seat (
      id SERIAL PRIMARY KEY,
      seatNo INTEGER NOT NULL UNIQUE,
      personId INTEGER NOT NULL REFERENCES Person(id) ON DELETE RESTRICT,
      r INTEGER NOT NULL,
      c INTEGER NOT NULL,
      rs INTEGER NOT NULL,
      cs INTEGER NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Attendance (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      seatId INTEGER NOT NULL REFERENCES Seat(id) ON DELETE CASCADE,
      present INTEGER NOT NULL DEFAULT 0,
      UNIQUE(date, seatId)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ReportEmails (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      isActive INTEGER DEFAULT 0
    );
  `);
}
import { pool } from "./connection.js";
import { SEED_SEATS } from "../seedSeats.js";

export async function seedSeatsIfEmpty() {

  // Seat 테이블이 비어있는지 확인
  const { rows } = await pool.query(`
    SELECT COUNT(*) AS cnt FROM Seat
  `);

  if (Number(rows[0].cnt) > 0) return;

  for (const s of SEED_SEATS) {

    // 1️⃣ Person 생성
    const personResult = await pool.query(`
      INSERT INTO Person (name, color, memo)
      VALUES ('', 0, '')
      RETURNING id
    `);

    const personId = personResult.rows[0].id;

    // 2️⃣ Seat 생성
    await pool.query(`
      INSERT INTO Seat (seatNo, personId, r, c, rs, cs)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      s.seatNo,
      personId,
      s.r,
      s.c,
      s.rs,
      s.cs
    ]);
  }
}
import { pool } from "./connection.js";
import { SEED_SEATS } from "../seedSeats.js";

export async function seedSeatsIfEmpty() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(`SELECT COUNT(*) AS cnt FROM Seat`);
    if (Number(rows[0].cnt) > 0) {
      await client.query("ROLLBACK");
      return;
    }

    for (const s of SEED_SEATS) {
      const p = await client.query(
        `INSERT INTO Person (name, color, memo) VALUES ('', 0, '') RETURNING id`
      );
      await client.query(
        `INSERT INTO Seat (seatNo, personId, r, c, rs, cs) VALUES ($1,$2,$3,$4,$5,$6)`,
        [s.seatNo, p.rows[0].id, s.r, s.c, s.rs, s.cs]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
import { pool } from "./connection.js";

export async function getSeatsByDate(date) {
  const { rows } = await pool.query(`
    SELECT
      s.id,
      s.seatNo as "seatNo",
      p.id AS "personId",
      p.name AS "personName",
      p.memo AS "memo",
      p.color AS "color",
      COALESCE(a.present, 0) AS present
    FROM Seat s
    LEFT JOIN Person p ON p.id = s.personId
    LEFT JOIN Attendance a 
      ON a.seatId = s.id AND a.date = $1
    ORDER BY s.seatNo ASC
  `, [date]);

  return rows;
}
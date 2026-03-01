import { pool } from "./connection.js";
import { getTodayDate } from "../utils/date.js";


// 🔹 오늘 출석 행 자동 생성
export async function ensureTodayAttendanceRows() {

  const today = getTodayDate();

  // personId가 있는 좌석만
  const { rows: seats } = await pool.query(`
    SELECT id AS "seatId"
    FROM Seat
    WHERE personId IS NOT NULL
  `);

  for (const s of seats) {
    await pool.query(`
      INSERT INTO Attendance (seatId, date, present)
      VALUES ($1, $2, 0)
      ON CONFLICT(date, seatId) DO NOTHING
    `, [s.seatId, today]);
  }
}


// 🔹 하루 출석 조회
export async function getDailyAttendance(date) {

  const { rows } = await pool.query(`
    SELECT 
      p.name AS "personName",
      COALESCE(a.present, 0) AS present
    FROM Seat s
    JOIN Person p ON p.id = s.personId
    LEFT JOIN Attendance a
      ON a.seatId = s.id AND a.date = $1
    WHERE p.name <> ''
    ORDER BY LOWER(p.name) ASC
  `, [date]);

  return rows;
}


// 🔹 월간 출석 조회
export async function getMonthlyAttendance(start, end) {

  // 한 명이라도 출석한 날짜를 총일수로 계산
  const { rows: totalDaysRows } = await pool.query(`
    SELECT COUNT(DISTINCT date) AS "totalDays"
    FROM Attendance
    WHERE date BETWEEN $1 AND $2
      AND present = 1
  `, [start, end]);

  const totalDays = Number(totalDaysRows[0]?.totalDays) || 0;

  const { rows } = await pool.query(`
    SELECT
      p.id,
      p.name AS "personName",
      COALESCE(SUM(a.present), 0) AS "totalPresent"
    FROM Person p
    JOIN Seat s ON s.personId = p.id
    LEFT JOIN Attendance a
      ON a.seatId = s.id
      AND a.date BETWEEN $1 AND $2
    WHERE p.name <> ''
    GROUP BY p.id
    ORDER BY LOWER(p.name) ASC
  `, [start, end]);

  return rows.map(r => ({
    personName: r.personName,
    totalPresent: Number(r.totalPresent),
    totalDays
  }));
}


// 🔹 메모 업데이트
export async function updatePersonMemo(personId, memo) {

  await pool.query(`
    UPDATE Person
    SET memo = $1
    WHERE id = $2
  `, [memo ?? "", personId]);
}

// 이름 업데이트
export async function updatePersonName(personId, name) {
  await pool.query(`
    UPDATE Person
    SET name = $1
    WHERE id = $2
  `, [name ?? "", personId]);
}

// 색깔 변경
export async function updatePersonColor(personId, color) {
  await pool.query(
    `UPDATE Person
     SET color = $1
     WHERE id = $2`,
    [color ?? 0, personId]
  );
}
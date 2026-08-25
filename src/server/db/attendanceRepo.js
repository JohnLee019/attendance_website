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

  await Promise.all(
    seats.map(s =>
      pool.query(`
        INSERT INTO Attendance (seatId, date, present)
        VALUES ($1, $2, 0)
        ON CONFLICT(date, seatId) DO NOTHING
      `, [s.seatId, today])
    )
  );
}


// 🔹 출석 기록이 있는 연도들 (최신순)
//
// 월 별 출석표의 연도 고르개를 채우는 데 쓴다. 있지도 않은 연도를 늘어놓지 않으려고
// 임의의 범위를 정하는 대신 실제로 행이 있는 연도만 내려준다.
export async function getAttendanceYears() {
  const { rows } = await pool.query(`
    SELECT DISTINCT LEFT(date, 4) AS "year"
    FROM Attendance
    ORDER BY 1 DESC
  `);

  return rows.map(r => Number(r.year)).filter(Number.isInteger);
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
    ORDER BY p.sortOrder NULLS LAST, s.seatNo
  `, [date]);

  return rows;
}


// 🔹 월간 출석 조회
export async function getMonthlyAttendance(start, end) {

  const { rows } = await pool.query(`
    SELECT
      p.id AS "personId",
      p.name AS "personName",
      s.seatNo AS "seatNo",
      a.date,
      a.present
    FROM Seat s
    JOIN Person p ON p.id = s.personId
    LEFT JOIN Attendance a
      ON a.seatId = s.id
      AND a.date BETWEEN $1 AND $2
    WHERE p.name <> ''
    ORDER BY p.sortOrder NULLS LAST, s.seatNo
  `, [start, end]);

  // 일반 객체를 쓰면 안 된다. personId 가 숫자라 정수 키가 되고,
  // Object.values 는 정수 키를 오름차순으로 재정렬해서 위 ORDER BY 를 통째로 무시한다.
  // Map 은 넣은 순서를 그대로 지킨다.
  const map = new Map();

  for (const r of rows) {

    if (!map.has(r.personId)) {
      map.set(r.personId, {
        seatNo: r.seatNo,
        name: r.personName,
        days: []
      });
    }

    if (r.present === 1 && r.date) {
      map.get(r.personId).days.push(r.date);
    }
  }

  return [...map.values()];
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

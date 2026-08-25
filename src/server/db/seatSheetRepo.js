import { pool } from "./connection.js";

// 새 기록지에 기본으로 깔리는 표시.
//
// 대리 수령만 메모를 묻는다 — 누가 대신 가져갔는지 적어야 하기 때문.
//
// 어떤 표시도 출석부를 건드리지 않는다. 예전에는 '본인 수령'이 출석까지 켰는데,
// 기록지에서 버튼 하나 눌렀을 뿐인데 출석부가 조용히 바뀌는 게 화근이었다 —
// 어느 쪽이 원본인지 알 수 없게 된다. 기록지와 출석부는 서로 남남이다.
export const DEFAULT_MARKS = [
  { label: "본인 수령", color: "#2e7d32", needsNote: 0 },
  { label: "대리 수령", color: "#5e35b1", needsNote: 1 }
];

// 직접 만든 표시에 돌아가며 주는 색. 기본 표시 두 개와 겹치지 않게 골랐다.
const MARK_COLORS = [
  "#ef6c00", "#0277bd", "#c2185b", "#00838f", "#6d4c41", "#558b2f", "#4527a0"
];

// copyAttendance 가 true 면 sheetDate 의 출석부를 베껴 와서 시작한다 —
// 출석으로 찍혀 있는 좌석에 첫 번째 표시('본인 수령')를 미리 찍어 둔다.
//
// 출석부를 읽기만 하는 한 방향 복사다. 만든 뒤로는 두 쪽이 완전히 따로 논다 —
// 기록지에서 표시를 바꿔도 출석부는 그대로고, 출석부를 고쳐도 기록지는 그대로다.
export async function createSeatSheet(title, sheetDate, copyAttendance = false) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO SeatSheet (title, sheetDate) VALUES ($1, $2) RETURNING id`,
      [title, sheetDate]
    );

    const sheetId = rows[0].id;
    let firstMarkId = null;

    for (let i = 0; i < DEFAULT_MARKS.length; i++) {
      const m = DEFAULT_MARKS[i];

      const { rows: markRows } = await client.query(
        `INSERT INTO SeatSheetMark
           (sheetId, label, color, needsNote, sortOrder)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [sheetId, m.label, m.color, m.needsNote, i]
      );

      if (i === 0) firstMarkId = markRows[0].id;
    }

    if (copyAttendance && sheetDate && firstMarkId !== null) {
      await client.query(`
        INSERT INTO SeatSheetEntry (sheetId, seatId, markId, note)
        SELECT $1, s.id, $2, ''
        FROM Seat s
        JOIN Attendance a ON a.seatId = s.id AND a.date = $3
        WHERE a.present = 1
        ON CONFLICT (sheetId, seatId) DO NOTHING
      `, [sheetId, firstMarkId, sheetDate]);
    }

    await client.query("COMMIT");
    return sheetId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getSeatSheets() {
  const { rows } = await pool.query(`
    SELECT
      sh.id AS "id",
      sh.title AS "title",
      sh.sheetDate AS "sheetDate",
      COUNT(e.id) AS "markedCount"
    FROM SeatSheet sh
    LEFT JOIN SeatSheetEntry e ON e.sheetId = sh.id
    GROUP BY sh.id
    ORDER BY sh.createdAt DESC
  `);

  return rows.map(r => ({ ...r, markedCount: Number(r.markedCount) }));
}

// 기록지 자체를 못 찾으면 null. 있으면 제목과 날짜를 함께 준다.
export async function getSeatSheet(sheetId) {
  const { rows } = await pool.query(
    `SELECT title AS "title", sheetDate AS "sheetDate"
     FROM SeatSheet WHERE id = $1`,
    [sheetId]
  );

  return rows[0] ?? null;
}

export async function getSeatSheetMarks(sheetId) {
  const { rows } = await pool.query(`
    SELECT
      id AS "id",
      label AS "label",
      color AS "color",
      needsNote AS "needsNote"
    FROM SeatSheetMark
    WHERE sheetId = $1
    ORDER BY sortOrder, id
  `, [sheetId]);

  return rows;
}

// 기록지 화면용 좌석 목록.
// 좌석은 항상 전부 내려준다 — 기록지는 빈 상태로 시작하고, 표시한 좌석만 Entry 행이 생긴다.
// markId 가 null 이면 미수령이고, 화면에도 아무 표시를 하지 않는다.
export async function getSeatSheetSeats(sheetId) {
  const { rows } = await pool.query(`
    SELECT
      s.id AS "id",
      s.seatNo AS "seatNo",
      p.id AS "personId",
      p.name AS "personName",
      p.color AS "color",
      e.markId AS "markId",
      COALESCE(e.note, '') AS "note"
    FROM Seat s
    LEFT JOIN Person p ON p.id = s.personId
    LEFT JOIN SeatSheetEntry e
      ON e.seatId = s.id AND e.sheetId = $1
    ORDER BY s.seatNo
  `, [sheetId]);

  return rows;
}

export async function addSeatSheetMark(sheetId, label, needsNote) {
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) AS n FROM SeatSheetMark WHERE sheetId = $1`,
    [sheetId]
  );

  const n = Number(countRows[0].n);
  const color = MARK_COLORS[n % MARK_COLORS.length];

  const { rows } = await pool.query(
    `INSERT INTO SeatSheetMark (sheetId, label, color, needsNote, sortOrder)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id AS "id", label AS "label", color AS "color",
               needsNote AS "needsNote"`,
    [sheetId, label, color, needsNote ? 1 : 0, n]
  );

  return rows[0];
}

// 표시를 지우면 그 표시가 찍힌 좌석도 함께 비워진다(Entry 의 ON DELETE CASCADE).
export async function deleteSeatSheetMark(sheetId, markId) {
  await pool.query(
    `DELETE FROM SeatSheetMark WHERE id = $1 AND sheetId = $2`,
    [markId, sheetId]
  );
}

// markId 가 null 이면 표시를 지운다(미수령으로 되돌린다).
export async function setSeatSheetEntry(sheetId, seatId, markId, note) {
  if (markId === null) {
    await pool.query(
      `DELETE FROM SeatSheetEntry WHERE sheetId = $1 AND seatId = $2`,
      [sheetId, seatId]
    );
    return;
  }

  await pool.query(`
    INSERT INTO SeatSheetEntry (sheetId, seatId, markId, note)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (sheetId, seatId)
    DO UPDATE SET markId = EXCLUDED.markId, note = EXCLUDED.note
  `, [sheetId, seatId, markId, note ?? ""]);
}

// 이 기록지에 속한 표시를 가져온다. 없으면 null.
// 다른 기록지의 markId 를 찍는 걸 막는 검사도 겸한다.
export async function getSheetMark(sheetId, markId) {
  const { rows } = await pool.query(
    `SELECT id AS "id", label AS "label"
     FROM SeatSheetMark WHERE id = $1 AND sheetId = $2`,
    [markId, sheetId]
  );

  return rows[0] ?? null;
}

export async function deleteSeatSheet(sheetId) {
  await pool.query(`DELETE FROM SeatSheet WHERE id = $1`, [sheetId]);
}

// 이미 만든 표시의 이름·색·메모 여부를 고친다.
export async function updateSeatSheetMark(sheetId, markId, label, color, needsNote) {
  const { rows } = await pool.query(
    `UPDATE SeatSheetMark
     SET label = $3, color = $4, needsNote = $5
     WHERE id = $1 AND sheetId = $2
     RETURNING id AS "id", label AS "label", color AS "color",
               needsNote AS "needsNote"`,
    [markId, sheetId, label, color, needsNote ? 1 : 0]
  );

  return rows[0] ?? null;
}

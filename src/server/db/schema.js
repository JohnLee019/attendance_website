import { pool } from "./connection.js";
import { DEFAULT_MARKS } from "./seatSheetRepo.js";

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

  // 월간 리포트 발송 이력.
  // period = 발송 대상 연월('YYYY-MM'), status = sent | empty | baseline | failed
  await pool.query(`
    CREATE TABLE IF NOT EXISTS MailLog (
      id SERIAL PRIMARY KEY,
      period TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_maillog_period ON MailLog(period);
  `);

  // 월간 출석부 엑셀의 열 구성. 설정은 한 벌뿐이라 id = 1 한 행만 산다.
  // 기본값은 이 기능이 생기기 전의 엑셀과 같다 — 아무도 손대지 않으면 리포트가 그대로다.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ExcelFormat (
      id INTEGER PRIMARY KEY,
      showSeatNo INTEGER NOT NULL DEFAULT 0,
      showTotal INTEGER NOT NULL DEFAULT 1,
      showRate INTEGER NOT NULL DEFAULT 1,
      presentMark TEXT NOT NULL DEFAULT '0'
    );
  `);

  await pool.query(`
    INSERT INTO ExcelFormat (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING;
  `);

  // 엑셀에 이름이 나오는 순서. NULL 이면 아직 사용자가 정하지 않은 사람이라
  // 정렬에서 맨 뒤로 밀린다(dbInit 이 좌석번호로 한 번 채워준다).
  await pool.query(`
    ALTER TABLE Person ADD COLUMN IF NOT EXISTS sortOrder INTEGER;
  `);

  // 좌석 기록지 — 반찬 배부처럼 "출석과는 별개로" 좌석 단위 체크가 필요한 기록.
  // 출석부(Attendance)와 완전히 분리돼 있어서, 출석하지 않은 사람도 체크할 수 있고
  // 여기 남긴 메모는 Person.memo 를 건드리지 않는다.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS SeatSheet (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 기록지에서 쓸 표시(버튼). 기록지마다 따로 산다 —
  // 어떤 날은 '본인 수령/대리 수령'만, 어떤 날은 '김치 받음' 같은 표시를 더 만들 수 있다.
  // 새 기록지에는 '본인 수령'과 '대리 수령'이 기본으로 깔린다.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS SeatSheetMark (
      id SERIAL PRIMARY KEY,
      sheetId INTEGER NOT NULL REFERENCES SeatSheet(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#555555',
      needsNote INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sheetmark_sheet ON SeatSheetMark(sheetId);
  `);

  // 이 기록지가 어느 날짜의 출석에 반영되는지. 만든 날(KST)로 고정된다.
  await pool.query(`
    ALTER TABLE SeatSheet ADD COLUMN IF NOT EXISTS sheetDate TEXT;
  `);

  // 예전에는 여기에 marksAttendance 컬럼이 있었다 — 표시를 찍으면 출석부에도
  // 출석으로 기록하는 장치였는데, 기록지와 출석부를 떼어 놓으면서 쓰지 않게 됐다.
  // 이미 만들어진 DB 의 컬럼은 그대로 둔다(기본값이 있어 남아 있어도 해가 없고,
  // DROP 은 되돌릴 수 없다). 새로 만드는 DB 에는 아예 생기지 않는다.

  // 좌석에 찍힌 표시. 행이 없으면 '미수령' — 아무 표시도 하지 않는다.
  // note = 대리 수령일 때 "누가 가져갔는지". 이 기록지 안에서만 산다.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS SeatSheetEntry (
      id SERIAL PRIMARY KEY,
      sheetId INTEGER NOT NULL REFERENCES SeatSheet(id) ON DELETE CASCADE,
      seatId INTEGER NOT NULL REFERENCES Seat(id) ON DELETE CASCADE,
      markId INTEGER NOT NULL REFERENCES SeatSheetMark(id) ON DELETE CASCADE,
      note TEXT NOT NULL DEFAULT '',
      UNIQUE(sheetId, seatId)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sheetentry_sheet ON SeatSheetEntry(sheetId);
  `);

  await seedMissingSheetMarks();
  await migrateSheetEntriesToMarks();
  await backfillSheetDates();
}

// 날짜 컬럼이 생기기 전에 만든 기록지는 만든 시각에서 날짜를 끌어온다.
// createdAt 은 TIMESTAMPTZ 라 KST 로 바꿔서 읽어야 날짜가 하루 어긋나지 않는다.
async function backfillSheetDates() {
  await pool.query(`
    UPDATE SeatSheet
    SET sheetDate = to_char(createdAt AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
    WHERE sheetDate IS NULL
  `);
}

// 표시가 하나도 없는 기록지에 기본 표시를 깔아준다.
//
// 기록지 기능의 첫 버전에는 표시 개념이 없었다(수령 상태가 0/1/2 로 박혀 있었다).
// 그때 만든 기록지를 열면 버튼이 하나도 뜨지 않으므로 여기서 채워 넣는다.
async function seedMissingSheetMarks() {
  const { rows } = await pool.query(`
    SELECT sh.id
    FROM SeatSheet sh
    LEFT JOIN SeatSheetMark m ON m.sheetId = sh.id
    WHERE m.id IS NULL
  `);

  for (const { id } of rows) {
    for (let i = 0; i < DEFAULT_MARKS.length; i++) {
      const mark = DEFAULT_MARKS[i];

      await pool.query(
        `INSERT INTO SeatSheetMark (sheetId, label, color, needsNote, sortOrder)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, mark.label, mark.color, mark.needsNote, i]
      );
    }
  }
}

// 첫 버전의 SeatSheetEntry.state(0 미수령 / 1 본인 수령 / 2 대리 수령)를
// markId 로 옮긴다.
//
// CREATE TABLE IF NOT EXISTS 는 이미 있는 테이블을 고쳐 주지 않아서,
// 이 마이그레이션이 없으면 옛 테이블에 markId 가 없는 채로 남아 조회가 통째로 실패한다.
async function migrateSheetEntriesToMarks() {
  const { rows } = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'seatsheetentry'
  `);

  const columns = new Set(rows.map(r => r.column_name));

  if (!columns.has("state")) return;   // 이미 새 구조

  if (!columns.has("markid")) {
    await pool.query(`
      ALTER TABLE SeatSheetEntry
      ADD COLUMN markId INTEGER REFERENCES SeatSheetMark(id) ON DELETE CASCADE
    `);
  }

  // state 1 → 그 기록지의 첫 번째 기본 표시(본인 수령)
  // state 2 → 두 번째 기본 표시(대리 수령)
  await pool.query(`
    UPDATE SeatSheetEntry e
    SET markId = m.id
    FROM SeatSheetMark m
    WHERE m.sheetId = e.sheetId
      AND m.sortOrder = e.state - 1
      AND e.state > 0
      AND e.markId IS NULL
  `);

  // state = 0 은 미수령이고, 새 구조에서는 행 자체가 없는 것으로 표현한다.
  await pool.query(`DELETE FROM SeatSheetEntry WHERE markId IS NULL`);

  await pool.query(`ALTER TABLE SeatSheetEntry ALTER COLUMN markId SET NOT NULL`);
  await pool.query(`ALTER TABLE SeatSheetEntry DROP COLUMN state`);

  console.log("SeatSheetEntry 를 표시(mark) 구조로 옮겼습니다");
}
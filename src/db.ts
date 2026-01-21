import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "attendance.db");
export const db = new Database(dbPath);

//비어 있으면 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS Seat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seatNo INTEGER NOT NULL UNIQUE
  );
`);

//테스트 데이터
const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM Seat;`).get() as { cnt: number };
if (countRow.cnt === 0) {
  const insert = db.prepare(`INSERT INTO Seat (seatNo) VALUES (?);`);
  const tx = db.transaction((n: number) => {
    for (let i = 1; i <= n; i++) insert.run(i);
  });
  tx(12);
}

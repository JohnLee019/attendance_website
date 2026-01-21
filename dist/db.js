"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
// src/db.ts
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dataDir = path_1.default.join(process.cwd(), "data");
if (!fs_1.default.existsSync(dataDir))
    fs_1.default.mkdirSync(dataDir, { recursive: true });
const dbPath = path_1.default.join(dataDir, "attendance.db");
exports.db = new better_sqlite3_1.default(dbPath);
// 1) 테이블 생성 (없으면)
exports.db.exec(`
  CREATE TABLE IF NOT EXISTS Seat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seatNo INTEGER NOT NULL UNIQUE
  );
`);
// 2) 테스트 데이터: 비어있으면 1~12 좌석 자동 생성
const countRow = exports.db.prepare(`SELECT COUNT(*) as cnt FROM Seat;`).get();
if (countRow.cnt === 0) {
    const insert = exports.db.prepare(`INSERT INTO Seat (seatNo) VALUES (?);`);
    const tx = exports.db.transaction((n) => {
        for (let i = 1; i <= n; i++)
            insert.run(i);
    });
    tx(12);
}

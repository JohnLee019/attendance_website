import express from "express";
import dotenv from "dotenv";
dotenv.config(); 

process.on("uncaughtException", err => {
  console.error("UNCAUGHT:", err);
});

process.on("unhandledRejection", err => {
  console.error("UNHANDLED:", err);
});

import session from "express-session";
import cron from "node-cron";

import { initSchema } from "./db/schema.js";
import { seedSeatsIfEmpty } from "./db/seed.js";
import { getTodayDate, getLastMonthRange } from "./utils/date.js";
import { sendMonthlyExcel, sendTodayExcel } from "./mailer.js";
import { getSeatsByDate } from "./db/seatRepo.js";
import {addReportEmail, getReportEmails, setActiveEmail, deleteReportEmail} from "./db/emailRepo.js";
import { ensureTodayAttendanceRows, updatePersonMemo, updatePersonName, updatePersonColor, getMonthlyAttendance } from "./db/attendanceRepo.js";
import { pool } from "./db/connection.js";

const app = express();

async function startServer() {
  await initSchema();
  await seedSeatsIfEmpty();

  app.use(express.json());

  app.set("trust proxy", 1);

  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    }
  }));

  app.use("/login.html", express.static("public/login.html"));
  app.use("/client/login.js", express.static("public/client/login.js"));
  app.use("/index.css", express.static("public/index.css"));

  app.use((req, res, next) => {
    if (req.path === "/login.html" || req.path === "/api/login") {
      return next();
    }

    if (!req.session.authenticated) {
      if (req.path.startsWith("/api")) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      return res.redirect("/login.html");
    }

    next();
  });

  app.use(express.static("public"));

  // 로그인
  app.post("/api/login", async (req, res) => {
    const { password } = req.body;

    if (password === process.env.ADMIN_PASSWORD) {
      req.session.authenticated = true;
      return res.json({ success: true });
    }

    res.status(401).json({ message: "비밀번호 틀림" });
  });

  // 좌석 조회
  app.get("/api/seats", async (req, res) => {
    const date = getTodayDate();
    const rows = await getSeatsByDate(date);
    res.json(rows);
  });

  // 오늘 출석 토글
  app.patch("/api/seatattendance/:id", async (req, res) => {
    const seatId = Number(req.params.id);
    const date = getTodayDate();

    const { rows } = await pool.query(
      `SELECT present FROM Attendance
       WHERE seatId = $1 AND date = $2`,
      [seatId, date]
    );

    const current = rows[0];
    const newPresent = current?.present === 1 ? 0 : 1;

    await pool.query(
      `INSERT INTO Attendance (seatId, date, present)
       VALUES ($1, $2, $3)
       ON CONFLICT(date, seatId)
       DO UPDATE SET present = EXCLUDED.present`,
      [seatId, date, newPresent]
    );

    res.json({ isPresent: newPresent === 1 });
  });

  // 메모
  app.patch("/api/person/:id/memo", async (req, res) => {
    const personId = Number(req.params.id);
    const { memo } = req.body;

    await updatePersonMemo(personId, memo);
    res.json({ success: true });
  });

  // 오늘 통계
  app.get("/api/todayAttendanceStats", async (req, res) => {
    const date = getTodayDate();

    const { rows } = await pool.query(`
      SELECT
        COUNT(s.id) AS total,
        SUM(CASE WHEN a.present = 1 THEN 1 ELSE 0 END) AS present
      FROM Seat s
      LEFT JOIN Attendance a
        ON a.seatId = s.id AND a.date = $1
    `, [date]);

    const total = Number(rows[0].total) || 0;
    const present = Number(rows[0].present) || 0;

    const percent = total === 0
      ? 0
      : Math.round((present / total) * 100);

    res.json({ total, present, percent });
  });

  // 이메일 관리
  app.get("/api/report-emails", async (req, res) => {
    const rows = await getReportEmails();
    res.json(rows);
  });

  app.post("/api/report-emails", async (req, res) => {
    await addReportEmail(req.body.email);
    res.json({ success: true });
  });

  app.post("/api/report-emails/activate", async (req, res) => {
    await setActiveEmail(req.body.id);
    res.json({ success: true });
  });

  app.delete("/api/report-emails/:id", async (req, res) => {
    await deleteReportEmail(Number(req.params.id));
    res.json({ success: true });
  });

  // 엑셀
  app.post("/api/sendTodayExcel", async (req, res) => {
    const date = getTodayDate();
    await sendTodayExcel(date);
    res.json({ success: true });
  });

  app.post("/api/sendDateExcel", async (req, res) => {
    const { date } = req.body;
    const result = await sendTodayExcel(date);

    if (result?.empty) {
      return res.status(400).json({ message: "출석 데이터 없음" });
    }

    res.json({ success: true });
  });

  app.post("/api/sendLastMonthReport", async (req, res) => {
    const { start, end, year, month } = getLastMonthRange();
    const result = await sendMonthlyExcel(start, end, year, month);

    if (result?.empty) {
      return res.status(400).json({ message: "데이터 없음" });
    }

    res.json({ success: true });
  });

  // 특정 날짜 조회
  app.get("/api/attendance", async (req, res) => {
    const { date } = req.query;

    const { rows } = await pool.query(`
      SELECT
        s.seatNo AS "seatNo",
        s.id AS "id",
        p.id AS "personId",
        p.name AS "personName",
        p.color AS "color",
        COALESCE(a.present, 0) AS "present",
        p.memo AS "memo"
      FROM Seat s
      LEFT JOIN Person p ON p.id = s.personId
      LEFT JOIN Attendance a
        ON a.seatId = s.id AND a.date = $1
      ORDER BY s.seatNo
    `, [date]);

    res.json(rows);
  });

  // 특정 날짜 수정
  app.patch("/api/attendance", async (req, res) => {
    const { seatId, date } = req.body;

    const { rows } = await pool.query(
      `SELECT present FROM Attendance
       WHERE seatId = $1 AND date = $2`,
      [seatId, date]
    );

    const newPresent = rows[0]?.present === 1 ? 0 : 1;

    await pool.query(
      `INSERT INTO Attendance (seatId, date, present)
       VALUES ($1, $2, $3)
       ON CONFLICT(date, seatId)
       DO UPDATE SET present = EXCLUDED.present`,
      [seatId, date, newPresent]
    );

    res.json({ present: newPresent });
  });

  // 이름 업데이트
  app.patch("/api/person/:id/name", async (req, res) => {
    const id = Number(req.params.id);
    const { name } = req.body;

    try {
      await updatePersonName(id, name);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update name" });
    }
  });

  // 색상 업데이트
  app.patch("/api/person/:id/color", async (req, res) => {
    const id = Number(req.params.id);
    const { color } = req.body;

    try {
      await updatePersonColor(id, color);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update color" });
    }
  });

  // 이번 달 출석 화면
  app.get("/api/currentMonthAttendance", async (req, res) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    const start = `${year}-${String(month).padStart(2,"0")}-01`;
    const end = `${year}-${String(month).padStart(2,"0")}-31`;

    const data = await getMonthlyAttendance(start, end);

    res.json({
      year,
      month,
      data
    });
  });


  // 가벼운 요청 처리용 API
  app.get("/api/ping", (req, res) => {
    res.send("pong");
  });


  // 크론
  cron.schedule("0 9 * * *", async () => {
    await ensureTodayAttendanceRows();
  });

  app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
  });
}

startServer();
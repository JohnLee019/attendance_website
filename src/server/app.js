import express from "express";
import dotenv from "dotenv";
dotenv.config(); 

process.on("uncaughtException", err => {
  console.error("UNCAUGHT:", err);

  // 포트 충돌은 삼키면 안 된다.
  // 살아남은 좀비 프로세스 때문에, 재시작해도 낡은 환경변수를 가진
  // 옛 서버가 계속 요청을 처리하는 상황이 생긴다.
  if (err.code === "EADDRINUSE") {
    console.error(`포트 ${process.env.PORT || 3000} 이미 사용 중 — 종료합니다.`);
    process.exit(1);
  }
});

process.on("unhandledRejection", err => {
  console.error("UNHANDLED:", err);
});

import session from "express-session";
import cron from "node-cron";

import { ensureDbReady } from "./dbInit.js";
import { getTodayDate, getLastMonthRange, getCurrentMonthRange, getMonthRange } from "./utils/date.js";
import { sendTodayExcel, sendMonthlyReportOnce, buildMonthlyWorkbook } from "./mailer.js";
import XLSX from "xlsx";
import { getSeatsByDate } from "./db/seatRepo.js";
import {addReportEmail, getReportEmails, setActiveEmail, deleteReportEmail} from "./db/emailRepo.js";
import { ensureTodayAttendanceRows, updatePersonMemo, updatePersonName, updatePersonColor, getMonthlyAttendance, getAttendanceYears } from "./db/attendanceRepo.js";
import { pool } from "./db/connection.js";
import { getPersonOrder, savePersonOrder } from "./db/personOrderRepo.js";
import { getExcelFormat, saveExcelFormat, normalizeExcelFormat } from "./db/excelFormatRepo.js";
import {
  createSeatSheet,
  getSeatSheets,
  getSeatSheet,
  getSeatSheetSeats,
  getSeatSheetMarks,
  addSeatSheetMark,
  updateSeatSheetMark,
  deleteSeatSheetMark,
  getSheetMark,
  setSeatSheetEntry,
  deleteSeatSheet
} from "./db/seatSheetRepo.js";

// 화면에서 고른 달을 읽는다. year·month 가 없으면 이번 달(KST)이다 —
// 화면을 처음 열었을 때와 '이번 달'을 골랐을 때가 같은 답을 내야 한다.
// 형식이 틀리면 null 을 돌려주고, 부르는 쪽에서 400 을 낸다.
function resolveMonthRange(req) {
  const { year, month } = req.query;

  if (year === undefined && month === undefined) {
    return getCurrentMonthRange();
  }

  const y = Number(year);
  const m = Number(month);

  const ok =
    Number.isInteger(y) && Number.isInteger(m) &&
    m >= 1 && m <= 12 && y >= 2000 && y <= 2100;

  return ok ? getMonthRange(y, m) : null;
}

const app = express();

async function startServer() {
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
    if (req.path === "/login.html" || req.path === "/api/login" || req.path === "/api/ping") {
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
    await ensureDbReady(); 
    const date = getTodayDate();
    const rows = await getSeatsByDate(date);
    res.json(rows);
  });

  // 오늘 출석 토글
  app.patch("/api/seatattendance/:id", async (req, res) => {
    await ensureDbReady();
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
    await ensureDbReady();
    const personId = Number(req.params.id);
    const { memo } = req.body;

    await updatePersonMemo(personId, memo);
    res.json({ success: true });
  });

  // 오늘 통계
  app.get("/api/todayAttendanceStats", async (req, res) => {
    await ensureDbReady();
    const date = getTodayDate();

    const { rows } = await pool.query(`
      SELECT
        COUNT(s.id) AS total,
        COUNT(*) FILTER (WHERE a.present = 1) AS present,
        COUNT(*) FILTER (WHERE a.present = 1 AND p.color = 1) AS direct
      FROM Seat s
      JOIN Person p ON p.id = s.personId
      LEFT JOIN Attendance a
        ON a.seatId = s.id AND a.date = $1
      WHERE p.name <> ''
    `, [date]);

    const total = Number(rows[0].total) || 0;
    const present = Number(rows[0].present) || 0;
    const direct = Number(rows[0].direct) || 0;

    res.json({
      total,
      present,
      direct,
      percent: total === 0 ? 0 : Math.round((present / total) * 100)
    });
  });

  // 이메일 관리
  app.get("/api/report-emails", async (req, res) => {
    await ensureDbReady();
    const rows = await getReportEmails();
    res.json(rows);
  });

  app.post("/api/report-emails", async (req, res) => {
    await ensureDbReady();
    await addReportEmail(req.body.email);
    res.json({ success: true });
  });

  app.post("/api/report-emails/activate", async (req, res) => {
    await ensureDbReady();
    await setActiveEmail(req.body.id);
    res.json({ success: true });
  });

  app.delete("/api/report-emails/:id", async (req, res) => {
    await ensureDbReady();
    await deleteReportEmail(Number(req.params.id));
    res.json({ success: true });
  });

  // 엑셀
  app.post("/api/sendTodayExcel", async (req, res) => {
    await ensureDbReady();
    const result = await sendTodayExcel(getTodayDate());

    if (result?.empty) {
      return res.status(400).json({ message: "출석 데이터 없음" });
    }

    res.json({ success: true });
  });

  app.post("/api/sendDateExcel", async (req, res) => {
    await ensureDbReady();
    const { date } = req.body;
    const result = await sendTodayExcel(date);

    if (result?.empty) {
      return res.status(400).json({ message: "출석 데이터 없음" });
    }

    res.json({ success: true });
  });

  app.post("/api/sendLastMonthReport", async (req, res) => {
    await ensureDbReady();
    const { year, month } = getLastMonthRange();

    // 수동 발송은 이력을 무시하고 항상 보낸다. 대신 결과는 기록되므로
    // 이 버튼으로 보낸 달은 부팅 보정이 중복 발송하지 않는다.
    const result = await sendMonthlyReportOnce(year, month, {
      force: true,
      noticeOnEmpty: false
    });

    if (result.status === "empty") {
      return res.status(400).json({ message: "저번 달 출석 데이터가 없습니다" });
    }

    res.json({ success: true });
  });

  // 특정 날짜 조회
  app.get("/api/attendance", async (req, res) => {
    await ensureDbReady();
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
    await ensureDbReady();
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
    await ensureDbReady();
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
    await ensureDbReady();
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

  // 월 별 출석 화면. year·month 를 주지 않으면 이번 달.
  app.get("/api/monthAttendance", async (req, res) => {
    await ensureDbReady();

    const range = resolveMonthRange(req);
    if (!range) {
      return res.status(400).json({ message: "잘못된 연월입니다" });
    }

    const { start, end, year, month } = range;
    const data = await getMonthlyAttendance(start, end);

    res.json({ year, month, data });
  });

  // 연도 고르개에 넣을, 출석 기록이 실제로 있는 연도들.
  app.get("/api/attendanceYears", async (req, res) => {
    await ensureDbReady();
    res.json(await getAttendanceYears());
  });

  // 고른 달의 출석부 엑셀 내려받기.
  //
  // 월간 리포트 메일과 같은 buildMonthlyWorkbook 을 쓴다 —
  // 화면에서 받은 파일과 메일로 온 파일의 모양이 달라지면 안 된다.
  app.get("/api/monthExcel", async (req, res) => {
    await ensureDbReady();

    const range = resolveMonthRange(req);
    if (!range) {
      return res.status(400).json({ message: "잘못된 연월입니다" });
    }

    const { start, end, year, month } = range;
    const data = await getMonthlyAttendance(start, end);
    const format = await getExcelFormat();

    const buffer = XLSX.write(buildMonthlyWorkbook(data, year, month, format), {
      type: "buffer",
      bookType: "xlsx"
    });

    const mm = String(month).padStart(2, "0");
    const filename = `${year}-${mm} 경로식당 출석부.xlsx`;

    // 한글 파일 이름은 filename* (RFC 5987) 로 넘긴다.
    // 앞의 filename= 은 그걸 못 읽는 브라우저용 대비책이라 ASCII 로만 적는다.
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${year}-${mm}.xlsx"; ` +
      `filename*=UTF-8''${encodeURIComponent(filename)}`
    );

    res.send(buffer);
  });


  // ── 엑셀 양식 (월간 리포트 열 구성) ──
  app.get("/api/excel-format", async (req, res) => {
    await ensureDbReady();
    res.json(await getExcelFormat());
  });

  app.put("/api/excel-format", async (req, res) => {
    await ensureDbReady();

    // 표시 기호는 정해진 목록에서만 고를 수 있다.
    // 임의 문자열이 날짜 칸에 들어가면 표가 통째로 벌어지고, '=' 로 시작하면 수식이 된다.
    const format = normalizeExcelFormat(req.body);

    if (!format) {
      return res.status(400).json({ message: "출석 표시 기호가 올바르지 않습니다" });
    }

    await saveExcelFormat(format);
    res.json(format);
  });

  // ── 엑셀 이름 순서 ──
  app.get("/api/person-order", async (req, res) => {
    await ensureDbReady();
    res.json(await getPersonOrder());
  });

  app.put("/api/person-order", async (req, res) => {
    await ensureDbReady();
    const { order } = req.body;

    if (!Array.isArray(order) || order.some(id => !Number.isInteger(Number(id)))) {
      return res.status(400).json({ message: "잘못된 순서 데이터" });
    }

    await savePersonOrder(order);
    res.json({ success: true });
  });

  // ── 좌석 기록지 ──
  app.get("/api/seat-sheets", async (req, res) => {
    await ensureDbReady();
    res.json(await getSeatSheets());
  });

  app.post("/api/seat-sheets", async (req, res) => {
    await ensureDbReady();
    const title = (req.body.title ?? "").trim();

    if (!title) {
      return res.status(400).json({ message: "제목을 입력해 주세요" });
    }

    // 기록지는 만든 날(KST)의 출석에 반영된다.
    // copyAttendance 면 그날 출석부에 이미 찍힌 출석을 '본인 수령'으로 옮겨 온다.
    const id = await createSeatSheet(title, getTodayDate(), req.body.copyAttendance === true);
    res.json({ id });
  });

  app.get("/api/seat-sheets/:id", async (req, res) => {
    await ensureDbReady();
    const sheetId = Number(req.params.id);

    const sheet = await getSeatSheet(sheetId);
    if (!sheet) {
      return res.status(404).json({ message: "기록지를 찾을 수 없습니다" });
    }

    res.json({
      id: sheetId,
      title: sheet.title,
      sheetDate: sheet.sheetDate,
      marks: await getSeatSheetMarks(sheetId),
      seats: await getSeatSheetSeats(sheetId)
    });
  });

  app.post("/api/seat-sheets/:id/marks", async (req, res) => {
    await ensureDbReady();
    const sheetId = Number(req.params.id);
    const label = (req.body.label ?? "").trim();

    if (!label) {
      return res.status(400).json({ message: "표시 이름을 입력해 주세요" });
    }

    if (!await getSeatSheet(sheetId)) {
      return res.status(404).json({ message: "기록지를 찾을 수 없습니다" });
    }

    res.json(await addSeatSheetMark(sheetId, label, req.body.needsNote));
  });

  // 이미 만든 표시 고치기 — 이름·색·메모 여부.
  app.patch("/api/seat-sheets/:id/marks/:markId", async (req, res) => {
    await ensureDbReady();
    const sheetId = Number(req.params.id);
    const markId = Number(req.params.markId);
    const label = (req.body.label ?? "").trim();
    const color = (req.body.color ?? "").trim().toLowerCase();

    if (!label) {
      return res.status(400).json({ message: "표시 이름을 입력해 주세요" });
    }

    // 색은 화면에서 CSS 변수로 그대로 쓰인다. 형식을 여기서 막지 않으면
    // 아무 문자열이나 스타일에 흘러 들어간다.
    if (!/^#[0-9a-f]{6}$/.test(color)) {
      return res.status(400).json({ message: "색깔 형식이 올바르지 않습니다" });
    }

    const mark = await updateSeatSheetMark(sheetId, markId, label, color, req.body.needsNote);

    if (!mark) {
      return res.status(404).json({ message: "표시를 찾을 수 없습니다" });
    }

    res.json(mark);
  });

  app.delete("/api/seat-sheets/:id/marks/:markId", async (req, res) => {
    await ensureDbReady();
    const sheetId = Number(req.params.id);
    const markId = Number(req.params.markId);

    // 표시가 사라지면 그 표시가 찍혀 있던 좌석도 함께 비워진다(CASCADE).
    // 출석부는 건드리지 않는다 — 기록지와 출석부는 서로 남남이다.
    await deleteSeatSheetMark(sheetId, markId);
    res.json({ success: true });
  });

  app.patch("/api/seat-sheets/:id/entry", async (req, res) => {
    await ensureDbReady();
    const sheetId = Number(req.params.id);
    const { seatId, note } = req.body;

    // markId 가 없으면 표시를 지운다(미수령).
    const markId = req.body.markId == null ? null : Number(req.body.markId);

    const mark = markId === null ? null : await getSheetMark(sheetId, markId);

    if (markId !== null && !mark) {
      return res.status(400).json({ message: "이 기록지의 표시가 아닙니다" });
    }

    // 기록지에만 쓴다. 어떤 표시를 찍든 출석부는 그대로다 —
    // 버튼 하나에 두 곳이 같이 바뀌면 어느 쪽이 원본인지 알 수 없게 된다.
    await setSeatSheetEntry(sheetId, Number(seatId), markId, note);

    res.json({ success: true });
  });

  app.delete("/api/seat-sheets/:id", async (req, res) => {
    await ensureDbReady();
    await deleteSeatSheet(Number(req.params.id));
    res.json({ success: true });
  });

  // 가벼운 요청 처리용 API. UptimeRobot 이 주기적으로 부른다.
  //
  // Render 를 깨우는 것 말고도, DB 를 한 번 건드리는 일을 겸한다 —
  // Supabase 무료 플랜은 일주일 동안 DB 접근이 없으면 프로젝트를 재운다.
  // 예전처럼 200 만 돌려주면 아무리 자주 찔러도 DB 입장에서는 '무활동' 이다.
  //
  // 응답을 먼저 보내고 DB 는 뒤에서 건드린다. 기다렸다가 답하면 DB 가 느린 날에
  // ping 응답도 같이 느려지고(최대 query_timeout 만큼), 모니터링이 서버가 죽은 것으로
  // 오해한다. 이 요청의 목적은 살아 있음을 알리는 것이지 DB 상태를 보고하는 게 아니다.
  // 실패는 로그에만 남긴다.
  app.all("/api/ping", (req, res) => {
    res.status(200).end();

    pool.query("SELECT 1").catch(err => {
      console.error("ping DB 확인 실패:", err.message);
    });
  });

  
  app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
  });
  
  
  // 부팅 보정 — 크론이 발화하지 못하고 지나간 달을 따라잡는다.
  // Render 무료 플랜은 수시로 잠들고 재시작되므로 매월 1일 09:00 크론만 믿을 수 없다.
  // 이미 발송된 달은 sendMonthlyReportOnce 가 알아서 건너뛴다.
  setTimeout(async () => {
    try {
      await ensureDbReady();

      const { year, month } = getLastMonthRange();
      const result = await sendMonthlyReportOnce(year, month);

      if (result.status === "skipped") {
        console.log(`월간 리포트 보정 불필요 (${result.period} 처리 완료)`);
      } else {
        console.log(`월간 리포트 보정 발송: ${result.period} (${result.status})`);
      }
    } catch (err) {
      console.error("부팅 보정 실패:", err);
    }
  }, 2000);

  // 매일 KST 09:00 — 오늘 출석 행 생성
  cron.schedule("0 9 * * *", async () => {
    try {
      await ensureDbReady();
      await ensureTodayAttendanceRows();
    } catch (err) {
      console.error("일일 출석 행 생성 실패:", err);
    }
  }, { timezone: "Asia/Seoul" });

  // 매월 1일 KST 09:00 — 지난달 리포트 자동 발송
  // 출석 기록이 없는 달에도 반드시 1통은 보낸다.
  // (사용자 알림 + Brevo API 키 90일 무활동 만료 방지)
  cron.schedule("0 9 1 * *", async () => {
    try {
      await ensureDbReady();

      const { year, month } = getLastMonthRange();
      const result = await sendMonthlyReportOnce(year, month);

      console.log(`월간 리포트 크론: ${result.period} (${result.status})`);
    } catch (err) {
      console.error("월간 리포트 발송 실패:", err);
    }
  }, { timezone: "Asia/Seoul" });
}

startServer();
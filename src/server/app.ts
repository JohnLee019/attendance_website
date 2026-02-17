import express from "express";
import { db } from "./db";
import path from "path";
import { getTodayDate } from "../shared/date";
import { AttendanceRow } from "../client/table";

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/api/seats", (req, res) => {
  const rows = db.prepare(`
    SELECT
    s.id, s.seatNo, s.personId, s.r, s.c, s.rs, s.cs, p.name  AS personName, p.color AS personColor 
    FROM Seat s LEFT JOIN Person p ON p.id = s.personId
    ORDER BY s.seatNo ASC
  `).all();
  res.json(rows);
});

app.patch("/api/seatattendance/:id", (req, res) => {
  const seatId = Number(req.params.id);
  const today = getTodayDate();

  const row = db.prepare(`
    SELECT present
    FROM Attendance
    WHERE seatId = ? AND date = ?
  `).get(seatId, today) as { present: number } | undefined;

  const current = row?.present === 1;
  const newValue = current ? 0 : 1;

  db.prepare(`
    INSERT INTO Attendance (seatId, date, present)
    VALUES (?, ?, ?)
    ON CONFLICT(date, seatId)
    DO UPDATE SET present = excluded.present
  `).run(seatId, today, newValue);

  res.json({seatId, present: newValue === 1});
});


app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

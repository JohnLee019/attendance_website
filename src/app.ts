import express from "express";
import { db } from "./db";
import path from "path";
import { getTodayDate } from "./date";
import { AttendanceRow } from "./table";

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/dist", express.static(path.join(process.cwd(), "dist")));

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
  const isPresent = req.body?.isPresent;

  if (!Number.isFinite(seatId)) {
    return res.status(400).json({ message: "invalid seatId" });
  }

  if (typeof isPresent !== "boolean") {
    return res.status(400).json({ message: "isPresent must be boolean" });
  }

  const date = getTodayDate(); 
  const present = isPresent ? 1 : 0;

  db.prepare(`
    INSERT INTO Attendance (seatId, date, present)
    VALUES (?, ?, ?)
    ON CONFLICT(seatId, date)
    DO UPDATE SET present = excluded.present
  `).run(seatId, date, present);

  const row = db.prepare(`
    SELECT seatId, date, present
    FROM Attendance
    WHERE seatId = ? AND date = ?
  `).get(seatId, date) as AttendanceRow | undefined;

  if (!row) {
    return res.status(500).json({ message: "attendance not found after upsert" });
  }

  return res.status(200).json({
    seatId: row.seatId,
    date: row.date,
    isPresent: row.present === 1,
  });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

import express from "express";
import path from "path";
import { db } from "./db.js";
import { getTodayDate } from "../../public/shared/date.js";

const app = express();

app.use(express.json());
app.use(express.static("public"));
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/api/seats", (req, res) => {
  const rows = db.prepare(`
    SELECT
      s.id,
      s.seatNo,
      s.personId,
      s.r,
      s.c,
      s.rs,
      s.cs,
      p.name  AS personName,
      p.color AS personColor 
    FROM Seat s
    LEFT JOIN Person p ON p.id = s.personId
    ORDER BY s.seatNo ASC
  `).all();

  res.json(rows);
});

app.patch("/api/seatattendance/:id", (req, res) => {
  const seatId = Number(req.params.id);

  if (!Number.isFinite(seatId)) {
    return res.status(400).json({ message: "invalid seatId" });
  }

  const date = getTodayDate();

  const existing = db.prepare(`
    SELECT present
    FROM Attendance
    WHERE seatId = ? AND date = ?
  `).get(seatId, date);

  const current = existing ? existing.present === 1 : false;
  const newValue = current ? 0 : 1;

  db.prepare(`
    INSERT INTO Attendance (seatId, date, present)
    VALUES (?, ?, ?)
    ON CONFLICT(seatId, date)
    DO UPDATE SET present = excluded.present
  `).run(seatId, date, newValue);

  return res.status(200).json({
    seatId,
    date,
    isPresent: newValue === 1,
  });
});


app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

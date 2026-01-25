import express from "express";
import { db } from "./db";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/dist", express.static(path.join(process.cwd(), "dist")));


app.get("/api/seats", (_req, res) => {
  const rows = db.prepare(`
    SELECT
    s.id, s.seatNo, s.personId, s.r, s.c, s.rs, s.cs, p.name  AS personName, p.color AS personColor 
    FROM Seat s LEFT JOIN Person p ON p.id = s.personId
    ORDER BY s.seatNo ASC
  `).all();
  res.json(rows);
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

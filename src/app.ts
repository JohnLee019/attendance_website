import express from "express";
import { db } from "./db";

const app = express();
app.use(express.json());

app.get("/seats", (_req, res) => {
  const rows = db.prepare(`SELECT id, seatNo FROM Seat ORDER BY seatNo ASC;`).all();
  res.json(rows);
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
  console.log("GET seats: http://localhost:3000/seats");
});

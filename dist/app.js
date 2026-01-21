"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("./db");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get("/seats", (_req, res) => {
    const rows = db_1.db.prepare(`SELECT id, seatNo FROM Seat ORDER BY seatNo ASC;`).all();
    res.json(rows);
});
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
    console.log("GET seats: http://localhost:3000/seats");
});

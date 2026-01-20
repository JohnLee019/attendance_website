import express, { Request, Response } from "express";
import path from "path"

const app = express();
const PORT = 3000;

app.use(express.json());
app.use("/public", express.static(path.join(process.cwd(), "dist", "public")));

app.listen(PORT, ()=> {
    console.log(`Server running ${PORT}`);
})
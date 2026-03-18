import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pkg;

console.log("PostgreSQL connection file loaded");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },

  max: 10,                     
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,

  statement_timeout: 5000,
  query_timeout: 5000
});
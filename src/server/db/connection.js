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

  // 폭주하는 쿼리를 끊는 안전장치이지, 느린 쿼리를 재촉하는 장치가 아니다.
  //
  // 실측으로 가장 무거운 조회(월간 출석, 1,860행)가 30~380ms 다. 그런데 5초로 잡아 두니
  // Supabase 무료 티어가 한 번 삐끗할 때마다 'Query read timeout' 이 나면서
  // 화면이 통째로 실패했다. 평소의 40배인 15초로 둬도 진짜 폭주는 여전히 걸린다.
  statement_timeout: 15000,
  query_timeout: 15000
});
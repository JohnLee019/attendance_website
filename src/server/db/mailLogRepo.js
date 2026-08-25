import { pool } from "./connection.js";
import { getLastMonthRange, toPeriod } from "../utils/date.js";

// '그 달은 처리 끝났다'로 보는 상태들. failed 만 재시도 대상이다.
const DONE_STATUSES = ["sent", "empty", "baseline"];


// 🔹 발송 결과 기록
export async function recordMailResult(period, status, detail = "") {
  await pool.query(`
    INSERT INTO MailLog (period, status, detail)
    VALUES ($1, $2, $3)
  `, [period, status, String(detail).slice(0, 500)]);
}


// 🔹 해당 연월이 이미 처리되었는지
export async function isPeriodDone(period) {
  const { rows } = await pool.query(`
    SELECT 1
    FROM MailLog
    WHERE period = $1 AND status = ANY($2)
    LIMIT 1
  `, [period, DONE_STATUSES]);

  return rows.length > 0;
}


// 🔹 기준점 생성
// 이 기능을 켠 순간 부팅 보정이 과거 달을 소급 발송하는 것을 막는다.
// 로그가 비어 있을 때 딱 한 번, 지난달을 '처리 완료'로 찍어 둔다.
export async function ensureMailLogBaseline() {
  const { rows } = await pool.query(`SELECT 1 FROM MailLog LIMIT 1`);
  if (rows.length > 0) return;

  const { year, month } = getLastMonthRange();
  const period = toPeriod(year, month);

  await recordMailResult(period, "baseline", "발송 이력 기능 도입 — 소급 발송하지 않음");
  console.log(`MailLog 기준점 생성: ${period}`);
}

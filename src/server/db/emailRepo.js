import { pool } from "./connection.js";


// 🔹 이메일 추가
export async function addReportEmail(email) {
  await pool.query(`
    INSERT INTO ReportEmails (email, isActive)
    VALUES ($1, 0)
  `, [email]);
}


// 🔹 전체 이메일 조회
export async function getReportEmails() {
  const { rows } = await pool.query(`
    SELECT id, email, isActive
    FROM ReportEmails
    ORDER BY id ASC
  `);

  return rows.map(r => ({
    id: r.id,
    email: r.email,
    isActive: r.isactive === 1 || r.isactive === true
  }));
}


// 🔹 활성 이메일 설정
export async function setActiveEmail(id) {

  // 전체 비활성화
  await pool.query(`
    UPDATE ReportEmails
    SET isActive = 0
  `);

  // 선택한 것 활성화
  await pool.query(`
    UPDATE ReportEmails
    SET isActive = 1
    WHERE id = $1
  `, [id]);
}


// 🔹 활성 이메일 조회
export async function getActiveEmail() {

  const { rows } = await pool.query(`
    SELECT email
    FROM ReportEmails
    WHERE isActive = 1
    LIMIT 1
  `);

  return rows[0]?.email || null;
}


// 🔹 이메일 삭제
export async function deleteReportEmail(id) {
  await pool.query(`
    DELETE FROM ReportEmails
    WHERE id = $1
  `, [id]);
}
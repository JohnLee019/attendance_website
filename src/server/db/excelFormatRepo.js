import { pool } from "./connection.js";

// 엑셀 칸에 찍을 수 있는 출석 표시.
//
// 자유 입력으로 열어 두지 않는 이유: '=' 로 시작하는 값은 엑셀이 수식으로 읽고,
// 긴 문자열은 날짜 칸(한 달이면 31열)을 통째로 벌려 표를 망가뜨린다.
export const PRESENT_MARKS = ["O", "V", "0", "1"];

// 아무것도 손대지 않았을 때의 모양.
// 이 기능이 생기기 전에 나가던 엑셀과 정확히 같다 —
// 설정을 저장하기 전까지는 리포트가 달라지지 않아야 한다.
export const DEFAULT_EXCEL_FORMAT = {
  showSeatNo: false,
  showTotal: true,
  showRate: true,
  presentMark: "0"
};

// 화면에서 온 값을 저장 가능한 모양으로 다듬는다.
// 표시 기호가 목록에 없으면 null — 부르는 쪽에서 400 을 낸다.
export function normalizeExcelFormat(input = {}) {
  const presentMark = String(input.presentMark ?? DEFAULT_EXCEL_FORMAT.presentMark);

  if (!PRESENT_MARKS.includes(presentMark)) return null;

  return {
    showSeatNo: input.showSeatNo === true,
    showTotal: input.showTotal === true,
    showRate: input.showRate === true,
    presentMark
  };
}

export async function getExcelFormat() {
  const { rows } = await pool.query(`
    SELECT
      showSeatNo AS "showSeatNo",
      showTotal AS "showTotal",
      showRate AS "showRate",
      presentMark AS "presentMark"
    FROM ExcelFormat
    WHERE id = 1
  `);

  const row = rows[0];

  // 설정 행이 아직 없으면 기본값으로 그린다. 조회 때문에 리포트가 멈추면 안 된다.
  if (!row) return { ...DEFAULT_EXCEL_FORMAT };

  return {
    showSeatNo: row.showSeatNo === 1,
    showTotal: row.showTotal === 1,
    showRate: row.showRate === 1,
    presentMark: row.presentMark
  };
}

// 설정은 언제나 한 벌뿐이라 id = 1 한 행을 덮어쓴다.
export async function saveExcelFormat(format) {
  await pool.query(`
    INSERT INTO ExcelFormat (id, showSeatNo, showTotal, showRate, presentMark)
    VALUES (1, $1, $2, $3, $4)
    ON CONFLICT (id)
    DO UPDATE SET
      showSeatNo = EXCLUDED.showSeatNo,
      showTotal = EXCLUDED.showTotal,
      showRate = EXCLUDED.showRate,
      presentMark = EXCLUDED.presentMark
  `, [
    format.showSeatNo ? 1 : 0,
    format.showTotal ? 1 : 0,
    format.showRate ? 1 : 0,
    format.presentMark
  ]);
}

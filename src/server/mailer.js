import dotenv from "dotenv";
dotenv.config();

import XLSX from "xlsx";
import { getDailyAttendance, getMonthlyAttendance } from "./db/attendanceRepo.js";
import { getActiveEmail } from "./db/emailRepo.js";
import { getExcelFormat, DEFAULT_EXCEL_FORMAT } from "./db/excelFormatRepo.js";
import { getLastMonthRange, getMonthRange, toPeriod } from "./utils/date.js";
import { recordMailResult, isPeriodDone } from "./db/mailLogRepo.js";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

// Brevo HTTP API로 발송. SMTP가 아니라서 Render 무료 플랜에서도 막히지 않는다.
// 실패하면 반드시 throw 한다 — 조용히 성공으로 처리하지 않기 위해서.
async function sendMail({ to, subject, text, filename, buffer }) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey) throw new Error("BREVO_API_KEY 가 설정되지 않았습니다");
  if (!from) throw new Error("MAIL_FROM 이 설정되지 않았습니다");

  const payload = {
    sender: { email: from, name: "경로식당 출석부" },
    to: [{ email: to }],
    replyTo: { email: from },
    subject,
    textContent: text
  };

  if (buffer) {
    payload.attachment = [{ name: filename, content: buffer.toString("base64") }];
  }

  const res = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`메일 발송 실패 (HTTP ${res.status}): ${detail}`);
  }

  return { success: true };
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// 월간 출석부 워크북을 만든다.
//
// DB·메일과 떼어 놓은 순수 함수다 — 엑셀 형식은 자주 손보게 되는데,
// 발송 함수에 묻어 있으면 실제로 보내 보지 않고는 확인할 방법이 없다.
//
// 이름이 나오는 순서는 여기서 정하지 않는다. getMonthlyAttendance 가 내려준
// 순서(사용자가 설정에서 정한 순서)를 그대로 따른다.
//
// format 은 설정 화면에서 정한 열 구성이다. 안 넘기면 기본값 —
// 인자를 빠뜨린 호출이 예전과 다른 엑셀을 만들어 내지 않게 한다.
export function buildMonthlyWorkbook(data, year, month, format = DEFAULT_EXCEL_FORMAT) {
  const daysInMonth = getDaysInMonth(year, month);

  // 숫자로 고른 표시('0', '1')는 숫자 칸으로 넣는다.
  // 문자로 들어가면 엑셀에서 합계·필터가 걸리지 않는다.
  const presentMark = /^\d+$/.test(format.presentMark)
    ? Number(format.presentMark)
    : format.presentMark;

  // 운영일 계산 (한 사람이라도 출석한 날짜)
  const activeDays = new Set();

  for (const person of data) {
    for (const d of person.days) {
      activeDays.add(d);
    }
  }

  const activeDayCount = activeDays.size;

  const worksheetData = [];

  for (const person of data) {
    const row = {};

    // 좌석 번호는 기본으로 꺼 둔다 — 날짜 칸의 숫자와 헷갈리기 때문이다.
    // 자리로 사람을 찾는 편이 편한 곳도 있어서 설정에서 켤 수 있게만 열어 뒀다.
    if (format.showSeatNo) row["좌석번호"] = person.seatNo;

    row["성명"] = person.name;

    let presentCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr =
        `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      if (person.days.includes(dateStr)) {
        row[d] = presentMark;
        presentCount++;
      } else {
        row[d] = "";
      }
    }

    if (format.showTotal) row["총 출석 일수"] = presentCount;

    if (format.showRate) {
      row["출석률"] =
        activeDayCount === 0
          ? "0%"
          : `${Math.round((presentCount / activeDayCount) * 100)}%`;
    }

    worksheetData.push(row);
  }

  const headers = [];

  if (format.showSeatNo) headers.push("좌석번호");
  headers.push("성명");

  for (let d = 1; d <= daysInMonth; d++) {
    headers.push(String(d));
  }

  if (format.showTotal) headers.push("총 출석 일수");
  if (format.showRate) headers.push("출석률");

  const worksheet = XLSX.utils.aoa_to_sheet([
    [`${year}년 ${month}월 경로식당 출석부`],
    []
  ]);

  XLSX.utils.sheet_add_json(worksheet, worksheetData, {
    header: headers,
    origin: "A3",
    skipHeader: false
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "출석부");

  return workbook;
}

// 월간 출석 엑셀 전송
// 인자를 안 넘기면 자동으로 "KST 기준 이전 달" 리포트 발송
export async function sendMonthlyExcel(start, end, year, month) {
  if (!start || !end || !year || !month) {
    ({ start, end, year, month } = getLastMonthRange());
  }

  const email = await getActiveEmail();
  if (!email) throw new Error("활성 이메일 없음");

  const data = await getMonthlyAttendance(start, end);
  if (!data.length) return { empty: true };

  const format = await getExcelFormat();

  const buffer = XLSX.write(buildMonthlyWorkbook(data, year, month, format), {
    type: "buffer",
    bookType: "xlsx"
  });

  const mm = String(month).padStart(2, "0");

  await sendMail({
    to: email,
    subject: `${year}-${mm} 경로식당 출석부`,
    text: "월간 출석 리포트입니다.",
    filename: `${year}-${mm} 경로식당 출석부.xlsx`,
    buffer
  });

  return { success: true };
}

// 출석 데이터가 없는 달에도 매월 1통은 나가도록 하는 알림 메일.
// Brevo API 키가 90일 무활동으로 만료되는 것을 막는 역할도 겸한다.
export async function sendMonthlyNotice(year, month) {
  const email = await getActiveEmail();
  if (!email) throw new Error("활성 이메일 없음");

  const mm = String(month).padStart(2, "0");

  await sendMail({
    to: email,
    subject: `${year}-${mm} 경로식당 출석부 (기록 없음)`,
    text:
      `${year}년 ${month}월에는 출석 기록이 없어 첨부 파일 없이 알려드립니다.\n\n` +
      `이 메일은 매월 1일에 자동 발송됩니다.`
  });

  return { success: true };
}

// 월간 리포트를 "그 달에 한 번만" 발송하고 결과를 남긴다.
//
// 크론(매월 1일)과 부팅 보정이 같은 함수를 쓰기 때문에, 이미 처리된 달은 건너뛴다.
// 실패는 기록만 하고 다시 throw 한다 — status='failed' 는 처리 완료로 치지 않으므로
// 다음 부팅 때 자동으로 재시도된다.
//
// force        : 이력을 무시하고 무조건 발송 (수동 버튼용)
// noticeOnEmpty: 데이터가 없을 때 알림 메일을 보낼지. 수동 발송은 보내지 않고 그대로 알린다.
export async function sendMonthlyReportOnce(
  year,
  month,
  { force = false, noticeOnEmpty = true } = {}
) {
  const period = toPeriod(year, month);

  if (!force && await isPeriodDone(period)) {
    return { period, status: "skipped" };
  }

  try {
    const { start, end } = getMonthRange(year, month);
    const result = await sendMonthlyExcel(start, end, year, month);

    if (result?.empty) {
      if (!noticeOnEmpty) {
        return { period, status: "empty" };
      }

      await sendMonthlyNotice(year, month);
      await recordMailResult(period, "empty", "출석 기록 없음 — 알림 메일 발송");
      return { period, status: "empty" };
    }

    await recordMailResult(period, "sent");
    return { period, status: "sent" };
  } catch (err) {
    await recordMailResult(period, "failed", err?.message ?? err);
    throw err;
  }
}

// 오늘(또는 지정 날짜) 출석 엑셀 전송
export async function sendTodayExcel(date) {
  const email = await getActiveEmail();
  if (!email) throw new Error("활성 이메일 없음");

  const data = await getDailyAttendance(date);
  if (!data.length) return { empty: true };

  const worksheetData = data.map(d => ({
    이름: d.personName,
    출석여부: d.present ? "O" : ""
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, "오늘출석");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  await sendMail({
    to: email,
    subject: `${date} 출석 현황`,
    text: "오늘 출석 리포트입니다.",
    filename: `${date}_출석.xlsx`,
    buffer
  });

  return { success: true };
}

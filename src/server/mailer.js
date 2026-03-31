import dotenv from "dotenv";
dotenv.config();

import XLSX from "xlsx";
import { getDailyAttendance, getMonthlyAttendance } from "./db/attendanceRepo.js";
import { getActiveEmail } from "./db/emailRepo.js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// 월간 출석 엑셀 전송
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// KST 기준 현재 날짜 파트 추출
function getKSTDateParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(new Date());
  const map = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day)
  };
}

// KST 기준 "이전 달" 범위 계산
function getPreviousMonthRangeKST() {
  const { year: currentYear, month: currentMonth } = getKSTDateParts();

  let year = currentYear;
  let month = currentMonth - 1;

  if (month === 0) {
    month = 12;
    year -= 1;
  }

  const lastDay = getDaysInMonth(year, month);

  const mm = String(month).padStart(2, "0");
  const dd = String(lastDay).padStart(2, "0");

  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${dd}`,
    year,
    month
  };
}

// 인자를 안 넘기면 자동으로 "KST 기준 이전 달" 리포트 발송
export async function sendMonthlyExcel(start, end, year, month) {
  if (!start || !end || !year || !month) {
    const prevMonth = getPreviousMonthRangeKST();
    start = prevMonth.start;
    end = prevMonth.end;
    year = prevMonth.year;
    month = prevMonth.month;
  }

  const email = await getActiveEmail();
  if (!email) throw new Error("활성 이메일 없음");

  const data = await getMonthlyAttendance(start, end);
  if (!data.length) return { empty: true };

  const daysInMonth = getDaysInMonth(year, month);

  const worksheetData = [];

  // 운영일 계산 (한 사람이라도 출석한 날짜)
  const activeDays = new Set();

  for (const person of data) {
    for (const d of person.days) {
      activeDays.add(d);
    }
  }

  const activeDayCount = activeDays.size;

  for (const person of data) {
    const row = {
      좌석: person.seatNo,
      성명: person.name
    };

    let presentCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr =
        `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      if (person.days.includes(dateStr)) {
        row[d] = 0;
        presentCount++;
      } else {
        row[d] = "";
      }
    }

    row["총 출석 일수"] = presentCount;
    row["출석률"] =
      activeDayCount === 0
        ? "0%"
        : `${Math.round((presentCount / activeDayCount) * 100)}%`;

    worksheetData.push(row);
  }

  const workbook = XLSX.utils.book_new();

  const worksheet = XLSX.utils.aoa_to_sheet([
    [`${year}년 ${month}월 경로식당 출석부`],
    []
  ]);

  const headers = ["좌석", "성명"];

  for (let d = 1; d <= daysInMonth; d++) {
    headers.push(String(d));
  }

  headers.push("총 출석 일수");
  headers.push("출석률");

  XLSX.utils.sheet_add_json(worksheet, worksheetData, {
    header: headers,
    origin: "A3",
    skipHeader: false
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, "출석부");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: `${year}-${String(month).padStart(2, "0")} 경로식당 출석부`,
    text: "월간 출석 리포트입니다.",
    attachments: [
      {
        filename: `${year}-${String(month).padStart(2, "0")} 경로식당 출석부.xlsx`,
        content: buffer.toString("base64")
      }
    ]
  });

  return { success: true };
}

// 오늘 출석 엑셀 전송
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

  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: `${date} 출석 현황`,
    text: "오늘 출석 리포트입니다.",
    attachments: [
      {
        filename: `${date}_출석.xlsx`,
        content: buffer.toString("base64")
      }
    ]
  });

  return { success: true };
}
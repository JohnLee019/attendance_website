import dotenv from "dotenv";
dotenv.config();

import XLSX from "xlsx";
import nodemailer from "nodemailer";
import { getDailyAttendance, getMonthlyAttendance } from "./db/attendanceRepo.js";
import { getActiveEmail } from "./db/emailRepo.js";

// 메일 전송 설정
const transporter = nodemailer.createTransport({
  host: "smtp.naver.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_ID,
    pass: process.env.EMAIL_PASSWORD
  }
});


// 월간 출석 엑셀 전송
export async function sendMonthlyExcel(start, end, year, month) {

  const email = await getActiveEmail();
  if (!email) throw new Error("활성 이메일 없음");

  const data = await getMonthlyAttendance(start, end);

  if (!data.length) {
    return { empty: true };
  }

  const worksheetData = data.map(d => {

    const totalDays = d.totalDays || 0;
    const totalPresent = d.totalPresent || 0;

    const rate =
      totalDays === 0
        ? "0%"
        : `${Math.round((totalPresent / totalDays) * 100)}%`;

    return {
      이름: d.personName,
      출석일수: totalPresent,
      총일수: totalDays,
      출석률: rate
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  XLSX.utils.book_append_sheet(workbook, worksheet, "월간출석");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  await transporter.sendMail({
    from: process.env.EMAIL_ID,
    to: email,
    subject: `${year}-${month} 월간 출석 현황`,
    text: "월간 출석 리포트입니다.",
    attachments: [{
      filename: `${year}-${month}_월간출석.xlsx`,
      content: buffer
    }]
  });

  return { success: true };
}


// 오늘 출석 엑셀 전송
export async function sendTodayExcel(date) {

  const email = await getActiveEmail();
  if (!email) throw new Error("활성 이메일 없음");

  const data = await getDailyAttendance(date);

  if (!data.length) {
    return { empty: true };
  }

  const worksheetData = data.map(d => ({
    이름: d.personName,
    출석여부: d.present ? "O" : "X"
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  XLSX.utils.book_append_sheet(workbook, worksheet, "오늘출석");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  });

  await transporter.sendMail({
    from: process.env.EMAIL_ID,
    to: email,
    subject: `${date} 출석 현황`,
    text: "오늘 출석 리포트입니다.",
    attachments: [{
      filename: `${date}_출석.xlsx`,
      content: buffer
    }]
  });

  return { success: true };
}
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();
import XLSX from 'xlsx';
import { getDailyAttendance, getMonthlyAttendance } from './db/attendanceRepo.js';
import { getActiveEmail } from './db/emailRepo.js';

// Gmail SMTP 설정
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,  // Gmail 사용자 이메일
    pass: process.env.GMAIL_APP_PASSWORD,  // Gmail 앱 비밀번호
  },
  secure: false,  // TLS를 사용할 경우 false로 설정
  port: 587,      // TLS 포트 587
  connectionTimeout: 30000,  // 연결 타임아웃을 30초로 설정
  greetingTimeout: 30000,    // 인사말 타임아웃을 30초로 설정
  socketTimeout: 30000       // 소켓 타임아웃을 30초로 설정
});

// 이메일 전송을 비동기적으로 처리하는 함수
async function sendEmailInBackground(email, subject, text, attachments) {
  setImmediate(async () => {
    try {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: email,
        subject,
        text,
        attachments,
      });
      console.log('Email sent successfully');
    } catch (error) {
      console.error('Email send failed:', error);
    }
  });
}

// 월간 출석 엑셀 전송
export async function sendMonthlyExcel(start, end, year, month) {
  const email = await getActiveEmail();
  if (!email) throw new Error('활성 이메일 없음');

  const data = await getMonthlyAttendance(start, end);
  if (!data.length) return { empty: true };

  const daysInMonth = new Date(year, month, 0).getDate();
  const worksheetData = [];
  const activeDays = new Set();

  for (const person of data) {
    for (const d of person.days) {
      activeDays.add(d);
    }
  }

  const activeDayCount = activeDays.size;

  for (const person of data) {
    const row = { 좌석: person.seatNo, 성명: person.name };
    let presentCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (person.days.includes(dateStr)) {
        row[d] = 0;
        presentCount++;
      } else {
        row[d] = '';
      }
    }

    row['총 출석 일수'] = presentCount;
    row['출석률'] = activeDayCount === 0 ? '0%' : `${Math.round((presentCount / activeDayCount) * 100)}%`;

    worksheetData.push(row);
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([['${year}년 ${month}월 경로식당 출석부'], []]);
  const headers = ['좌석', '성명'];

  for (let d = 1; d <= daysInMonth; d++) {
    headers.push(String(d));
  }

  headers.push('총 출석 일수', '출석률');
  XLSX.utils.sheet_add_json(worksheet, worksheetData, { header: headers, origin: 'A3', skipHeader: false });
  XLSX.utils.book_append_sheet(workbook, worksheet, '출석부');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // 이메일 전송을 비동기적으로 처리
  sendEmailInBackground(
    email,
    `${year}-${month} 경로식당 출석부`,
    '월간 출석 리포트입니다.',
    [
      {
        filename: `${year}-${String(month).padStart(2, '0')} 경로식당 출석부.xlsx`,
        content: buffer.toString('base64'),
      },
    ]
  );

  // 즉시 응답 반환
  return { success: true };
}

// 오늘 출석 엑셀 전송
export async function sendTodayExcel(date) {
  const email = await getActiveEmail();
  if (!email) throw new Error('활성 이메일 없음');

  const data = await getDailyAttendance(date);
  if (!data.length) return { empty: true };

  const worksheetData = data.map((d) => ({
    이름: d.personName,
    출석여부: d.present ? 'O' : '',
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, '오늘출석');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // 이메일 전송을 비동기적으로 처리
  sendEmailInBackground(
    email,
    `${date} 출석 현황`,
    '오늘 출석 리포트입니다.',
    [
      {
        filename: `${date}_출석.xlsx`,
        content: buffer.toString('base64'),
      },
    ]
  );

  // 즉시 응답 반환
  return { success: true };
}
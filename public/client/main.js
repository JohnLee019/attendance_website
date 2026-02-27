import { getTodayDate } from "../shared/date.js";
import { fetchSeats } from "./api.js";
import { makeBlock, appendSeatNos } from "./seatRenderer.js";
import { bindAttendance } from "./attendance.js";

async function loadTodayStats() {
  const res = await fetch("/api/todayAttendanceStats");
  if (!res.ok) return;

  const data = await res.json();
  const el = document.getElementById("todayStats");

  if (el) {
    el.textContent =
      `출석 인원: ${data.present}명 / ${data.total}명 (${data.percent}%)`;
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const seats = await fetchSeats();
  } catch (err) {
    window.location.href = "/login.html";
    return;
  }
  
  const seats = await fetchSeats();
  window.loadTodayStats = loadTodayStats;

  const dateEl = document.getElementById("date");
  if (dateEl) dateEl.textContent = getTodayDate();

  const seatByNo = new Map();
  seats.forEach(s => seatByNo.set(s.seatNo, s));

  const seatmap = document.getElementById("seatmap");
  if (!seatmap) {
  console.error("seatmap not found");
  return;
}
  seatmap.classList.add("is-grid");
  seatmap.innerHTML = "";

  const blocks = [
  // 좌상
  { seats: [1, 2, 3, 4, 5, 6], grid: { r: 2, c: 2, rs: 6, cs: 6 }, wide: false },

  // 상중
  { seats: [7, 8, 9, 10, 11, 12], grid: { r: 2, c: 10, rs: 6, cs: 6 }, wide: false },

  // 상우
  { seats: [13, 14, 15, 16, 59, 17, 18, 60], grid: { r: 2, c: 18, rs: 4, cs: 12 }, wide: true },

  // 좌중
  { seats: [19, 20, 21, 22, 23, 24], grid: { r: 10, c: 2, rs: 6, cs: 6 }, wide: false },

  // 중중
  { seats: [25, 26, 27, 28, 29, 30], grid: { r: 10, c: 10, rs: 6, cs: 6 }, wide: false },

  // 중우
  { seats: [31, 32, 33, 34, 35, 36, 37, 38], grid: { r: 11, c: 18, rs: 4, cs: 12 }, wide: true },

  // 좌하
  { seats: [39, 40, 41, 42, 43, 44], grid: { r: 18, c: 2, rs: 6, cs: 6 }, wide: false },

  // 중하
  { seats: [45, 46, 47, 48, 49, 50], grid: { r: 18, c: 10, rs: 6, cs: 6 }, wide: false },

  // 우하
  { seats: [51, 52, 53, 54, 55, 56, 57, 58], grid: { r: 20, c: 18, rs: 4, cs: 12 }, wide: true }
];

  blocks.forEach(({ seats, grid, wide }) => {
  const className = wide ? "block wide" : "block";
  const b = makeBlock(className, grid);
  appendSeatNos(b, seats, seatByNo);
  seatmap.appendChild(b);
});

  bindAttendance(seatmap);
  await loadTodayStats();
  const exportBtn = document.getElementById("exportExcel");

  if (exportBtn) {
  exportBtn.addEventListener("click", async () => {

    const res = await fetch("/api/sendTodayExcel", {
      method: "POST"
    });

    if (res.ok) {
      alert("엑셀을 이메일로 전송했습니다.");
    } else {
      alert("전송 실패");
    }
  });
}

const lastMonthBtn = document.getElementById("lastMonthReport");

if (lastMonthBtn) {
  lastMonthBtn.addEventListener("click", async () => {

    const res = await fetch("/api/sendLastMonthReport", {
      method: "POST"
    });

    if (res.ok) {
      alert("저번 달 출석률을 이메일로 전송했습니다.");
    } else {
      alert("전송 실패");
    }
  });
}

});

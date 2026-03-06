import { getTodayDate } from "../shared/date.js";
import { fetchSeats } from "./api.js";
import { makeBlock, appendSeatNos } from "./seatRenderer.js";
import { bindAttendance } from "./attendance.js";

/* =========================
   App State
========================= */

const appState = {
  seats: []
};

window.appState = appState;

/* =========================
   오늘 출석 통계
========================= */

async function loadTodayStats() {

  const res = await fetch("/api/todayAttendanceStats");
  if (!res.ok) return;

  const data = await res.json();

  const statsEl = document.getElementById("todayStats");
  const directEl = document.getElementById("directStats");

  if (!statsEl) return;

  const validSeats = appState.seats.filter(
    s => s.personName && s.personName.trim() !== ""
  );

  const total = validSeats.length;

  const percent =
    total === 0
      ? 0
      : Math.round((data.present / total) * 100);

  statsEl.textContent =
    `출석 인원: ${data.present}명 / ${total}명 (${percent}%)`;

  /* 직접 전달 (파랑 + 출석) */

  const directCount = validSeats.filter(
    s => s.color === 1 && s.present === 1
  ).length;

  if (directEl) {
    directEl.textContent = `직접 전달: ${directCount}명`;
  }
}

/* =========================
   초기 로딩
========================= */

window.addEventListener("DOMContentLoaded", async () => {

  try {
    appState.seats = await fetchSeats();
  } catch (err) {
    window.location.href = "/login.html";
    return;
  }

  const seats = appState.seats;

  window.loadTodayStats = loadTodayStats;

  const dateEl = document.getElementById("date");
  if (dateEl) {
    dateEl.textContent = getTodayDate();
  }

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

    { seats:[1,2,3,4,5,6], grid:{r:2,c:2,rs:6,cs:6}, wide:false },
    { seats:[7,8,9,10,11,12], grid:{r:2,c:10,rs:6,cs:6}, wide:false },
    { seats:[13,14,15,16,59,17,18,60], grid:{r:2,c:18,rs:4,cs:12}, wide:true },

    { seats:[19,20,21,22,23,24], grid:{r:10,c:2,rs:6,cs:6}, wide:false },
    { seats:[25,26,27,28,29,30], grid:{r:10,c:10,rs:6,cs:6}, wide:false },
    { seats:[31,32,33,34,35,36,37,38], grid:{r:11,c:18,rs:4,cs:12}, wide:true },

    { seats:[39,40,41,42,43,44], grid:{r:18,c:2,rs:6,cs:6}, wide:false },
    { seats:[45,46,47,48,49,50], grid:{r:18,c:10,rs:6,cs:6}, wide:false },
    { seats:[51,52,53,54,55,56,57,58], grid:{r:20,c:18,rs:4,cs:12}, wide:true }

  ];

  blocks.forEach(({ seats, grid, wide }) => {

    const className = wide ? "block wide" : "block";

    const block = makeBlock(className, grid);

    appendSeatNos(block, seats, seatByNo);

    seatmap.appendChild(block);

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
import { getTodayDate } from "../shared/date.js";
import { SEAT_BLOCKS } from "../shared/seatLayout.js";
import { fetchSeats } from "./api.js";
import { makeBlock, appendSeatNos } from "./seatRenderer.js";
import { bindAttendance } from "./attendance.js";
import { bindSendButton } from "./sendButton.js";

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

  const { total, present, percent, direct } = await res.json();

  const statsEl = document.getElementById("todayStats");
  if (statsEl) {
    statsEl.textContent = `출석 인원: ${present}명 / ${total}명 (${percent}%)`;
  }

  const directEl = document.getElementById("directStats");
  if (directEl) {
    directEl.textContent = `직접 전달: ${direct}명`;
  }
}

/* =========================
   좌석 기록지 만들기
========================= */

function bindCreateSheet() {
  const btn = document.getElementById("createSheet");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const title = prompt("기록지 제목을 입력하세요 (예: 10월 23일 반찬 배부)");
    if (title === null) return;

    if (!title.trim()) {
      alert("제목을 입력해 주세요.");
      return;
    }

    // 오늘 출석부를 베껴 와서 시작할지 물어본다.
    // 취소를 누르면 아무것도 찍히지 않은 빈 기록지로 시작한다.
    const copyAttendance = confirm(
      "지금 좌석에 찍힌 오늘 출석 표시를 그대로 가져올까요?\n\n" +
      "확인을 누르면 출석한 좌석에 '본인 수령' 표시가 미리 찍힙니다.\n" +
      "한 번 베껴 올 뿐이라, 만든 뒤로는 기록지와 출석부가 서로 영향을 주지 않습니다."
    );

    btn.disabled = true;

    try {
      const res = await fetch("/api/seat-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, copyAttendance })
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        alert(msg.message || "기록지를 만들지 못했습니다.");
        return;
      }

      const { id } = await res.json();
      window.location.href = `/seatSheet.html?id=${id}`;
    } catch (err) {
      console.error(err);
      alert("기록지를 만들지 못했습니다.");
    } finally {
      btn.disabled = false;
    }
  });
}

/* =========================
   초기 로딩
========================= */

window.addEventListener("DOMContentLoaded", async () => {

  try {
    appState.seats = await fetchSeats();
  } catch (err) {
    // 401일 때만 로그인으로. 그 외(500 등)는 에러를 그대로 드러낸다.
    if (err.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    console.error(err);
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<p style="color:#c00;padding:12px">서버 오류로 좌석을 불러오지 못했습니다 (${err.status ?? "네트워크"}). 잠시 후 새로고침해 주세요.</p>`
    );
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

  SEAT_BLOCKS.forEach(({ seats, grid, wide }) => {

    const className = wide ? "block wide" : "block";

    const block = makeBlock(className, grid);

    appendSeatNos(block, seats, seatByNo);

    seatmap.appendChild(block);

  });

  bindAttendance(seatmap);
  bindCreateSheet();

  await loadTodayStats();

  bindSendButton(
    document.getElementById("exportExcel"),
    "/api/sendTodayExcel",
    { successMessage: "엑셀을 이메일로 전송했습니다." }
  );

  bindSendButton(
    document.getElementById("lastMonthReport"),
    "/api/sendLastMonthReport",
    { successMessage: "저번 달 출석률을 이메일로 전송했습니다." }
  );

});
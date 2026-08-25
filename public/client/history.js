import { SEAT_BLOCKS } from "../shared/seatLayout.js";
import { makeBlock, appendSeatNos } from "./seatRenderer.js";
import { bindSendButton } from "./sendButton.js";

const searchBtn = document.getElementById("searchDate");
const selectedDateInput = document.getElementById("selectedDate");
const seatmap = document.getElementById("seatmap");
const exportBtn = document.getElementById("exportHistoryExcel");
const editBtn = document.getElementById("editAttendanceBtn");

let editMode = false;
let currentDate = null;

exportBtn.disabled = true;
editBtn.disabled = true;


// 엑셀 버튼 상태 재계산
function updateExportButtonState() {
  const presentSeats = seatmap.querySelectorAll(".seat.present");
  exportBtn.disabled = presentSeats.length === 0;
}


// 날짜 조회
async function loadAttendance(date) {
  currentDate = date;

  const res = await fetch(`/api/attendance?date=${date}`);
  if (!res.ok) {
    alert("조회 실패");
    return;
  }

  const data = await res.json();

  seatmap.innerHTML = "";
  seatmap.classList.add("is-grid");

  if (!Array.isArray(data) || data.length === 0) {
    seatmap.innerHTML = "<p>출석 기록 없음</p>";
    exportBtn.disabled = true;
    editBtn.disabled = true;
    return;
  }

  editBtn.disabled = false;

  const seatByNo = new Map();
  data.forEach(row => seatByNo.set(row.seatNo, row));

  SEAT_BLOCKS.forEach(({ seats, grid, wide }) => {
    const block = makeBlock(wide ? "block wide" : "block", grid);
    appendSeatNos(block, seats, seatByNo);
    seatmap.appendChild(block);
  });

  // 조회 직후 엑셀 버튼 상태 계산
  updateExportButtonState();
}


// 월 별 출석표에서 날짜를 눌러 넘어온 경우.
//
// 그 달 표로 돌아갈 길도 같이 열어 둔다 — 여기까지 온 사람은 설정 화면이 아니라
// 보던 표로 돌아가고 싶어 한다. 직접 들어온 경우에는 원래대로 설정 화면으로 간다.
function applyDateFromUrl() {
  const date = new URLSearchParams(window.location.search).get("date");

  // 주소는 사용자가 손댈 수 있다. 형식이 맞을 때만 받아들인다.
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

  selectedDateInput.value = date;

  const backLink = document.querySelector(".top-bar a");

  if (backLink) {
    const [year, month] = date.split("-");
    backLink.href = `monthAttendance.html?year=${Number(year)}&month=${Number(month)}`;
    backLink.textContent = "← 월 별 출석표";
  }

  loadAttendance(date);
}


// 조회 버튼 클릭
searchBtn.addEventListener("click", () => {
  const date = selectedDateInput.value;

  if (!date) {
    alert("날짜 선택하세요");
    editBtn.disabled = true;
    exportBtn.disabled = true;
    return;
  }

  loadAttendance(date);
});


// 수정 모드 토글
editBtn.addEventListener("click", () => {
  editMode = !editMode;

  editBtn.classList.toggle("active", editMode);
  editBtn.textContent = editMode ? "수정 종료" : "출석 수정";

  // 수정 종료 시 엑셀 버튼 재계산
  if (!editMode) {
    updateExportButtonState();
  }
});


// 좌석 클릭 (수정 모드일 때만)
seatmap.addEventListener("click", async (e) => {
  if (!editMode) return;

  const btn = e.target.closest(".seat");
  if (!btn) return;

  const seatId = Number(btn.dataset.seatId);
  if (!seatId || !currentDate) return;

  const res = await fetch("/api/attendance", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seatId, date: currentDate })
  });

  if (!res.ok) {
    alert("수정 실패");
    return;
  }

  const result = await res.json();

  if (result.present === 1) {
    btn.classList.add("present");
  } else {
    btn.classList.remove("present");
  }

  
  // 수정 즉시 엑셀 버튼 상태 업데이트
  updateExportButtonState();
});

applyDateFromUrl();

bindSendButton(exportBtn, "/api/sendDateExcel", {
  successMessage: "엑셀을 이메일로 전송했습니다.",
  getBody: () => {
    if (!currentDate) {
      alert("날짜를 먼저 선택하세요.");
      return null;
    }
    return { date: currentDate };
  }
});
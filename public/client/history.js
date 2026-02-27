import { makeBlock, appendSeatNos } from "./seatRenderer.js";

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

  const blocks = [
    { seats: [1,2,3,4,5,6], grid:{r:2,c:2,rs:6,cs:6}, wide:false },
    { seats: [7,8,9,10,11,12], grid:{r:2,c:10,rs:6,cs:6}, wide:false },
    { seats: [13,14,15,16,59,17,18,60], grid:{r:2,c:18,rs:4,cs:12}, wide:true },
    { seats: [19,20,21,22,23,24], grid:{r:10,c:2,rs:6,cs:6}, wide:false },
    { seats: [25,26,27,28,29,30], grid:{r:10,c:10,rs:6,cs:6}, wide:false },
    { seats: [31,32,33,34,35,36,37,38], grid:{r:11,c:18,rs:4,cs:12}, wide:true },
    { seats: [39,40,41,42,43,44], grid:{r:18,c:2,rs:6,cs:6}, wide:false },
    { seats: [45,46,47,48,49,50], grid:{r:18,c:10,rs:6,cs:6}, wide:false },
    { seats: [51,52,53,54,55,56,57,58], grid:{r:20,c:18,rs:4,cs:12}, wide:true }
  ];

  blocks.forEach(({ seats, grid, wide }) => {
    const block = makeBlock(wide ? "block wide" : "block", grid);
    appendSeatNos(block, seats, seatByNo);
    seatmap.appendChild(block);
  });

  // 조회 직후 엑셀 버튼 상태 계산
  updateExportButtonState();
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
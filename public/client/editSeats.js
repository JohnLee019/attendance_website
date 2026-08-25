import { SEAT_BLOCKS } from "../shared/seatLayout.js";
import { fetchSeats } from "./api.js";
import { makeBlock, appendSeatNos } from "./seatRenderer.js";

let editMode = null;        
let selectedColor = 0;      
const seatmap = document.getElementById("seatmap");
const editNameBtn = document.getElementById("editNameBtn");
const editColorBtn = document.getElementById("editColorBtn");
const colorSelector = document.getElementById("colorSelector");
const colorBlack = document.getElementById("colorBlack");
const colorBlue = document.getElementById("colorBlue");


// 모드 버튼 UX 처리
editNameBtn.onclick = () => {
  editMode = "name";

  editNameBtn.classList.add("active");
  editColorBtn.classList.remove("active");

  colorSelector.style.display = "none";
};

editColorBtn.onclick = () => {
  editMode = "color";

  editColorBtn.classList.add("active");
  editNameBtn.classList.remove("active");

  colorSelector.style.display = "block";
};

// 색 선택 UX 처리
colorBlack.onclick = () => {
  selectedColor = 0;
  colorBlack.classList.add("active");
  colorBlue.classList.remove("active");
};

colorBlue.onclick = () => {
  selectedColor = 1;
  colorBlue.classList.add("active");
  colorBlack.classList.remove("active");
};

// 좌석 로딩
window.addEventListener("DOMContentLoaded", async () => {

  const seats = await fetchSeats();

  seats.forEach(s => {
    s.present = 0;
  });

  const seatByNo = new Map();
  seats.forEach(s => seatByNo.set(s.seatNo, s));

  seatmap.classList.add("is-grid");
  seatmap.innerHTML = "";

  SEAT_BLOCKS.forEach(({ seats, grid, wide }) => {
    const className = wide ? "block wide" : "block";
    const b = makeBlock(className, grid);
    appendSeatNos(b, seats, seatByNo);
    seatmap.appendChild(b);
  });

});

// 좌석 클릭 처리
seatmap.addEventListener("click", async (e) => {

  const btn = e.target.closest(".seat");
  if (!btn) return;

  const personIdRaw = btn.dataset.personId;
  console.log("personIdRaw:", personIdRaw);

  if (personIdRaw === undefined) return;

  const personId = Number(personIdRaw);
  if (isNaN(personId)) return;

  // 이름 변경 모드
  if (editMode === "name") {

    const newName = prompt("새 이름 입력");

    // 취소한 경우만 막기
    if (newName === null) return;

    await fetch(`/api/person/${personId}/name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() })
    });

    btn.textContent = newName.trim();

    btn.classList.add("updated");
    setTimeout(() => {
      btn.classList.remove("updated");
    }, 600);

    return;
  }

  // 색상 변경 모드
  if (editMode === "color") {

    await fetch(`/api/person/${personId}/color`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color: selectedColor })
    });

    btn.classList.toggle("blue-seat", selectedColor === 1);

    // 변경 강조 효과
    btn.classList.add("updated");
    setTimeout(() => {
      btn.classList.remove("updated");
    }, 600);

    return;
  }

});
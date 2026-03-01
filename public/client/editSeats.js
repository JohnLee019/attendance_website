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

  seatmap.classList.add("is-grid");
  seatmap.innerHTML = "";

  blocks.forEach(({ seats, grid, wide }) => {
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
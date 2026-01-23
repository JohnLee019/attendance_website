window.addEventListener("DOMContentLoaded", () => {
  const blocks = document.querySelectorAll<HTMLElement>(".block");

  blocks.forEach(block => {
      const r  = Number(block.dataset.r);
      const c  = Number(block.dataset.c);
      const rs = Number(block.dataset.rs);
      const cs = Number(block.dataset.cs);
      
      block.style.gridRow = `${r} / span ${rs}`;
      block.style.gridColumn = `${c} / span ${cs}`;
    });
});

function renderSeats() {
    
}

async function fetchSeats() {
    const response = await fetch("/api/seats");
    if (!response.ok) throw new Error("좌석 배치를 가져올 수 없습니다");
    return response.json();
}

//toggle applies when the user clicks the seat 
async function checkAttendance() {

}
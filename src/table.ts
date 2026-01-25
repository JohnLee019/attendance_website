type SeatApiRow = {
  seatNo: number;
  personId: number | null;
  personName: string | null;
};

async function fetchSeats(): Promise<SeatApiRow[]> {
  const res = await fetch("/api/seats");
  if (!res.ok) throw new Error("좌석 데이터를 가져오지 못했습니다");
  return res.json();
}

function makeBlock(className: string, grid: { r: number; c: number; rs: number; cs: number }) {
  const el = document.createElement("section");
  el.className = className;
  el.style.gridRow = `${grid.r} / span ${grid.rs}`;
  el.style.gridColumn = `${grid.c} / span ${grid.cs}`;
  return el;
}

function appendSeatNos(block: HTMLElement, seatNos: number[], seatByNo: Map<number, SeatApiRow>) {
  for (const seatNo of seatNos) {
    const seat = seatByNo.get(seatNo);

    const btn = document.createElement("button");
    btn.className = "seat";
    btn.type = "button";
    btn.dataset.seatNo = String(seatNo);

    btn.textContent = seat?.personName ?? "";

    block.appendChild(btn);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const seats = await fetchSeats();

  const seatByNo = new Map<number, SeatApiRow>();
  for (const s of seats) seatByNo.set(s.seatNo, s);

  const seatmap = document.getElementById("seatmap");
  if (!seatmap) throw new Error("#seatmap not found");

  seatmap.classList.add("is-grid");
  seatmap.innerHTML = "";

  // 좌상
  {
    const b = makeBlock("block", { r: 2, c: 2, rs: 6, cs: 6 });
    appendSeatNos(b, [1, 2, 3, 4, 5, 6], seatByNo);
    seatmap.appendChild(b);
  }

  // 상중
  {
    const b = makeBlock("block", { r: 2, c: 10, rs: 6, cs: 6 });
    appendSeatNos(b, [7, 8, 9, 10, 11, 12], seatByNo);
    seatmap.appendChild(b);
  }

  // 상우
  {
    const b = makeBlock("block wide", { r: 2, c: 18, rs: 4, cs: 12 });
    appendSeatNos(b, [13, 14, 15, 16, 59, 17, 18, 60], seatByNo);
    seatmap.appendChild(b);
  }

  // 좌중
  {
    const b = makeBlock("block", { r: 10, c: 2, rs: 6, cs: 6 });
    appendSeatNos(b, [19, 20, 21, 22, 23, 24], seatByNo);
    seatmap.appendChild(b);
  }

  // 중중
  {
    const b = makeBlock("block", { r: 10, c: 10, rs: 6, cs: 6 });
    appendSeatNos(b, [25, 26, 27, 28, 29, 30], seatByNo);
    seatmap.appendChild(b);
  }

  // 중우
  {
    const b = makeBlock("block wide", { r: 11, c: 18, rs: 4, cs: 12 });
    appendSeatNos(b, [31, 32, 33, 34, 35, 36, 37, 38], seatByNo);
    seatmap.appendChild(b);
  }

  // 좌하 
  {
    const b = makeBlock("block", { r: 18, c: 2, rs: 6, cs: 6 });
    appendSeatNos(b, [39, 40, 41, 42, 43, 44], seatByNo);
    seatmap.appendChild(b);
  }

  // 중하 
  {
    const b = makeBlock("block", { r: 18, c: 10, rs: 6, cs: 6 });
    appendSeatNos(b, [45, 46, 47, 48, 49, 50], seatByNo);
    seatmap.appendChild(b);
  }

  // 우하
  {
    const b = makeBlock("block wide", { r: 20, c: 18, rs: 4, cs: 12 });
    appendSeatNos(b, [51, 52, 53, 54, 55, 56, 57, 58], seatByNo);
    seatmap.appendChild(b);
  }
});

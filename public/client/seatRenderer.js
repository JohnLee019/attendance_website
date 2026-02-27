export function makeBlock(className, grid) {
  const el = document.createElement("section");
  el.className = className;
  el.style.gridRow = `${grid.r} / span ${grid.rs}`;
  el.style.gridColumn = `${grid.c} / span ${grid.cs}`;
  return el;
}

export function appendSeatNos(block, seatNos, seatByNo) {
  for (const seatNo of seatNos) {
    const seat = seatByNo.get(seatNo);

    const btn = document.createElement("button");
    btn.className = "seat";
    btn.type = "button";
    btn.dataset.seatNo = String(seatNo);

    if (seat) {
      btn.dataset.seatId = seat.id;
      btn.dataset.personId = seat.personId ?? "";
      btn.textContent = seat.personName ?? "";

      if (seat.flag === 1) {
        btn.classList.add("blue-seat");
      }
        
      if (seat.present === 1) {
        btn.classList.add("present");
      }

      if (seat.memo && seat.memo.trim() !== "") {
        btn.classList.add("has-memo");

        const bubble = document.createElement("div");
        bubble.className = "memo-bubble";

        const text = document.createElement("div");
        text.className = "memo-text";
        text.textContent = seat.memo;

        const closeBtn = document.createElement("button");
        closeBtn.className = "memo-close";
        closeBtn.textContent = "×";

        bubble.appendChild(text);
        bubble.appendChild(closeBtn);

        btn.appendChild(bubble);
      }
    }

    block.appendChild(btn);
  }
}

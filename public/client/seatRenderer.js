export function makeBlock(className, grid) {
  const el = document.createElement("section");
  el.className = className;
  el.style.gridRow = `${grid.r} / span ${grid.rs}`;
  el.style.gridColumn = `${grid.c} / span ${grid.cs}`;
  return el;
}

// 기록지용 좌석. 출석부와 클래스를 공유하지 않는다 —
// 여기서 칠하는 색은 출석 여부가 아니라 "무엇을 받았는지"라서 의미가 다르다.
export function appendSheetSeats(block, seatNos, seatByNo) {
  for (const seatNo of seatNos) {
    const seat = seatByNo.get(seatNo);

    const btn = document.createElement("button");
    btn.className = "seat";
    btn.type = "button";
    btn.dataset.seatNo = String(seatNo);

    if (seat) {
      btn.dataset.seatId = seat.id;

      const nameEl = document.createElement("span");
      nameEl.className = "seat-name";
      nameEl.textContent = seat.personName ?? "";
      btn.appendChild(nameEl);

      if (seat.color === 1) {
        btn.classList.add("blue-seat");
      }
    }

    block.appendChild(btn);
  }
}

// 좌석 하나에 찍힌 표시를 화면에 반영한다. 첫 렌더링과 클릭 처리가 같은 함수를 쓴다.
// mark 가 없으면 미수령 — 아무 표시도 남기지 않고 기본 좌석으로 되돌린다.
export function applySeatMark(btn, mark, note) {
  const oldTag = btn.querySelector(".mark-note");
  if (oldTag) oldTag.remove();

  if (!mark) {
    btn.classList.remove("marked");
    btn.style.removeProperty("--mark-color");
    btn.style.removeProperty("--mark-bg");
    btn.removeAttribute("title");
    return;
  }

  btn.classList.add("marked");
  btn.style.setProperty("--mark-color", mark.color);

  // 옅은 배경색. color-mix() 는 구형 브라우저에서 통째로 무시되므로
  // 8자리 hex(#rrggbbaa)로 직접 만든다.
  btn.style.setProperty("--mark-bg", `${mark.color}22`);

  btn.title = mark.label;

  const trimmed = (note ?? "").trim();

  if (trimmed !== "") {
    const tag = document.createElement("span");
    tag.className = "mark-note";
    tag.textContent = trimmed;
    btn.appendChild(tag);
  }
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

      if (seat.color === 1) {
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

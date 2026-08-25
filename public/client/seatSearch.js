// 좌석 배치도에서 이름으로 좌석을 찾아 강조하고 화면을 그리로 옮긴다.
//
// 좌석 버튼 안에는 메모 말풍선 같은 자식 요소가 들어 있어서 textContent 로는
// 이름만 골라낼 수 없다. 그래서 seatId → 이름을 넘겨받아 쓴다.
export function bindSeatSearch(seatmap, getSeats) {
  const input = document.getElementById("seatSearch");
  const countEl = document.getElementById("searchCount");

  if (!input || !seatmap) return;

  input.addEventListener("input", () => {
    const keyword = input.value.trim();

    seatmap.querySelectorAll(".seat.found").forEach(el => {
      el.classList.remove("found");
    });

    if (!keyword) {
      if (countEl) countEl.textContent = "";
      return;
    }

    const nameById = new Map(
      (getSeats() ?? []).map(s => [String(s.id), s.personName ?? ""])
    );

    let firstMatch = null;
    let matchCount = 0;

    seatmap.querySelectorAll("button.seat").forEach(btn => {
      const name = nameById.get(btn.dataset.seatId) ?? "";

      if (name && name.includes(keyword)) {
        btn.classList.add("found");
        matchCount++;
        if (!firstMatch) firstMatch = btn;
      }
    });

    if (countEl) {
      countEl.textContent = matchCount === 0 ? "찾는 이름 없음" : `${matchCount}명`;
    }

    firstMatch?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

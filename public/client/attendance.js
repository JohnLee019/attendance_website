import { toggleAttendance, updateMemo } from "./api.js";

let isMemoMode = false;
let isMemoView = false;

export function bindAttendance(seatmap) {

  const memoModeBtn = document.getElementById("memoMode");
  const memoToggleBtn = document.getElementById("memoToggle");

  if (memoModeBtn) {
  memoModeBtn.textContent = "메모 작성하기";

  memoModeBtn.addEventListener("click", () => {
    isMemoMode = !isMemoMode;

    memoModeBtn.classList.toggle("active", isMemoMode);

    memoModeBtn.textContent = isMemoMode
      ? "메모 작성 중단하기"
      : "메모 작성하기";
  });
}

  if (memoToggleBtn) {
    memoToggleBtn.addEventListener("click", () => {
      isMemoView = !isMemoView;
      memoToggleBtn.classList.toggle("active", isMemoView);
      memoToggleBtn.textContent = isMemoView ? "메모 숨기기" : "메모 보기";

      // 메모 보기 끄면 모든 말풍선 닫기
      if (!isMemoView) {
        document.querySelectorAll(".seat").forEach(seat => {
          seat.classList.remove("show-memo");
        });
      }
    });
  }

  seatmap.addEventListener("click", async (e) => {

    if (e.target.classList.contains("memo-close")) {
      e.stopPropagation();

      const btn = e.target.closest("button.seat");
      if (!btn) return;

      const personId = Number(btn.dataset.personId);
      if (!personId) return;

      if (!confirm("메모를 삭제하시겠습니까?")) return;

      try {
        await updateMemo(personId, "");

        const bubble = btn.querySelector(".memo-bubble");
        if (bubble) bubble.remove();

        btn.classList.remove("has-memo");
        btn.classList.remove("show-memo");

      } catch (err) {
        console.error(err);
        alert("메모 삭제 실패");
      }
      return;
    }

    const btn = e.target.closest("button.seat");
    if (!btn) return;

    const seatId = Number(btn.dataset.seatId);
    const personId = Number(btn.dataset.personId);

    if (!seatId) return;

    try {

      if (isMemoMode) {

        if (!personId) return;

        const memo = prompt("메모를 입력하세요:");
        if (memo === null) return;

        await updateMemo(personId, memo);

        const oldBubble = btn.querySelector(".memo-bubble");
        if (oldBubble) oldBubble.remove();

        if (memo.trim() !== "") {

          btn.classList.add("has-memo");

          const bubble = document.createElement("div");
          bubble.className = "memo-bubble";

          const text = document.createElement("div");
          text.textContent = memo;

          const closeBtn = document.createElement("button");
          closeBtn.className = "memo-close";
          closeBtn.textContent = "×";

          bubble.appendChild(text);
          bubble.appendChild(closeBtn);
          btn.appendChild(bubble);

          // 작성 직후 자동 열림
          btn.classList.add("show-memo");

        } else {
          btn.classList.remove("has-memo");
          btn.classList.remove("show-memo");
        }

        return;
      }

      if (isMemoView) {

        if (!btn.classList.contains("has-memo")) return;

        // 다른 말풍선 전부 닫기
        document.querySelectorAll(".seat").forEach(seat => {
          if (seat !== btn) {
            seat.classList.remove("show-memo");
          }
        });

        // 현재 좌석 토글
        btn.classList.toggle("show-memo");
        return;
      }

      const data = await toggleAttendance(seatId);
      await window.loadTodayStats();
      btn.classList.toggle("present", data.isPresent);

    } catch (err) {
      console.error(err);
      alert("처리 실패");
    }
  });
}

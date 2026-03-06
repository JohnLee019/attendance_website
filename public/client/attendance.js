import { toggleAttendance, updateMemo } from "./api.js";

let isMemoMode = false;
let isMemoView = false;

function closeAllMemos(exceptBtn = null) {
  document.querySelectorAll(".seat.show-memo").forEach(seat => {
    if (seat !== exceptBtn) {
      seat.classList.remove("show-memo");
    }
  });
}

function setMemoMode(isOn, memoModeBtn, memoToggleBtn) {
  isMemoMode = isOn;

  if (isMemoMode) {
    isMemoView = false;
  }

  if (memoModeBtn) {
    memoModeBtn.classList.toggle("active", isMemoMode);
    memoModeBtn.textContent = isMemoMode
      ? "메모 작성 중단하기"
      : "메모 작성하기";
  }

  if (memoToggleBtn) {
    memoToggleBtn.classList.toggle("active", isMemoView);
    memoToggleBtn.textContent = isMemoView
      ? "메모 숨기기"
      : "메모 보기";
  }

  if (!isMemoView) {
    closeAllMemos();
  }
}

function setMemoViewMode(isOn, memoModeBtn, memoToggleBtn) {
  isMemoView = isOn;

  if (isMemoView) {
    isMemoMode = false;
  }

  if (memoModeBtn) {
    memoModeBtn.classList.toggle("active", isMemoMode);
    memoModeBtn.textContent = isMemoMode
      ? "메모 작성 중단하기"
      : "메모 작성하기";
  }

  if (memoToggleBtn) {
    memoToggleBtn.classList.toggle("active", isMemoView);
    memoToggleBtn.textContent = isMemoView
      ? "메모 숨기기"
      : "메모 보기";
  }

  if (!isMemoView) {
    closeAllMemos();
  }
}

function createMemoBubble(memo) {
  const bubble = document.createElement("div");
  bubble.className = "memo-bubble";

  const text = document.createElement("div");
  text.className = "memo-text";
  text.textContent = memo;

  const closeBtn = document.createElement("button");
  closeBtn.className = "memo-close";
  closeBtn.type = "button";
  closeBtn.textContent = "×";

  bubble.appendChild(text);
  bubble.appendChild(closeBtn);

  return bubble;
}

function updateSeatMemoUI(btn, memo) {
  const oldBubble = btn.querySelector(".memo-bubble");
  if (oldBubble) oldBubble.remove();

  const trimmedMemo = memo.trim();

  if (trimmedMemo !== "") {
    btn.classList.add("has-memo");
    btn.appendChild(createMemoBubble(trimmedMemo));
    btn.classList.add("show-memo");
  } else {
    btn.classList.remove("has-memo");
    btn.classList.remove("show-memo");
  }
}

function syncSeatState(seatId, updater) {
  const seats = window.appState?.seats;
  if (!Array.isArray(seats)) return;

  const seat = seats.find(s => s.seatNo === seatId);
  if (!seat) return;

  updater(seat);

}

async function handleMemoDelete(btn) {
  const personId = Number(btn.dataset.personId);
  const seatId = Number(btn.dataset.seatId);

  if (!personId || !seatId) return;

  if (!confirm("메모를 삭제하시겠습니까?")) return;

  await updateMemo(personId, "");

  updateSeatMemoUI(btn, "");

  syncSeatState(seatId, seat => {
    seat.memo = "";
  });
}

async function handleMemoWrite(btn) {
  const personId = Number(btn.dataset.personId);
  const seatId = Number(btn.dataset.seatId);

  if (!personId || !seatId) return;

  const memo = prompt("메모를 입력하세요:");
  if (memo === null) return;

  await updateMemo(personId, memo);

  closeAllMemos(btn);
  updateSeatMemoUI(btn, memo);

  syncSeatState(seatId, seat => {
    seat.memo = memo;
  });
}

function handleMemoView(btn) {
  if (!btn.classList.contains("has-memo")) return;

  const willOpen = !btn.classList.contains("show-memo");

  closeAllMemos(btn);

  btn.classList.toggle("show-memo", willOpen);
}

async function handleAttendanceToggle(btn) {
  const seatId = Number(btn.dataset.seatId);
  if (!seatId) return;

  const data = await toggleAttendance(seatId);

  btn.classList.toggle("present", data.isPresent);

  syncSeatState(seatId, seat => {
    seat.present = data.isPresent ? 1 : 0;
  });

  if (window.loadTodayStats) {
    await window.loadTodayStats();
  }
}

export function bindAttendance(seatmap) {
  const memoModeBtn = document.getElementById("memoMode");
  const memoToggleBtn = document.getElementById("memoToggle");

  if (memoModeBtn) {
    memoModeBtn.textContent = "메모 작성하기";

    memoModeBtn.addEventListener("click", () => {
      setMemoMode(!isMemoMode, memoModeBtn, memoToggleBtn);
    });
  }

  if (memoToggleBtn) {
    memoToggleBtn.textContent = "메모 보기";

    memoToggleBtn.addEventListener("click", () => {
      setMemoViewMode(!isMemoView, memoModeBtn, memoToggleBtn);
    });
  }

  seatmap.addEventListener("click", async (e) => {
    const closeBtn = e.target.closest(".memo-close");
    if (closeBtn) {
      e.stopPropagation();

      const btn = closeBtn.closest("button.seat");
      if (!btn) return;

      try {
        await handleMemoDelete(btn);
      } catch (err) {
        console.error(err);
        alert("메모 삭제 실패");
      }
      return;
    }

    const btn = e.target.closest("button.seat");
    if (!btn) return;

    const seatId = Number(btn.dataset.seatId);
    if (!seatId) return;

    try {
      if (isMemoMode) {
        await handleMemoWrite(btn);
        return;
      }

      if (isMemoView) {
        handleMemoView(btn);
        return;
      }

      await handleAttendanceToggle(btn);
    } catch (err) {
      console.error(err);
      alert("처리 실패");
    }
  });
}
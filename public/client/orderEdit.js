import { bindExcelFormat } from "./excelFormat.js";

const list = document.getElementById("orderList");
const saveBtn = document.getElementById("saveOrder");
const statusEl = document.getElementById("orderStatus");

let dirty = false;

function setStatus(text, isDirty = dirty) {
  dirty = isDirty;
  statusEl.textContent = text;
}

/* =========================
   목록 그리기
========================= */

async function load() {
  const res = await fetch("/api/person-order");

  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  if (!res.ok) {
    setStatus("목록을 불러오지 못했습니다.");
    return;
  }

  const people = await res.json();

  list.innerHTML = "";

  people.forEach(p => {
    const li = document.createElement("li");
    li.className = "order-item";
    li.dataset.personId = String(p.personId);

    // 엑셀에 나오는 차례. 자리에 붙어 있는 번호라서 항목이 움직여도 그대로 있는다 —
    // 그리는 시점에는 비워 두고 renumber() 가 채운다.
    const index = document.createElement("span");
    index.className = "order-index";
    index.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "order-name";
    name.textContent = p.name;

    // 손잡이에만 touch-action:none 을 걸어 둔다.
    // 항목 전체를 잡게 하면 휴대폰에서 목록 스크롤이 아예 막힌다.
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "≡";
    handle.setAttribute("aria-label", "끌어서 순서 바꾸기");

    li.append(index, name, handle);
    list.appendChild(li);
  });

  renumber();
}

// 왼쪽 번호를 위에서부터 1,2,3… 으로 다시 매긴다.
//
// <ol> 의 기본 번호를 쓰지 않는 이유: 항목 밖 회색 마커라 눈에 잘 띄지 않았다.
// 여기서는 번호를 항목 안 고정 칸에 그리고, 순서를 바꿀 때마다 자리 기준으로 다시 쓴다.
function renumber() {
  list.querySelectorAll(".order-item").forEach((li, i) => {
    li.querySelector(".order-index").textContent = String(i + 1);
  });
}

/* =========================
   끌어서 순서 바꾸기
========================= */

let dragEl = null;
let dragPointerId = null;

// 목록이 길어서, 끌고 화면 끝에 가면 저절로 스크롤돼야 한다.
function autoScroll(clientY) {
  const margin = 80;
  const speed = 12;

  if (clientY < margin) {
    window.scrollBy(0, -speed);
  } else if (clientY > window.innerHeight - margin) {
    window.scrollBy(0, speed);
  }
}

// 손가락·마우스가 있는 높이에서 가장 가까운 항목을 찾는다.
//
// 예전에는 elementFromPoint 로 밑에 깔린 항목을 집었는데, 그러려면
// 끌리는 항목에 pointer-events:none 이 걸려 있어야 하고 포인터 캡처까지 맞물려야 했다.
// 전제가 하나라도 어긋나면 끌어도 아무 일이 일어나지 않았다.
// 자리 계산은 그런 전제가 없다 — 항목 사이 빈틈이나 목록 밖에서도 답이 나온다.
function dropTarget(clientY) {
  let best = null;
  let bestDistance = Infinity;

  for (const li of list.querySelectorAll(".order-item")) {
    if (li === dragEl) continue;

    const rect = li.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(clientY - center);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = { li, after: clientY > center };
    }
  }

  return best;
}

function onPointerMove(e) {
  if (!dragEl || e.pointerId !== dragPointerId) return;

  // 끄는 동안 화면이 따라 움직이거나 글자가 선택되는 것을 막는다.
  e.preventDefault();
  autoScroll(e.clientY);

  const target = dropTarget(e.clientY);
  if (!target) return;

  const next = target.after ? target.li.nextSibling : target.li;
  if (next === dragEl) return;   // 이미 그 자리다

  list.insertBefore(dragEl, next);

  renumber();
  setStatus("저장하지 않은 변경이 있습니다.", true);
}

function endDrag(e) {
  if (!dragEl || e.pointerId !== dragPointerId) return;

  dragEl.classList.remove("dragging");

  dragEl = null;
  dragPointerId = null;

  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);
}

list.addEventListener("pointerdown", e => {
  const handle = e.target.closest(".drag-handle");
  if (!handle) return;

  dragEl = handle.closest(".order-item");
  if (!dragEl) return;

  dragPointerId = e.pointerId;
  dragEl.classList.add("dragging");

  // 움직임과 놓기는 window 에서 듣는다.
  // 목록에만 걸어 두면 손가락이 목록 밖으로 나가는 순간 끌기가 조용히 멈춘다.
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  e.preventDefault();
});

/* =========================
   저장
========================= */

saveBtn.addEventListener("click", async () => {
  const order = [...list.querySelectorAll(".order-item")]
    .map(li => Number(li.dataset.personId));

  if (!order.length) return;

  saveBtn.disabled = true;
  setStatus("저장 중…");

  try {
    const res = await fetch("/api/person-order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order })
    });

    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      setStatus(msg.message || "저장 실패", true);
      return;
    }

    setStatus("저장했습니다.", false);
  } catch (err) {
    console.error(err);
    setStatus("저장 실패", true);
  } finally {
    saveBtn.disabled = false;
  }
});

// 순서를 바꿔 놓고 저장을 잊은 채 나가는 일이 잦아서 한 번 잡아준다.
// 열 구성은 저장하지 않아도 엑셀이 달라지지 않으므로 여기서 보지 않는다.
window.addEventListener("beforeunload", e => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = "";
});

bindExcelFormat();
load();

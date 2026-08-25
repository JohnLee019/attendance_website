import { SEAT_BLOCKS } from "../shared/seatLayout.js";
import { makeBlock, appendSheetSeats, applySeatMark } from "./seatRenderer.js";
import { bindSeatSearch } from "./seatSearch.js";
import { toast } from "./toast.js";

const sheetId = Number(new URLSearchParams(location.search).get("id"));

const titleEl = document.getElementById("sheetTitle");
const statsEl = document.getElementById("sheetStats");
const markBarEl = document.getElementById("markBar");
const markEditorEl = document.getElementById("markEditor");
const seatmap = document.getElementById("seatmap");

let marks = [];
let seats = [];
let activeMarkId = null;
let editingMarkId = null;
let sheetDate = null;

function markById(id) {
  return marks.find(m => m.id === id) ?? null;
}

/* =========================
   표시 버튼 (본인 수령 / 대리 수령 / 직접 만든 것)
========================= */

function renderMarkBar() {
  markBarEl.innerHTML = "";

  marks.forEach(mark => {
    const wrap = document.createElement("span");
    wrap.className = "mark-btn-wrap";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mark-btn";
    btn.textContent = mark.label;
    btn.style.setProperty("--mark-color", mark.color);
    btn.classList.toggle("active", mark.id === activeMarkId);

    // 같은 버튼을 다시 누르면 꺼진다 — 실수로 좌석을 건드리는 걸 막는 안전장치.
    btn.addEventListener("click", () => {
      activeMarkId = activeMarkId === mark.id ? null : mark.id;
      renderMarkBar();
    });

    // 고치기와 지우기는 붙어 있으므로, 눌렀을 때 좌석을 찍는 표시까지
    // 바뀌지 않도록 클릭이 버튼 밖으로 새어 나가지 않게 막는다.
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "mark-edit";
    edit.textContent = "✎";
    edit.title = `${mark.label} 표시 고치기`;

    edit.addEventListener("click", e => {
      e.stopPropagation();
      editingMarkId = editingMarkId === mark.id ? null : mark.id;
      renderMarkEditor();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "mark-del";
    del.textContent = "×";
    del.title = `${mark.label} 표시 지우기`;

    del.addEventListener("click", async e => {
      e.stopPropagation();
      await deleteMark(mark);
    });

    wrap.append(btn, edit, del);
    markBarEl.appendChild(wrap);
  });

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "mark-add";
  addBtn.textContent = "＋ 직접 지정하기";
  addBtn.addEventListener("click", addMark);

  markBarEl.appendChild(addBtn);
}

/* =========================
   표시 고치기
========================= */

// 이름을 잘못 적었거나 색이 헷갈린다고 표시를 지웠다 다시 만들면,
// 그 표시가 찍힌 좌석 기록이 통째로 날아간다. 그래서 제자리에서 고친다.
function renderMarkEditor() {
  if (!markEditorEl) return;

  const mark = markById(editingMarkId);

  if (!mark) {
    markEditorEl.hidden = true;
    markEditorEl.innerHTML = "";
    return;
  }

  markEditorEl.hidden = false;
  markEditorEl.innerHTML = `
    <form class="mark-editor-form">
      <label class="mark-field">
        이름
        <input type="text" name="label" maxlength="20" required>
      </label>

      <label class="mark-field">
        색깔
        <input type="color" name="color">
      </label>

      <label class="mark-check">
        <input type="checkbox" name="needsNote">
        찍을 때마다 메모 묻기
      </label>

      <span class="mark-editor-buttons">
        <button type="submit" class="btn-primary">저장</button>
        <button type="button" class="btn-cancel">취소</button>
      </span>

      <p class="mark-editor-note"></p>
    </form>
  `;

  const form = markEditorEl.querySelector("form");

  // 값은 innerHTML 이 아니라 여기서 넣는다 — 이름에 따옴표가 들어가도 안전하게.
  form.label.value = mark.label;
  form.color.value = mark.color;
  form.needsNote.checked = mark.needsNote === 1;

  form.querySelector(".mark-editor-note").textContent =
    "기록지의 표시는 출석부를 건드리지 않습니다. 여기서 무엇을 찍든 출석은 그대로입니다.";

  form.querySelector(".btn-cancel").addEventListener("click", () => {
    editingMarkId = null;
    renderMarkEditor();
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    await saveMark(mark, form);
  });

  form.label.focus();
  form.label.select();
}

async function saveMark(mark, form) {
  const label = form.label.value.trim();

  if (!label) {
    alert("표시 이름을 입력해 주세요.");
    form.label.focus();
    return;
  }

  const res = await fetch(`/api/seat-sheets/${sheetId}/marks/${mark.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      label,
      color: form.color.value,
      needsNote: form.needsNote.checked
    })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    alert(body.message || "표시를 고치지 못했습니다.");
    return;
  }

  const updated = await res.json();

  marks = marks.map(m => (m.id === updated.id ? updated : m));

  // 이 표시가 찍힌 좌석도 새 이름·색으로 다시 칠한다.
  seats.forEach(seat => {
    if (seat.markId !== updated.id) return;

    const btn = seatmap.querySelector(`button.seat[data-seat-id="${seat.id}"]`);
    if (btn) applySeatMark(btn, updated, seat.note);
  });

  editingMarkId = null;

  renderMarkBar();
  renderMarkEditor();
  updateStats();

  toast(`"${updated.label}" 표시를 고쳤습니다.`);
}

async function addMark() {
  const label = prompt("만들 표시의 이름을 입력하세요 (예: 김치 받음)");
  if (label === null) return;

  if (!label.trim()) {
    alert("표시 이름을 입력해 주세요.");
    return;
  }

  const needsNote = confirm(
    `"${label.trim()}" 표시를 찍을 때마다 메모를 입력할까요?\n\n` +
    `확인 = 메모를 묻습니다 (예: 대신 가져간 사람 이름)\n` +
    `취소 = 메모 없이 표시만 합니다`
  );

  const res = await fetch(`/api/seat-sheets/${sheetId}/marks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, needsNote })
  });

  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    alert(msg.message || "표시를 만들지 못했습니다.");
    return;
  }

  const mark = await res.json();

  marks.push(mark);
  activeMarkId = mark.id;      // 방금 만든 표시로 바로 찍을 수 있게
  renderMarkBar();
}

async function deleteMark(mark) {
  const used = seats.filter(s => s.markId === mark.id).length;

  const warning = used > 0
    ? `\n\n이 표시가 찍힌 좌석 ${used}곳도 함께 지워집니다.`
    : "";

  if (!confirm(`"${mark.label}" 표시를 지울까요?${warning}`)) return;

  const res = await fetch(`/api/seat-sheets/${sheetId}/marks/${mark.id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    alert("표시를 지우지 못했습니다.");
    return;
  }

  marks = marks.filter(m => m.id !== mark.id);
  if (activeMarkId === mark.id) activeMarkId = null;
  if (editingMarkId === mark.id) editingMarkId = null;

  // 서버에서 CASCADE 로 지워진 좌석을 화면에서도 비운다.
  seats.forEach(seat => {
    if (seat.markId !== mark.id) return;

    seat.markId = null;
    seat.note = "";

    const btn = seatmap.querySelector(`button.seat[data-seat-id="${seat.id}"]`);
    if (btn) applySeatMark(btn, null, "");
  });

  renderMarkBar();
  renderMarkEditor();
  updateStats();
}

/* =========================
   좌석 찍기
========================= */

function updateStats() {
  const named = seats.filter(s => (s.personName ?? "") !== "");

  const parts = marks.map(m => {
    const n = named.filter(s => s.markId === m.id).length;
    return `${m.label} ${n}`;
  });

  const marked = named.filter(s => s.markId != null).length;

  statsEl.textContent =
    `표시 ${marked}명 / ${named.length}명` +
    (parts.length ? ` (${parts.join(" · ")})` : "");
}

// 응답을 기다리는 동안 다시 눌리면 화면과 DB 가 어긋난다.
// 콜드 스타트 때 실제로 자주 일어나므로 좌석 단위로 잠근다.
const pendingSeats = new Set();

async function handleSeatClick(btn) {
  const id = Number(btn.dataset.seatId);
  const seat = seats.find(s => s.id === id);

  if (!seat || (seat.personName ?? "") === "") return;
  if (pendingSeats.has(id)) return;

  if (activeMarkId === null) {
    alert("먼저 위에서 표시를 고른 다음 좌석을 눌러 주세요.");
    return;
  }

  const prevMarkId = seat.markId;
  const prevNote = seat.note;

  // 이미 같은 표시가 찍혀 있으면 지운다 — 잘못 누른 걸 되돌리는 방법.
  const isSame = seat.markId === activeMarkId;
  const mark = markById(activeMarkId);

  let nextMarkId = isSame ? null : activeMarkId;
  let nextNote = "";

  if (!isSame && mark.needsNote) {
    const answer = prompt(`${mark.label} — 누가 대신 가져갔나요?`, seat.note ?? "");
    if (answer === null) return;          // 취소하면 아무것도 바꾸지 않는다
    nextNote = answer.trim();
  }

  seat.markId = nextMarkId;
  seat.note = nextNote;

  applySeatMark(btn, markById(nextMarkId), nextNote);
  updateStats();

  pendingSeats.add(id);

  try {
    const res = await fetch(`/api/seat-sheets/${sheetId}/entry`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatId: id, markId: nextMarkId, note: nextNote })
    });

    if (!res.ok) throw new Error("기록 저장 실패");
  } catch (err) {
    // 저장이 실패했는데 화면만 바뀌어 있으면 실제로 안 준 사람을 줬다고 착각하게 된다.
    seat.markId = prevMarkId;
    seat.note = prevNote;

    applySeatMark(btn, markById(prevMarkId), prevNote);
    updateStats();

    console.error(err);
    alert("기록을 저장하지 못했습니다. 다시 눌러 주세요.");
  } finally {
    pendingSeats.delete(id);
  }
}

/* =========================
   초기 로딩
========================= */

// 좌석도 버튼도 없는 빈 화면만 남으면 무엇이 잘못됐는지 알 길이 없다.
// 원인을 화면에 그대로 드러낸다.
function showError(message) {
  titleEl.textContent = "기록지를 불러오지 못했습니다";
  statsEl.textContent = message;
  statsEl.style.color = "#c00";
}

async function load() {
  if (!sheetId) {
    titleEl.textContent = "잘못된 기록지 주소입니다";
    return;
  }

  const res = await fetch(`/api/seat-sheets/${sheetId}`);

  if (res.status === 401) {
    window.location.href = "/login.html";
    return;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    showError(body.message || `서버 오류 (${res.status})`);
    return;
  }

  const sheet = await res.json();

  titleEl.textContent = sheet.title;
  document.title = `${sheet.title} — 좌석 기록지`;

  sheetDate = sheet.sheetDate;
  marks = sheet.marks;
  seats = sheet.seats;

  const dateEl = document.getElementById("sheetDate");
  if (dateEl && sheetDate) {
    dateEl.textContent = `${sheetDate} 출석부에 반영됩니다`;
  }

  const seatByNo = new Map();
  seats.forEach(s => seatByNo.set(s.seatNo, s));

  seatmap.classList.add("is-grid");
  seatmap.innerHTML = "";

  SEAT_BLOCKS.forEach(({ seats: seatNos, grid, wide }) => {
    const block = makeBlock(wide ? "block wide" : "block", grid);
    appendSheetSeats(block, seatNos, seatByNo);
    seatmap.appendChild(block);
  });

  seats.forEach(seat => {
    if (seat.markId == null) return;

    const btn = seatmap.querySelector(`button.seat[data-seat-id="${seat.id}"]`);
    if (btn) applySeatMark(btn, markById(seat.markId), seat.note);
  });

  renderMarkBar();
  updateStats();

  seatmap.addEventListener("click", e => {
    const btn = e.target.closest("button.seat");
    if (btn) handleSeatClick(btn);
  });

  bindSeatSearch(seatmap, () => seats);
}

load().catch(err => {
  console.error(err);
  showError(err?.message ?? "알 수 없는 오류");
});

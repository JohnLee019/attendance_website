import { toast } from "./toast.js";

/* =========================
   공통 도우미
========================= */

// 되돌릴 수 없는 삭제만 confirm 으로 막고, 나머지 결과는 토스트로 알린다.

// 서버가 내려준 message 를 쓰되, 없으면 기본 문구로 대신한다.
async function failMessage(res, fallback) {
  const body = await res.json().catch(() => ({}));
  return body.message || fallback;
}

/* =========================
   엑셀 리포트 이메일
========================= */

const emailListEl = document.getElementById("emailList");
const emailForm = document.getElementById("emailForm");
const emailInput = document.getElementById("reportEmail");
const emailErrorEl = document.getElementById("emailError");
const saveBtn = document.getElementById("saveEmail");
const noEmailBanner = document.getElementById("noEmailBanner");

// 화면에 그려진 목록. 삭제 확인 문구와 중복 검사에 쓴다.
let emails = [];

// 오타는 저장 버튼 옆이 아니라 입력칸 바로 밑에서 알려 준다.
function showEmailError(message) {
  emailErrorEl.textContent = message ?? "";
  emailErrorEl.hidden = !message;
  emailInput.classList.toggle("is-invalid", Boolean(message));
}

function renderEmails() {
  emailListEl.innerHTML = "";

  noEmailBanner.hidden = emails.length === 0 || emails.some(e => e.isActive);

  if (!emails.length) {
    emailListEl.innerHTML =
      `<li class="empty-row">등록된 주소가 없습니다. 위에서 먼저 추가해 주세요.</li>`;
    return;
  }

  emails.forEach(e => {
    const li = document.createElement("li");
    li.className = e.isActive ? "email-row is-active" : "email-row";

    // 줄 전체가 라디오의 라벨이다 — 손가락으로도 정확히 고를 수 있게.
    const pick = document.createElement("label");
    pick.className = "email-pick";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "activeEmail";
    radio.value = String(e.id);
    radio.checked = e.isActive;

    const addr = document.createElement("span");
    addr.className = "email-addr";
    addr.textContent = e.email;

    pick.append(radio, addr);

    if (e.isActive) {
      const badge = document.createElement("span");
      badge.className = "email-badge";
      badge.textContent = "받는 중";
      pick.appendChild(badge);
    }

    const del = document.createElement("button");
    del.type = "button";
    del.className = "text-btn danger";
    del.dataset.deleteId = String(e.id);
    del.setAttribute("aria-label", `${e.email} 삭제`);
    del.textContent = "삭제";

    li.append(pick, del);
    emailListEl.appendChild(li);
  });
}

async function loadEmails() {
  const res = await fetch("/api/report-emails");

  if (!res.ok) {
    emailListEl.innerHTML =
      `<li class="empty-row">이메일 목록을 불러오지 못했습니다.</li>`;
    return;
  }

  emails = await res.json();
  renderEmails();
}

async function activateEmail(id) {
  const previous = emails;

  // 먼저 화면을 바꾸고 실패하면 되돌린다. 라디오는 즉각 반응해야 눌린 느낌이 난다.
  emails = emails.map(e => ({ ...e, isActive: e.id === id }));
  renderEmails();

  const res = await fetch("/api/report-emails/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });

  if (!res.ok) {
    emails = previous;
    renderEmails();
    toast(await failMessage(res, "받는 주소를 바꾸지 못했습니다."), "error");
    return;
  }

  toast(`${emails.find(e => e.id === id).email} 로 발송합니다.`);
}

async function deleteEmail(id) {
  const target = emails.find(e => e.id === id);
  if (!target) return;

  // 받는 중인 주소를 지우면 엑셀이 아무 데도 안 나간다. 그 사실을 먼저 알린다.
  const warning = target.isActive
    ? "\n\n이 주소는 지금 엑셀을 받는 중입니다. 지우면 발송이 멈춥니다."
    : "";

  if (!confirm(`${target.email}\n주소를 삭제할까요?${warning}`)) return;

  const res = await fetch(`/api/report-emails/${id}`, { method: "DELETE" });

  if (!res.ok) {
    toast(await failMessage(res, "삭제하지 못했습니다."), "error");
    return;
  }

  await loadEmails();
  toast("주소를 삭제했습니다.");
}

emailForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = emailInput.value.trim();

  if (!email) {
    showEmailError("이메일 주소를 입력해 주세요.");
    emailInput.focus();
    return;
  }

  // 브라우저의 type="email" 검사를 그대로 쓴다. 직접 만든 정규식보다 정확하다.
  if (!emailInput.checkValidity()) {
    showEmailError("이메일 형식이 올바르지 않습니다. 예: report@example.com");
    emailInput.focus();
    return;
  }

  // 서버에 중복 검사가 없어서 같은 주소가 몇 번이든 들어간다. 여기서 먼저 막는다.
  if (emails.some(e => e.email.toLowerCase() === email.toLowerCase())) {
    showEmailError("이미 등록된 주소입니다.");
    emailInput.focus();
    return;
  }

  showEmailError(null);
  saveBtn.disabled = true;

  try {
    const res = await fetch("/api/report-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    if (!res.ok) {
      showEmailError(await failMessage(res, "저장하지 못했습니다."));
      return;
    }

    emailInput.value = "";
    await loadEmails();

    // 첫 주소는 아무것도 받는 중이 아니므로, 바로 쓰라고 짚어 준다.
    toast(
      emails.some(e => e.isActive)
        ? "주소를 추가했습니다."
        : "주소를 추가했습니다. 받을 주소로 골라 주세요."
    );
  } finally {
    saveBtn.disabled = false;
  }
});

emailInput.addEventListener("input", () => showEmailError(null));

// 목록은 다시 그려질 때마다 갈리므로, 버튼마다 걸지 않고 한 번만 위임한다.
emailListEl.addEventListener("change", event => {
  const radio = event.target.closest("input[name='activeEmail']");
  if (radio) activateEmail(Number(radio.value));
});

emailListEl.addEventListener("click", event => {
  const btn = event.target.closest("[data-delete-id]");
  if (btn) deleteEmail(Number(btn.dataset.deleteId));
});

/* =========================
   좌석 기록지 목록
========================= */

const sheetListEl = document.getElementById("sheetList");

async function loadSheets() {
  const res = await fetch("/api/seat-sheets");

  if (!res.ok) {
    sheetListEl.innerHTML =
      `<p class="empty-row">기록지 목록을 불러오지 못했습니다.</p>`;
    return;
  }

  const sheets = await res.json();

  sheetListEl.innerHTML = "";

  if (!sheets.length) {
    sheetListEl.innerHTML = `<p class="empty-row">저장된 기록지가 없습니다.</p>`;
    return;
  }

  sheets.forEach(s => {
    const row = document.createElement("div");
    row.className = "sheet-row";

    const link = document.createElement("a");
    link.href = `seatSheet.html?id=${s.id}`;
    link.className = "sheet-title";
    link.textContent = s.title;

    const meta = document.createElement("span");
    meta.className = "sheet-meta";
    // sheetDate 는 이미 'YYYY-MM-DD' 문자열이라 그대로 쓴다.
    meta.textContent = `${s.sheetDate ?? ""} · ${s.markedCount}명 표시`;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "text-btn danger";
    delBtn.setAttribute("aria-label", `${s.title} 기록지 삭제`);
    delBtn.textContent = "삭제";

    // 기록지는 되살릴 수 없으니 제목까지 보여주고 확인받는다.
    delBtn.addEventListener("click", async () => {
      if (!confirm(`"${s.title}" 기록지를 삭제할까요?\n\n되돌릴 수 없습니다.`)) return;

      const delRes = await fetch(`/api/seat-sheets/${s.id}`, { method: "DELETE" });

      if (!delRes.ok) {
        toast(await failMessage(delRes, "삭제하지 못했습니다."), "error");
        return;
      }

      await loadSheets();
      toast("기록지를 삭제했습니다.");
    });

    row.append(link, meta, delBtn);
    sheetListEl.appendChild(row);
  });
}

loadEmails();
loadSheets();

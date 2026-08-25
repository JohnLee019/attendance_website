import { toast } from "./toast.js";

// 월간 출석부 엑셀의 열 구성 편집.
//
// 이름 순서와 같은 화면(orderEdit.html)에 산다 — 둘 다 "엑셀이 어떤 모양으로 나오는가"를
// 정하는 일이라, 설정 화면과 순서 화면으로 나뉘어 있으면 한 번에 확인할 수 없다.
//
// 쓰려면 화면에 fmtSeatNo·fmtTotal·fmtRate·fmtMark·fmtPreview·formatError·saveFormat 이 있어야 한다.
export function bindExcelFormat() {
  const seatNoEl = document.getElementById("fmtSeatNo");
  const totalEl = document.getElementById("fmtTotal");
  const rateEl = document.getElementById("fmtRate");
  const markEl = document.getElementById("fmtMark");
  const previewEl = document.getElementById("fmtPreview");
  const errorEl = document.getElementById("formatError");
  const saveEl = document.getElementById("saveFormat");

  if (!saveEl) return;

  function readFormat() {
    return {
      showSeatNo: seatNoEl.checked,
      showTotal: totalEl.checked,
      showRate: rateEl.checked,
      presentMark: markEl.value
    };
  }

  function showError(message) {
    errorEl.textContent = message ?? "";
    errorEl.hidden = !message;
  }

  // 저장하기 전에 표가 어떤 모양이 되는지 보여준다.
  // 실제 엑셀은 31열이라 여기서는 앞 세 날짜만 보이고 나머지는 '…' 로 줄인다 —
  // 바뀌는 건 양 끝의 열이라서, 그것만 확인되면 충분하다.
  function renderPreview() {
    const format = readFormat();

    const head = [];
    if (format.showSeatNo) head.push("좌석번호");
    head.push("성명", "1", "2", "3", "…");
    if (format.showTotal) head.push("총 출석 일수");
    if (format.showRate) head.push("출석률");

    const body = [];
    if (format.showSeatNo) body.push("7");
    body.push("홍길동", format.presentMark, "", format.presentMark, "…");
    if (format.showTotal) body.push("2");
    if (format.showRate) body.push("67%");

    previewEl.innerHTML = "";

    const headRow = previewEl.insertRow();
    for (const text of head) {
      const th = document.createElement("th");
      th.textContent = text;
      headRow.appendChild(th);
    }

    const bodyRow = previewEl.insertRow();
    for (const text of body) {
      bodyRow.insertCell().textContent = text;
    }
  }

  async function load() {
    const res = await fetch("/api/excel-format");

    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!res.ok) {
      toast("엑셀 양식을 불러오지 못했습니다.", "error");
      return;
    }

    const format = await res.json();

    seatNoEl.checked = format.showSeatNo;
    totalEl.checked = format.showTotal;
    rateEl.checked = format.showRate;
    markEl.value = format.presentMark;

    renderPreview();
  }

  for (const el of [seatNoEl, totalEl, rateEl, markEl]) {
    el.addEventListener("change", () => {
      showError(null);
      renderPreview();
    });
  }

  saveEl.addEventListener("click", async () => {
    saveEl.disabled = true;
    showError(null);

    try {
      const res = await fetch("/api/excel-format", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readFormat())
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        showError(detail.message || "양식을 저장하지 못했습니다.");
        return;
      }

      toast("엑셀 양식을 저장했습니다.");
    } catch (err) {
      console.error(err);
      showError("양식을 저장하지 못했습니다.");
    } finally {
      saveEl.disabled = false;
    }
  });

  load();
}

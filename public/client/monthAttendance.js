import { toast } from "./toast.js";

const table = document.getElementById("attendanceTable");
const title = document.getElementById("title");
const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");
const countEl = document.getElementById("searchCount");

// 지금 화면에 그려져 있는 달. 엑셀을 받을 때도 이 값을 쓴다 —
// 브라우저 시계로 다시 계산하면 KST 가 아닌 기기에서 달이 어긋난다.
let currentPeriod = null;

// year·month 를 안 넘기면 서버가 이번 달(KST)로 정해 준다.
// 화면을 처음 열 때가 그렇다 — 기본값을 브라우저가 정하지 않는다.
function periodQuery(year, month) {
  return year && month ? `?year=${year}&month=${month}` : "";
}

function dateOf(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 출석 기록 조회에서 '← 월 별 출석표' 로 돌아왔을 때 보던 달로 돌아오게 한다.
// 주소에 값이 없거나 형식이 틀리면 null — 그러면 서버가 이번 달로 정해 준다.
function periodFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const year = Number(params.get("year"));
  const month = Number(params.get("month"));

  const ok =
    Number.isInteger(year) && Number.isInteger(month) &&
    month >= 1 && month <= 12;

  return ok ? { year, month } : null;
}

function render(year, month, data) {

  title.textContent = `${year}년 ${month}월 출석 현황`;

  const daysInMonth = new Date(year, month, 0).getDate();

  table.innerHTML = "";

  // 달을 바꾸면 이전 달에서 찾은 결과는 의미가 없다.
  if (countEl) countEl.textContent = "";

  //운영일 계산 (한 사람이라도 출석한 날)
  const activeDays = new Set();

  data.forEach(person => {
    person.days.forEach(d => activeDays.add(d));
  });

  const activeDayCount = activeDays.size;
  const header = document.createElement("tr");

  const thSeat = document.createElement("th");
  thSeat.textContent = "좌석";
  header.appendChild(thSeat);

  const thName = document.createElement("th");
  thName.textContent = "성명";
  header.appendChild(thName);

  for (let d = 1; d <= daysInMonth; d++) {
    const th = document.createElement("th");
    th.textContent = d;

    // 날짜를 누르면 그날 좌석 배치도로 간다. 자세한 이유는 아래 bindDateJump 참고.
    th.dataset.date = dateOf(year, month, d);
    th.title = `${month}월 ${d}일 출석 기록 열기`;

    header.appendChild(th);
  }

  const thTotal = document.createElement("th");
  thTotal.textContent = "총 출석";
  header.appendChild(thTotal);

  const thRate = document.createElement("th");
  thRate.textContent = "출석률";
  header.appendChild(thRate);

  table.appendChild(header);

  data.forEach(person => {

    const tr = document.createElement("tr");

    const tdSeat = document.createElement("td");
    tdSeat.textContent = person.seatNo;
    tr.appendChild(tdSeat);

    const tdName = document.createElement("td");
    tdName.textContent = person.name;
    tr.appendChild(tdName);

    // 이름 검색이 찾아갈 대상. 셀 내용이 아니라 여기서 이름을 읽는다.
    tr.dataset.name = person.name ?? "";

    let presentCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {

      const date = dateOf(year, month, d);

      const td = document.createElement("td");

      if (person.days.includes(date)) {
        td.textContent = "0";
        presentCount++;
      }

      td.dataset.date = date;
      td.title = `${person.name} — ${month}월 ${d}일 출석 기록 열기`;

      tr.appendChild(td);
    }

    // 총 출석

    const totalTd = document.createElement("td");
    totalTd.textContent = presentCount;
    tr.appendChild(totalTd);

    // 출석률

    const rateTd = document.createElement("td");

    if (activeDayCount === 0) {
      rateTd.textContent = "0%";
    } else {
      rateTd.textContent =
        Math.round((presentCount / activeDayCount) * 100) + "%";
    }

    tr.appendChild(rateTd);

    table.appendChild(tr);
  });

}

async function loadAttendance(year, month) {

  // 느린 날에는 응답이 몇 초 걸릴 수 있다. 빈 화면을 보여 주면 멈춘 줄 알고
  // 계속 누르게 되므로, 기다리는 중이라는 걸 먼저 알린다.
  title.textContent = "불러오는 중…";

  const res = await fetch("/api/monthAttendance" + periodQuery(year, month));

  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    title.textContent = "출석 현황을 불러오지 못했습니다";
    toast("출석 현황을 불러오지 못했습니다.", "error");
    return;
  }

  const json = await res.json();

  // 어느 달을 그렸는지는 서버가 알려준 값을 그대로 따른다.
  currentPeriod = { year: json.year, month: json.month };

  render(json.year, json.month, json.data);
}

/* =========================
   달 고르기
========================= */

// 연도 목록은 출석 기록이 있는 해만 서버가 내려준다.
// 지금 보고 있는 해는 항상 넣는다 — 새해 첫 달처럼 아직 기록이 없는 해도 있다.
async function fillPeriodPickers() {
  if (!yearSelect || !monthSelect || !currentPeriod) return;

  let years = [];

  try {
    const res = await fetch("/api/attendanceYears");
    if (res.ok) years = await res.json();
  } catch (err) {
    console.error(err);
  }

  if (!years.includes(currentPeriod.year)) {
    years.push(currentPeriod.year);
  }

  years.sort((a, b) => b - a);

  yearSelect.innerHTML = "";

  for (const y of years) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = `${y}년`;
    yearSelect.appendChild(opt);
  }

  monthSelect.innerHTML = "";

  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement("option");
    opt.value = String(m);
    opt.textContent = `${m}월`;
    monthSelect.appendChild(opt);
  }

  yearSelect.value = String(currentPeriod.year);
  monthSelect.value = String(currentPeriod.month);
}

function bindPeriodChange() {
  if (!yearSelect || !monthSelect) return;

  // 불러오는 동안은 고르개를 잠근다 — 연달아 바꾸면 늦게 온 응답이
  // 나중에 도착해서, 화면과 고른 달이 어긋날 수 있다.
  async function onChange() {
    const year = Number(yearSelect.value);
    const month = Number(monthSelect.value);

    yearSelect.disabled = true;
    monthSelect.disabled = true;

    try {
      await loadAttendance(year, month);
    } finally {
      yearSelect.disabled = false;
      monthSelect.disabled = false;
    }
  }

  yearSelect.addEventListener("change", onChange);
  monthSelect.addEventListener("change", onChange);
}

/* =========================
   날짜 눌러서 그날로 가기
========================= */

// 표에서 이상한 칸을 찾았을 때, 그 날짜의 좌석 배치도로 곧장 넘어간다.
//
// 표 안에서 바로 고치게 하지 않는 이유: 날짜 칸은 28×26px 이고 한 달이면
// 가로로 30열이 넘는다. 옆칸을 잘못 눌러도 화면에 경고가 없어서, 엉뚱한 사람의
// 출석이 조용히 바뀐 채로 월간 리포트 메일에 실려 나갈 수 있다.
// 고치는 일은 이름이 큼직하게 붙어 있는 좌석 배치도에서 한다.
//
// 그래서 여기서는 아무것도 바꾸지 않고 이동만 한다 — 잘못 눌러도 화면이
// 바뀌는 게 눈에 보이고, 뒤로 가면 그만이다.
function bindDateJump() {
  table.addEventListener("click", e => {
    const cell = e.target.closest("[data-date]");
    if (!cell || !table.contains(cell)) return;

    window.location.href = `history.html?date=${cell.dataset.date}`;
  });
}

/* =========================
   이름으로 찾기
========================= */

function bindNameSearch() {
  const input = document.getElementById("seatSearch");

  if (!input) return;

  function clearHighlight() {
    table.querySelectorAll("tr.found").forEach(tr => tr.classList.remove("found"));
  }

  function runSearch() {
    const keyword = input.value.trim();

    clearHighlight();

    if (!keyword) {
      if (countEl) countEl.textContent = "";
      return;
    }

    let firstMatch = null;
    let matchCount = 0;

    table.querySelectorAll("tr[data-name]").forEach(tr => {
      if (tr.dataset.name.includes(keyword)) {
        tr.classList.add("found");
        matchCount++;
        if (!firstMatch) firstMatch = tr;
      }
    });

    if (countEl) {
      countEl.textContent = matchCount === 0 ? "찾는 이름 없음" : `${matchCount}명`;
    }

    firstMatch?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // 글자를 칠 때마다 찾지 않고, 엔터를 눌렀을 때만 찾는다.
  //
  // setTimeout 으로 한 박자 미루는 이유: 한글은 조합 중에 엔터를 누르면
  // 그 엔터가 먼저 글자를 완성시킨다(isComposing). 바로 읽으면 마지막 글자가
  // 빠진 값으로 찾게 되므로, 조합이 끝난 뒤의 값으로 찾는다.
  input.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;

    e.preventDefault();
    setTimeout(runSearch, 0);
  });

  // 검색창의 × 로 지우면 강조도 같이 지운다.
  input.addEventListener("search", () => {
    if (!input.value.trim()) {
      clearHighlight();
      if (countEl) countEl.textContent = "";
    }
  });
}

/* =========================
   엑셀로 내려받기
========================= */

function bindExcelDownload() {
  const btn = document.getElementById("downloadExcel");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    // 화면에 그려져 있는 달을 그대로 받는다.
    if (!currentPeriod) {
      toast("먼저 출석 현황을 불러와 주세요.", "error");
      return;
    }

    const { year, month } = currentPeriod;

    btn.disabled = true;

    try {
      const res = await fetch("/api/monthExcel" + periodQuery(year, month));

      if (!res.ok) {
        // 401 이면 세션이 끊긴 것이다. 파일 대신 로그인 화면으로 보낸다.
        if (res.status === 401) {
          window.location.href = "/login.html";
          return;
        }

        toast("엑셀을 만들지 못했습니다.", "error");
        return;
      }

      // a[download] 로 받는다 — 이렇게 해야 파일 이름을 우리가 정할 수 있다.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const mm = String(month).padStart(2, "0");
      const a = document.createElement("a");

      a.href = url;
      a.download = `${year}-${mm} 경로식당 출석부.xlsx`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      // 곧바로 지우면 내려받기가 시작되기 전에 주소가 사라지는 브라우저가 있다.
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast("엑셀을 내려받았습니다.");
    } catch (err) {
      console.error(err);
      toast("엑셀을 내려받지 못했습니다.", "error");
    } finally {
      btn.disabled = false;
    }
  });
}

/* =========================
   시작
========================= */

// 주소에 달이 적혀 있지 않으면 아무것도 안 넘긴다 —
// 기본값(이번 달)은 브라우저가 아니라 KST 를 아는 서버가 정한다.
const startPeriod = periodFromUrl();

loadAttendance(startPeriod?.year, startPeriod?.month).then(async () => {
  await fillPeriodPickers();

  bindPeriodChange();
  bindDateJump();
  bindNameSearch();
  bindExcelDownload();
});
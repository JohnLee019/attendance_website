const KST = "Asia/Seoul";

// KST 기준 연/월/일 추출
export function getKSTParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day)
  };
}

// 해당 월의 마지막 날 (month는 1-based)
function getLastDay(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toRange(year, month) {
  const mm = String(month).padStart(2, "0");
  const dd = String(getLastDay(year, month)).padStart(2, "0");

  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${dd}`, year, month };
}

export function getTodayDate() {
  const { year, month, day } = getKSTParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 발송 이력에서 쓰는 연월 키 'YYYY-MM'
export function toPeriod(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getMonthRange(year, month) {
  return toRange(year, month);
}

export function getCurrentMonthRange() {
  const { year, month } = getKSTParts();
  return toRange(year, month);
}

export function getLastMonthRange() {
  const { year, month } = getKSTParts();
  return month === 1 ? toRange(year - 1, 12) : toRange(year, month - 1);
}
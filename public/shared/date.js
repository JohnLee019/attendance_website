export function getTodayDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());

  const map = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;

  return `${map.year}-${map.month}-${map.day}`;
}

export function getLastMonthRange() {
  const now = new Date();
  const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const lastMonthLastDay = new Date(firstDayThisMonth - 1);
  const lastMonthFirstDay = new Date(
    lastMonthLastDay.getFullYear(),
    lastMonthLastDay.getMonth(),
    1
  );

  function format(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return {
    start: format(lastMonthFirstDay),
    end: format(lastMonthLastDay),
    year: lastMonthLastDay.getFullYear(),
    month: lastMonthLastDay.getMonth() + 1
  };
}


export function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
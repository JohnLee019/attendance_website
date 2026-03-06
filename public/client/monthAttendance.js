const table = document.getElementById("attendanceTable");
const title = document.getElementById("title");

async function loadAttendance() {

  const res = await fetch("/api/currentMonthAttendance");
  const json = await res.json();

  const { year, month, data } = json;

  title.textContent = `${year}년 ${month}월 출석 현황`;

  const daysInMonth = new Date(year, month, 0).getDate();

  table.innerHTML = "";

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

    let presentCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {

      const date =
        `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

      const td = document.createElement("td");

      if (person.days.includes(date)) {
        td.textContent = "0";
        presentCount++;
      }

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

loadAttendance();
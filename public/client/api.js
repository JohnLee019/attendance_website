export async function fetchSeats() {
  const res = await fetch("/api/seats", {
    credentials: "include"  
  });
  if (!res.ok) throw new Error("좌석 데이터를 가져오지 못했습니다");
  return res.json();
}

export async function toggleAttendance(seatId) {
  const res = await fetch(`/api/seatattendance/${seatId}`, {
    method: "PATCH"
  });

  if (!res.ok) throw new Error("출석 상태 업데이트 실패");
  return res.json();
}

export async function updateMemo(personId, memo) {
  const res = await fetch(`/api/person/${personId}/memo`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memo })
  });

  if (!res.ok) {
    throw new Error("메모 저장 실패");
  }

  return res.json();
}

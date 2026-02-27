const listContainer = document.getElementById("emailList");
const saveBtn = document.getElementById("saveEmail");
const input = document.getElementById("reportEmail");

async function loadEmails() {
  const res = await fetch("/api/report-emails");
  if (!res.ok) {
    alert("이메일 목록을 불러오지 못했습니다.");
    return;
  }

  const emails = await res.json();
  listContainer.innerHTML = "";

  emails.forEach(e => {
    const div = document.createElement("div");

    div.innerHTML = `
      <label>
        <input type="radio" name="activeEmail"
          value="${e.id}" ${e.isActive ? "checked" : ""}>
        ${e.email}
      </label>
      <button data-id="${e.id}" class="deleteEmail" type="button">삭제</button>
    `;

    listContainer.appendChild(div);
  });

  document.querySelectorAll("input[name='activeEmail']").forEach(radio => {
    radio.addEventListener("change", async () => {
      await fetch("/api/report-emails/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(radio.value) })
      });
    });
  });

  document.querySelectorAll(".deleteEmail").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      if (!confirm("정말 삭제하시겠습니까?")) return;

      const delRes = await fetch(`/api/report-emails/${id}`, { method: "DELETE" });

      if (!delRes.ok) {
        const msg = await delRes.json().catch(() => ({}));
        alert(msg.message || "삭제 실패");
        return;
      }

      await loadEmails();
    });
  });
}

saveBtn.addEventListener("click", async () => {
  const email = input.value.trim();
  if (!email) return alert("이메일 입력");

  const res = await fetch("/api/report-emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    alert(msg.message || "저장 실패");
    return;
  }

  input.value = "";
  await loadEmails();
});

loadEmails();

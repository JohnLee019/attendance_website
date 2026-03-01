const form = document.getElementById("loginForm");

    form.addEventListener("submit", async (e) => {
      e.preventDefault(); // 기본 새로고침 막기

      const password = document.getElementById("password").value;

      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        window.location.href = "/index.html";
      } else {
        alert("비밀번호 틀림");
      }
    });
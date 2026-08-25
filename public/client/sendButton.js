// 이메일 발송 버튼 공통 처리.
//
// - 전송 중에는 버튼을 잠그고 "전송 중…"으로 바꾼다. 발송은 몇 초 걸리는데
//   아무 표시가 없으면 사용자가 계속 다시 누르게 된다.
// - 실패하면 서버가 내려준 message를 그대로 보여준다. "전송 실패"만 뜨면
//   원인을 알 수 없어 디버깅이 불가능하다.
//
// getBody: 요청 본문을 만드는 함수(선택). null 을 돌려주면 발송을 취소한다.
export function bindSendButton(button, url, { successMessage, getBody } = {}) {
  if (!button) return;

  button.addEventListener("click", async () => {
    let body;

    if (getBody) {
      body = getBody();
      if (!body) return;   // 조건이 안 갖춰짐 — 안내는 getBody 쪽에서 한다
    }

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "전송 중…";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });

      if (res.ok) {
        alert(successMessage);
        return;
      }

      const detail = await res.text().catch(() => "");
      let message = detail;

      try {
        message = JSON.parse(detail).message ?? detail;
      } catch {
        // JSON이 아니면(500 스택 등) 본문 앞부분만 쓴다
      }

      console.error(`${url} 실패 (HTTP ${res.status}):`, detail);
      alert(`전송 실패 (HTTP ${res.status})\n${String(message).slice(0, 300)}`);
    } catch (err) {
      console.error(err);
      alert("전송 실패 — 네트워크 오류");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

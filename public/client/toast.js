// 저장·전송 결과 알림.
//
// alert 은 태블릿에서 매번 확인을 눌러야 해서 작업 흐름이 끊긴다.
// 성공은 잠깐 떴다 사라지고, 실패는 눌러서 지울 때까지 남는다 —
// 발송 실패 원인은 놓치면 다시 볼 방법이 없기 때문이다.
//
// 쓰려면 화면에 <div id="toast" class="toast" role="status" aria-live="polite"></div> 가 있어야 한다.

let hideTimer = null;

export function toast(message, kind = "ok") {
  const el = document.getElementById("toast");
  if (!el) return;

  clearTimeout(hideTimer);

  el.textContent = message;
  el.className = `toast toast-${kind} is-visible`;

  // 실패는 오래 남기고, 그동안 눌러서 지울 수 있게 한다.
  const duration = kind === "error" ? 9000 : 2800;

  el.onclick = () => {
    clearTimeout(hideTimer);
    el.classList.remove("is-visible");
  };

  hideTimer = setTimeout(() => el.classList.remove("is-visible"), duration);
}

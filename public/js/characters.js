// public/js/characters.js
// 도감 진입 시, 방금 부화한 캐릭터가 있으면 폭죽 + 카드 해금 연출을 1회 재생.
// 신호는 timer.js 가 부화 시 sessionStorage('justHatched') 에 저장해 둔다.

(function () {
  // 1) 부화 신호 읽기 (없으면 아무것도 안 함)
  var raw = sessionStorage.getItem('justHatched');
  if (!raw) return;
  sessionStorage.removeItem('justHatched'); // 1회 소비 — 새로고침해도 재발 안 함

  var hatched;
  try { hatched = JSON.parse(raw); } catch (e) { return; }
  if (!hatched || !hatched.id) return;

  // 2) 해당 캐릭터 카드 찾기
  var card = document.querySelector('.character-card[data-character-id="' + hatched.id + '"]');

  // 3) 카드 해금 연출 + 화면 안으로 스크롤
  if (card) {
    card.classList.add('just-hatched');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // 4) 폭죽 — 좌우에서 가운데로 쏘아 올리는 연속 발사 (약 1.2초)
  if (typeof confetti === 'function') {
    var end = Date.now() + 1200;
    (function frame() {
      confetti({ particleCount: 5, angle: 60,  spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
    // 가운데 큰 한 방
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 } });
  }
})();

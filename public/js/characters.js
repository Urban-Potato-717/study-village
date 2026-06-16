// public/js/characters.js
// 0.3v 신규: 부화 축하 연출 — 도감 진입 시 방금 부화한 캐릭터가 있으면
//            폭죽(canvas-confetti) + 카드 해금 애니메이션을 1회 재생.
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

// 0.6v 대표 캐릭터 변경 — 보유 카드(.owned) 클릭 → POST /characters/select
//      성공 시 'current' 클래스(="대표" 뱃지)를 누른 카드로 옮긴다.
(function () {
  var grid = document.querySelector('.character-grid');
  if (!grid) return;

  grid.addEventListener('click', function (e) {
    var card = e.target.closest('.character-card.owned'); // 보유한 카드만 선택 가능
    if (!card) return;

    var characterId = parseInt(card.getAttribute('data-character-id'), 10);
    if (!characterId) return;
    if (card.classList.contains('current')) return; // 이미 대표면 무시

    fetch('/characters/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: characterId }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok) { alert(data.message || '변경 실패'); return; }
        // 기존 대표 표시 제거 후 누른 카드에 부여
        var prev = grid.querySelector('.character-card.current');
        if (prev) prev.classList.remove('current');
        card.classList.add('current');
      })
      .catch(function () { alert('네트워크 에러가 발생했습니다.'); });
  });
})();

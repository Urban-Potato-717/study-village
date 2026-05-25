// public/js/timer.js
// 담당: 임태균(MVP 통합은 김준영)
// 공부 시작/종료 버튼 + 서버 시각 기준 경과 시간 표시

(function () {
  var btnStart = document.getElementById('btn-start');
  var btnEnd   = document.getElementById('btn-end');
  var statusEl = document.getElementById('status');
  var elapsed  = document.getElementById('elapsed');
  var eggFill  = document.getElementById('egg-fill');
  var eggText  = document.getElementById('egg-text');

  if (!btnStart || !btnEnd) return;

  var startedAtMs  = null;
  var tickId       = null;
  var currentLogId = null;

  function format(sec) {
    var h = String(Math.floor(sec / 3600)).padStart(2, '0');
    var m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    var s = String(sec % 60).padStart(2, '0');
    return h + ':' + m + ':' + s;
  }

  function tick() {
    var sec = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    elapsed.textContent = format(sec);
  }

  function setStudying(yes) {
    btnStart.style.display = yes ? 'none' : '';
    btnEnd.style.display   = yes ? '' : 'none';
    if (statusEl) statusEl.textContent = yes ? '공부 중' : '대기';
  }

  btnStart.addEventListener('click', async function () {
    var sv = window.studyVillage || {};
    if (!sv.selectedSeatNumber) {
      alert('좌석을 먼저 선택하세요.');
      return;
    }
    try {
      var res = await fetch('/study/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: sv.roomId,
          seatNumber: sv.selectedSeatNumber,
        }),
      });
      var data = await res.json();
      if (!data.ok) {
        alert(data.message || '공부 시작 실패');
        return;
      }
      currentLogId = data.logId;
      startedAtMs  = new Date(data.startedAt).getTime();
      if (Number.isNaN(startedAtMs)) startedAtMs = Date.now();
      setStudying(true);
      tick();
      tickId = setInterval(tick, 1000);
    } catch (err) {
      console.error(err);
      alert('네트워크 에러가 발생했습니다.');
    }
  });

  async function endSession(showAlert) {
    if (!currentLogId) return;
    var logId = currentLogId;
    currentLogId = null;
    if (tickId) { clearInterval(tickId); tickId = null; }

    try {
      var res = await fetch('/study/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: logId }),
      });
      var data = await res.json();
      setStudying(false);
      elapsed.textContent = '00:00:00';

      if (!data.ok) {
        if (showAlert) alert(data.message || '공부 종료 실패');
        return;
      }

      // 알 진행도 UI 갱신
      if (data.egg && eggFill && eggText) {
        var pct = data.egg.required > 0
          ? Math.min(100, Math.floor((data.egg.progress / data.egg.required) * 100))
          : 0;
        eggFill.style.width = pct + '%';
        eggText.textContent =
          Math.floor(data.egg.progress / 60) + '분 / '
          + Math.floor(data.egg.required / 60) + '분 (' + pct + '%)';
      }

      if (showAlert) {
        var msg = '공부 시간: ' + Math.floor(data.duration / 60) + '분 '
                + (data.duration % 60) + '초';
        if (data.egg && data.egg.justHatched && data.egg.newCharacter) {
          msg += '\n\n알이 부화했습니다!\n'
              + data.egg.newCharacter.name + ' (' + data.egg.newCharacter.rarity + ')';
        }
        alert(msg);
      }
    } catch (err) {
      console.error(err);
    }
  }

  btnEnd.addEventListener('click', function () { endSession(true); });

  // 페이지 떠날 때 진행 중이면 종료 호출 (best-effort)
  window.addEventListener('beforeunload', function () {
    if (currentLogId) {
      // sendBeacon 으로 라이프사이클 종료 직전에도 전송 시도
      try {
        var blob = new Blob(
          [JSON.stringify({ logId: currentLogId })],
          { type: 'application/json' }
        );
        navigator.sendBeacon('/study/end', blob);
      } catch (e) { /* noop */ }
    }
  });
})();

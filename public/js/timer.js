// public/js/timer.js
// 담당: 임태균 (feature/timer 브랜치)
// 공부 시작/종료 버튼 + 경과 시간 표시

(function () {
  var btnStart = document.getElementById('btn-start');
  var btnEnd   = document.getElementById('btn-end');
  var status   = document.getElementById('status');
  var elapsed  = document.getElementById('elapsed');

  var startedAt = null;
  var tickId    = null;
  var currentLogId = null;

  function format(sec) {
    var h = String(Math.floor(sec / 3600)).padStart(2, '0');
    var m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    var s = String(sec % 60).padStart(2, '0');
    return h + ':' + m + ':' + s;
  }

  function tick() {
    var sec = Math.floor((Date.now() - startedAt) / 1000);
    elapsed.textContent = format(sec);
  }

  if (btnStart) {
    btnStart.addEventListener('click', async function () {
      // POST /study/start (임태균 구현)
      try {
        var res = await fetch('/study/start', { method: 'POST' });
        var data = await res.json();
        if (!data.ok) {
          alert(data.message || '공부 시작 실패');
          return;
        }
        currentLogId = data.logId;
        startedAt    = Date.now();
        status.textContent = '공부 중';
        tickId = setInterval(tick, 1000);
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (btnEnd) {
    btnEnd.addEventListener('click', async function () {
      // POST /study/end (임태균 구현)
      try {
        var res = await fetch('/study/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logId: currentLogId }),
        });
        var data = await res.json();
        if (tickId) clearInterval(tickId);
        status.textContent = '대기';
        if (data.ok) {
          alert('공부 시간: ' + data.duration + '초');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }
})();

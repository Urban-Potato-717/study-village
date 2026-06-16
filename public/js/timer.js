// public/js/timer.js
// 공부 시작/종료 버튼 + 서버 시각 기준 경과 시간 표시
// 0.3v 포모도로 모드 추가

(function () {
  var btnStart = document.getElementById('btn-start');
  var btnEnd   = document.getElementById('btn-end');
  var statusEl = document.getElementById('status');
  var elapsed  = document.getElementById('elapsed');
  var eggFill  = document.getElementById('egg-fill');
  var eggText  = document.getElementById('egg-text');
  // 0.3v 포모도로용 추가 요소
  var btnMode    = document.getElementById('btn-mode');    // 스톱워치 ↔ 포모도로 토글
  var phaseLabel = document.getElementById('phase-label'); // 포모도로 단계 표시 줄(숨김 가능)
  var phaseName  = document.getElementById('phase-name');  // "공부" / "휴식" 텍스트

  if (!btnStart || !btnEnd) return;

  // 포모도로 단계 시간
  // TODO(시연): 데모용 10초/5초. 실제 운영 시 STUDY 50*60, BREAK 10*60 으로.
  var POMODORO = {
    STUDY_SECONDS: 10,
    BREAK_SECONDS: 5,
  };

  // 현재 모드: 'stopwatch'(기존 스톱워치) | 'pomodoro'
  var mode = 'stopwatch';
  
  var startedAtMs  = null;  
  var phase = 'study'; // study | break 나누는 용 - 포모도로 전용
  var tickId = null;   // 스탑워치 카운트다운 루프
  var pomoId = null;   // 포모도로 카운트다운 루프
  var switching = false // 단계 전환 중복 방지
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
    if (statusEl) {
      statusEl.textContent = yes ? '공부 중' : '대기';
      statusEl.className = yes ? 'status-studying' : '';  // 대기는 기본색
    }
  }

  btnStart.addEventListener('click', async function () {
    //! 포모도로 모드면 전용 시작 함수로 빠짐 (아래 스톱워치 코드 건너뜀)
    if (mode === 'pomodoro') { startPomodoro(); return; }

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

  btnEnd.addEventListener('click', function () {
    if (mode === 'pomodoro') { stopPomodoro(); return; }
    endSession(true);
  });

  // Object: 포모도로 단계 전환 — STUDY 끝나면 기록 후 BREAK, BREAK 끝나면 다시 STUDY
  async function startStudyPhase() {
    var sv = window.studyVillage || {};
    if (!sv.selectedSeatNumber) { alert('좌석을 먼저 선택하세요.'); return; }

    // 1) 서버에 세션 시작 요청
    var res = await fetch('/study/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: sv.roomId, seatNumber: sv.selectedSeatNumber }),
    });
    var data = await res.json();
    if (!data.ok) { alert(data.message || '공부 시작 실패'); return; }

    // 2) 응답으로 세션 상태 세팅
    currentLogId = data.logId;
    startedAtMs  = new Date(data.startedAt).getTime();
    if (Number.isNaN(startedAtMs)) startedAtMs = Date.now();

    // 3) 단계를 공부로
    phase = 'study';
    setStudying(true);
  }

  //! 포모도로 핵심 function
  async function onPhaseEnd() {
    // 1) STUDY 끝 → 기록(알림 없이) 후 BREAK 로
    if (phase === 'study') {
      await endSession(false);
      phase = 'break';
    // 2) BREAK 끝 → 다시 STUDY 시작
    } else {
      await startStudyPhase();
    }
  }

  // 포모도로 시작: 첫 공부 단계 + 카운트다운 루프 가동
  async function startPomodoro() {
    await startStudyPhase();
    if (!currentLogId) return;
    if (pomoId) clearInterval(pomoId);
    pomoId = setInterval(pomoTick, 250);
    pomoTick();
  }

  // 매 틱: 남은시간 표시, 0 되면 단계 전환
  async function pomoTick() {
    // 1) 현재 단계 길이 (공부냐 휴식이냐)
    var total = (phase === 'study') ? POMODORO.STUDY_SECONDS : POMODORO.BREAK_SECONDS;
    var passed = Math.floor((Date.now() - startedAtMs) / 1000);
    var remaining = Math.max(0, total - passed);
    // 2) 화면 표시 (카운트다운 + 단계 이름)
    elapsed.textContent = format(remaining);
    if (phaseName) phaseName.textContent = (phase === 'study') ? '공부' : '휴식';
    // 3) 0 도달 → 단계 전환 (switching 으로 중복 호출 차단)
    if (remaining <= 0 && !switching) {
      switching = true;
      await onPhaseEnd();
      // 휴식도 한 사이클 — 종료 버튼 유지(공부 시작 버튼 숨김). 기록은 공부 단계만, endSession 불변.
      if (phase === 'break') {
        startedAtMs = Date.now();
        btnStart.style.display = 'none';
        btnEnd.style.display   = '';
        if (statusEl) {
          statusEl.textContent = '휴식 중';
          statusEl.className = 'status-break';
        }
      }
      switching = false;
    }
  }

  // 포모도로 중단 (종료 버튼)
  function stopPomodoro() {
    if (pomoId) { clearInterval(pomoId); pomoId = null; }
    if (phase === 'study') {
      endSession(true);          // 공부 중 중단 → 기록 + endSession 이 UI 도 대기로 되돌림
    } else {
      setStudying(false);        // 휴식 중 중단 → 기록할 세션 없음, UI 만 대기로
      elapsed.textContent = '00:00:00';
    }
    phase = 'study';             // 다음 포모도로 시작 위해 초기화
  }

  // 모드 토글: 스톱워치 ↔ 포모도로
  btnMode.addEventListener('click', function () {
    if (currentLogId || pomoId) { alert('진행 중에는 모드를 바꿀 수 없어요.'); return; }
    mode = (mode === 'stopwatch') ? 'pomodoro' : 'stopwatch';
    btnMode.setAttribute('data-mode', mode);
    btnMode.textContent = (mode === 'pomodoro') ? '모드: 포모도로 🍅' : '모드: 스톱워치 ⏱';
    if (phaseLabel) phaseLabel.style.display = (mode === 'pomodoro') ? '' : 'none';
  });

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

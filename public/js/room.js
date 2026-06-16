// room.ejs에서만 작동!
// 좌석 화면 그리기, 실시간 동기화 (Socket), 방 인원 목록, 좌석 선택
// * 즉시 실행 함수 - 안에서 만든 변수의 전역 오염 방지 (공유 원할 시 window.xxx에 직접 붙인다)

(function () {
  var seatsEl   = document.getElementById('seats');
  if (!seatsEl) return; // #seat 요소 (좌석 그리드)가 없는 페이지 - 바로 종료

  // 1) 데이터 읽기 + 공유 상태 세팅
  var roomId       = parseInt(seatsEl.getAttribute('data-room-id'), 10);
  var userId       = parseInt(seatsEl.getAttribute('data-user-id'), 10);
  var userEmoji    = seatsEl.getAttribute('data-user-emoji') || '';
  var userNickname = seatsEl.getAttribute('data-user-nickname') || '나';

  var socket = window.io ? window.io() : null;

  // 전역 노출: timer.js 가 선택된 좌석 번호를 참조
  window.studyVillage = {
    roomId: roomId,
    userId: userId,
    selectedSeatNumber: null,
  };

  // 2) 좌석 그리기 헬퍼들
  function getSeatEl(seatNumber) {
    return seatsEl.querySelector('.seat-cell[data-seat-number="' + seatNumber + '"]');
  }

  function renderSeat(seatNumber, payload) {
    var cell = getSeatEl(seatNumber);
    if (!cell) return;
    var emojiEl = cell.querySelector('.seat-emoji');
    var nickEl  = cell.querySelector('.seat-nick');
    var statusEl = cell.querySelector('.seat-status');

    // 누가 앉음 (payload.user가 있으면)
    if (payload && payload.user) {
      cell.classList.add('occupied');
      if (payload.user.id === userId) cell.classList.add('mine'); // 내 좌석 - 강조
      else cell.classList.remove('mine');
      setSeatStage(emojiEl, payload.user);                        // 의자 + 캐릭터 그림
      nickEl.textContent  = payload.user.nickname || '익명';

      // 상태 뱃지 (집중 중/휴식 중.. 등) - 만들거나 갱신
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.className = 'seat-status';
        cell.appendChild(statusEl);
      }
      statusEl.classList.remove('status-waiting', 'status-focusing', 'status-resting', 'status-away');
      statusEl.classList.add('status-' + (payload.status || 'waiting'));
      statusEl.textContent =
        payload.status === 'focusing' ? '집중 중'
        : payload.status === 'resting' ? '휴식 중'
        : payload.status === 'away'    ? '이탈'
                                       : '대기';
    } else { // 앉은 사람이 없음
      cell.classList.remove('occupied', 'mine');
      setSeatStage(emojiEl, null); // 의자만
      nickEl.textContent  = '좌석 ' + seatNumber;
      if (statusEl) statusEl.remove(); // 상태 뱃지 제거 - 앉아있지 않으니까
    }
  }

  // 좌석 무대 구성: 의자(바닥)는 항상 깔고, 점유 시 캐릭터를 그 위에 겹쳐 그림
  function setSeatStage(container, user) {
    container.innerHTML = '<img class="seat-chair" src="/images/tiles/chair.png" alt="좌석" />';
    if (!user) return;

    if (user.imagePath) {
      var img = document.createElement('img');
      img.className = 'seat-char sprite-img';
      img.src = user.imagePath;
      img.alt = '';
      img.onerror = function () {
        img.remove();
        container.appendChild(makeSeatEmoji(user.emoji));
      };
      container.appendChild(img);
    } else {
      container.appendChild(makeSeatEmoji(user.emoji));
    }
  }

  // 이미지 로드 실패 시 좌석 위에 올릴 이모지 폴백 요소
  function makeSeatEmoji(emoji) {
    var span = document.createElement('span');
    span.className = 'seat-char sprite-emoji';
    span.textContent = emoji || '';
    return span;
  }

  // ─── 방 인원 목록 (private 방 전용, 4초 폴링으로 갱신) ─
  var memberListEl  = document.getElementById('member-list');
  var memberCountEl = document.getElementById('member-count');
  var hostId = memberListEl ? parseInt(memberListEl.getAttribute('data-host-id'), 10) : NaN;

  function renderMembers(members) {
    if (memberCountEl) memberCountEl.textContent = members.length;
    if (!memberListEl) return;
    memberListEl.innerHTML = '';
    members.forEach(function (m) {
      var li = document.createElement('li');
      li.className = 'member-item' + (m.id === userId ? ' me' : '');

      var emoji = document.createElement('span');
      emoji.className = 'member-emoji';
      emoji.textContent = m.emoji || '';
      li.appendChild(emoji);

      var nick = document.createElement('span');
      nick.className = 'member-nick';
      nick.textContent = m.nickname;
      li.appendChild(nick);

      if (m.id === hostId) {
        var host = document.createElement('span');
        host.className = 'member-host';
        host.textContent = '방장';
        li.appendChild(host);
      }
      if (m.id === userId) {
        var you = document.createElement('span');
        you.className = 'member-you';
        you.textContent = '나';
        li.appendChild(you);
      }
      memberListEl.appendChild(li);
    });
  }

  // 서버에서 현재 방 인원 JSON 을 받아 다시 그림
  function pollMembers() {
    fetch('/room/members', { headers: { 'Accept': 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (data) { if (data && data.members) renderMembers(data.members); })
      .catch(function () {}); // 일시적 네트워크 오류는 무시
  }

  // member-list 가 있는 페이지(=private 방)에서만 폴링 시작
  if (memberListEl) {
    setInterval(pollMembers, 2000); // TODO 2초마다 갱신 (초기 목록은 서버 렌더로 이미 있음) - 시연 규모에서는 폴링 2초도 괜찮을듯
  }

  function setSelectedSeat(seatNumber) {
    seatsEl.querySelectorAll('.seat-cell.selected').forEach(function (el) {
      el.classList.remove('selected');
    });
    if (seatNumber) {
      var cell = getSeatEl(seatNumber);
      if (cell) cell.classList.add('selected');
    }
    window.studyVillage.selectedSeatNumber = seatNumber || null;

    var btnStart = document.getElementById('btn-start');
    var hint     = document.getElementById('seat-hint');
    if (btnStart) btnStart.disabled = !seatNumber;
    //* 0.4v 방장 "전체 시작"도 좌석을 골라야 활성화 (미착석 방장이 눌러도 자기 타이머가 안 도는 문제 방지)
    var btnGroupStart = document.getElementById('btn-group-start');
    if (btnGroupStart) btnGroupStart.disabled = !seatNumber;
    if (hint) hint.textContent = seatNumber
      ? '좌석 ' + seatNumber + '번을 선택했습니다.'
      : '좌석을 먼저 선택하세요.';
  }

  //! ─── Socket.IO ───────────────────────────────────
  if (socket) {
    socket.emit('joinRoom', { roomId: roomId, userId: userId });
    // 페이지 열리자마자 서버한테 "나 room-1 들어갈게" 전송

    socket.on('seatUpdated', function (data) {
      if (!data) return;
      renderSeat(data.seatNumber, data); // 좌석 화면 업데이트
    });

    socket.on('seatLeft', function (data) {
      if (!data) return;
      renderSeat(data.seatNumber, null); // 좌석 비움
    });

    socket.on('seatRejected', function (data) {
      alert('좌석 ' + data.seatNumber + '번은 이미 점유되어 있습니다.');
      setSelectedSeat(null);
    });

    socket.on('studyStatusChanged', function (data) {
      // 다른 사용자의 시작/종료에 대한 추가 처리(필요시) — 좌석 status 는 seatUpdated 로 전달됨
      console.log('studyStatusChanged:', data);
    });

    //* 0.4v 방장 그룹 타이머: 방장이 쏜 신호를 받아 내 타이머를 시작/종료
    socket.on('groupStart', function () {
      if (window.studyTimer) window.studyTimer.groupStart();
    });
    socket.on('groupEnd', function () {
      if (window.studyTimer) window.studyTimer.groupEnd();
    });

    //* 0.6v 도감에서 캐릭터를 바꾸면 사이드바 "내 캐릭터" 패널을 실시간 갱신 (좌석 타일은 seatUpdated가 처리)
    socket.on('myCharacterChanged', function (data) {
      if (!data || data.userId !== userId) return; // 내 것만
      var stage = document.querySelector('.my-character .my-emoji');
      if (stage) setSeatStageImage(stage, data); // 의자 없이 캐릭터만 (아래 헬퍼)
      var nameEl = document.querySelector('.my-character .my-character-name');
      if (nameEl) nameEl.textContent = data.characterName || '내 캐릭터';
    });
  }

  // 캐릭터 스프라이트만 그리는 헬퍼 (사이드바 내 캐릭터 패널용 — 의자 없음)
  function setSeatStageImage(container, data) {
    container.innerHTML = '';
    if (data.imagePath) {
      var img = document.createElement('img');
      img.className = 'sprite-img';
      img.src = data.imagePath;
      img.alt = '';
      img.onerror = function () { img.remove(); container.appendChild(makeSeatEmoji(data.emoji)); };
      container.appendChild(img);
    } else {
      container.appendChild(makeSeatEmoji(data.emoji));
    }
  }

  //* 0.4v 방장 전용 "전체 시작/종료" 버튼 → 서버에 POST(방장 권한 검증) → 서버가 방 전체에 브로드캐스트
  var btnGroupStart = document.getElementById('btn-group-start');
  var btnGroupEnd   = document.getElementById('btn-group-end');

  function postGroup(path) {
    fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.ok) { alert(data.message || '요청 실패'); return; }
        // 성공 시 버튼 토글 (시작 ↔ 종료)
        if (btnGroupStart && btnGroupEnd) {
          var started = path.indexOf('start') !== -1;
          btnGroupStart.style.display = started ? 'none' : '';
          btnGroupEnd.style.display   = started ? '' : 'none';
        }
      })
      .catch(function () { alert('네트워크 에러가 발생했습니다.'); });
  }

  if (btnGroupStart) btnGroupStart.addEventListener('click', function () { postGroup('/room/group/start'); });
  if (btnGroupEnd)   btnGroupEnd.addEventListener('click', function () { postGroup('/room/group/end'); });

  //! ─── 좌석 클릭 ───────────────────────────────────
  seatsEl.addEventListener('click', function (e) {
    var cell = e.target.closest('.seat-cell'); // 클릭한 좌석 요소 찾기
    if (!cell) return;

    var seatNumber = parseInt(cell.getAttribute('data-seat-number'), 10);
    if (!seatNumber) return;

    // 이미 다른 사용자가 점유 중이면 선택 불가
    if (cell.classList.contains('occupied') && !cell.classList.contains('mine')) {
      alert('이미 다른 사용자가 사용 중인 좌석입니다.');
      return;
    }

    setSelectedSeat(seatNumber); // 선택 표시

    if (socket) {  // if는 socket 연결이 만들어졌는지 검증. 서버에 전송 (emit)
      socket.emit('selectSeat', {
        roomId: roomId,
        seatNumber: seatNumber,
        userId: userId,
      });
    }
  });

  // 본인이 이미 어디 앉아있다면 그 좌석을 선택 상태로
  var mineCell = seatsEl.querySelector('.seat-cell.mine');
  if (mineCell) {
    setSelectedSeat(parseInt(mineCell.getAttribute('data-seat-number'), 10));
  }
})();

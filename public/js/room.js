// public/js/room.js
// 담당: 오유진(UI), 김준영(MVP 통합)
// 학습방 좌석 클릭 + Socket.IO 좌석 상태 공유

(function () {
  var seatsEl   = document.getElementById('seats');
  if (!seatsEl) return;

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

  function getSeatEl(seatNumber) {
    return seatsEl.querySelector('.seat-cell[data-seat-number="' + seatNumber + '"]');
  }

  function renderSeat(seatNumber, payload) {
    var cell = getSeatEl(seatNumber);
    if (!cell) return;
    var emojiEl = cell.querySelector('.seat-emoji');
    var nickEl  = cell.querySelector('.seat-nick');
    var statusEl = cell.querySelector('.seat-status');

    if (payload && payload.user) {
      cell.classList.add('occupied');
      if (payload.user.id === userId) cell.classList.add('mine');
      else cell.classList.remove('mine');
      emojiEl.textContent = payload.user.emoji || '';
      nickEl.textContent  = payload.user.nickname || '익명';

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
    } else {
      cell.classList.remove('occupied', 'mine');
      emojiEl.textContent = '';
      nickEl.textContent  = '좌석 ' + seatNumber;
      if (statusEl) statusEl.remove();
    }
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
  }

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

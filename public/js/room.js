// public/js/room.js
// 담당: 오유진 (feature/room 브랜치)
// 학습방/좌석 클릭 동작 + Socket.IO 좌석 상태 공유

(function () {
  // socket.io 클라이언트는 /socket.io/socket.io.js 로 제공됨 (room.ejs에서 로드)
  var socket = window.io ? window.io() : null;
  var roomId = 1; // 임시: 추후 서버에서 내려준 값으로 교체

  if (socket) {
    socket.emit('joinRoom', roomId);

    // 다른 사람이 좌석을 선택하면 화면에 반영
    socket.on('seatUpdated', function (data) {
      // TODO: 오유진 구현 — data.seatId 에 해당하는 좌석을 occupied 표시
      console.log('seatUpdated:', data);
    });
  }

  // 좌석 클릭 처리
  var seats = document.querySelectorAll('.seat');
  seats.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.classList.contains('occupied')) return;

      seats.forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');

      var seatId = btn.getAttribute('data-seat-id');
      if (socket) {
        socket.emit('selectSeat', { roomId: roomId, seatId: seatId });
      }
    });
  });
})();

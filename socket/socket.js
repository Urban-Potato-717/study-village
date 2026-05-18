// socket/socket.js
// Socket.IO 이벤트 핸들러 — 최소 연결만 구현 (추후 확장)
// 팀원 안내: 이 파일은 팀장(김준영)이 관리합니다.

// bin/www 에서 registerSocket(io) 형태로 호출됩니다.
module.exports = function (io) {
  io.on('connection', function (socket) {
    console.log('socket 연결:', socket.id);

    // ─── joinRoom: 학습방 입장 ───────────────────
    socket.on('joinRoom', function (roomId) {
      // 같은 roomId의 socket들끼리만 메시지를 주고받기 위해 room에 join
      socket.join('room-' + roomId);
      console.log(socket.id + ' → room-' + roomId + ' 입장');
    });

    // ─── selectSeat: 좌석 선택 ───────────────────
    socket.on('selectSeat', function (data) {
      // data = { roomId, seatId, userId }
      // 같은 방에 있는 모든 클라이언트에게 좌석 상태 전파
      io.to('room-' + data.roomId).emit('seatUpdated', data);
    });

    // ─── studyStatusChanged: 공부 시작/종료 상태 ───
    socket.on('studyStatusChanged', function (data) {
      // data = { roomId, userId, status } // status: 'start' | 'end'
      io.to('room-' + data.roomId).emit('studyStatusChanged', data);
    });

    socket.on('disconnect', function () {
      console.log('socket 연결 해제:', socket.id);
    });
  });
};

// socket/socket.js
// Socket.IO 이벤트 핸들러 — MVP: 좌석 점유 영속화
// 팀원 안내: 이 파일은 팀장(김준영)이 관리합니다.

var pool = require('../db/connection');

// 좌석/사용자/캐릭터를 한 번에 가져오기 위한 공통 SELECT
async function loadSeatPayload(roomId, userId, seatNumber) {
  var [rows] = await pool.query(
    'SELECT so.seat_number, so.status, u.id AS userId, u.nickname,'
    + ' c.emoji, c.image_path, c.name AS characterName'
    + ' FROM seat_occupancy so'
    + ' JOIN users u ON u.id = so.user_id'
    + ' LEFT JOIN characters c ON c.id = u.current_character_id'
    + ' WHERE so.room_id = ? AND so.seat_number = ?',
    [roomId, seatNumber]
  );
  if (rows.length === 0) return null;
  var r = rows[0];
  return {
    seatNumber: r.seat_number,
    status: r.status,
    user: {
      id: r.userId,
      nickname: r.nickname,
      emoji: r.emoji || '',
      imagePath: r.image_path || '',
      characterName: r.characterName || null,
    },
  };
}

// bin/www 에서 registerSocket(io) 형태로 호출됩니다.
module.exports = function (io) {
  io.on('connection', function (socket) {
    console.log('socket 연결:', socket.id);

    // ─── joinRoom: 학습방 입장 ───────────────────
    socket.on('joinRoom', function (payload) {
      // 클라가 { roomId, userId } 또는 단순 roomId 를 보낼 수 있음
      var roomId = (payload && payload.roomId) || payload;
      var userId = payload && payload.userId;
      socket.join('room-' + roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId || null;
      console.log(socket.id + ' → room-' + roomId + ' 입장 (user=' + userId + ')');
    });

    // ─── selectSeat: 좌석 선택 (영속화) ───────────────────
    // data = { roomId, seatNumber, userId }
    socket.on('selectSeat', async function (data) {
      try {
        if (!data || !data.roomId || !data.seatNumber || !data.userId) return;

        var roomId = data.roomId;
        var seatNumber = parseInt(data.seatNumber, 10);
        var userId = data.userId;

        // 1) 해당 좌석이 다른 사람에게 이미 점유되어 있으면 거절
        var [exists] = await pool.query(
          'SELECT user_id FROM seat_occupancy WHERE room_id = ? AND seat_number = ?',
          [roomId, seatNumber]
        );
        if (exists.length > 0 && exists[0].user_id !== userId) {
          socket.emit('seatRejected', { seatNumber: seatNumber, reason: 'occupied' });
          return;
        }

        // 2) 같은 사용자의 다른 좌석 점유는 정리 (UNIQUE user_id 제약 회피)
        var [prev] = await pool.query(
          'SELECT room_id, seat_number FROM seat_occupancy WHERE user_id = ?',
          [userId]
        );
        if (prev.length > 0) {
          await pool.query('DELETE FROM seat_occupancy WHERE user_id = ?', [userId]);
          for (var i = 0; i < prev.length; i++) {
            io.to('room-' + prev[i].room_id).emit('seatLeft', {
              seatNumber: prev[i].seat_number,
            });
          }
        }

        // 3) 새 좌석 INSERT (status: 대기)
        await pool.query(
          'INSERT INTO seat_occupancy (room_id, seat_number, user_id, status)'
          + ' VALUES (?, ?, ?, ?)',
          [roomId, seatNumber, userId, 'waiting']
        );

        // 4) socket 에 메모하여 disconnect 시 정리
        socket.data.seat = { roomId: roomId, seatNumber: seatNumber, userId: userId };

        // 5) 같은 방에 브로드캐스트
        var payload = await loadSeatPayload(roomId, userId, seatNumber);
        if (payload) {
          io.to('room-' + roomId).emit('seatUpdated', payload);
        }
      } catch (err) {
        console.error('selectSeat 실패:', err);
      }
    });

    // ─── studyStatusChanged: 공부 시작/종료 상태 ───
    // 라우터(routes/study.js)에서 직접 broadcast 하므로 호환용으로만 유지
    socket.on('studyStatusChanged', function (data) {
      io.to('room-' + data.roomId).emit('studyStatusChanged', data);
    });

    socket.on('disconnect', async function () {
      console.log('socket 연결 해제:', socket.id);
      try {
        var seat = socket.data && socket.data.seat;
        if (!seat) return;
        // MVP: grace 없이 즉시 좌석 해제
        await pool.query(
          'DELETE FROM seat_occupancy WHERE room_id = ? AND seat_number = ? AND user_id = ?',
          [seat.roomId, seat.seatNumber, seat.userId]
        );
        io.to('room-' + seat.roomId).emit('seatLeft', { seatNumber: seat.seatNumber });
      } catch (err) {
        console.error('disconnect 좌석 정리 실패:', err);
      }
    });
  });
};

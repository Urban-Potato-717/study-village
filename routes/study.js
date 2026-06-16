// routes/study.js
// (feature/timer 브랜치) — MVP 본구현은 김준영이 통합 PR로 작성
// 공부 시작/종료 API + 알 부화 처리

var express = require('express');
var router  = express.Router();
var pool    = require('../db/connection'); // db 연결
var study   = require('../lib/study');     // 세션 시작/종료 공용 로직

// 공통: 로그인 체크
function requireLogin(req, res) {
  if (!req.session.user) {
    res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });
    return false;
  }
  return true;
}

// POST /study/start — 공부 시작
// body: { roomId, seatNumber }
router.post('/start', async function (req, res, next) {
  try {
    if (!requireLogin(req, res)) return;
    var userId   = req.session.user.id;
    var roomId   = parseInt(req.body.roomId, 10) || 1;
    var seatNumber = parseInt(req.body.seatNumber, 10);
    if (!seatNumber) {
      return res.status(400).json({ ok: false, message: '좌석을 먼저 선택하세요.' });
    }

    // 1) 좌석 점유: 같은 사용자의 다른 좌석은 정리 후 INSERT/UPDATE
    var [existing] = await pool.query(
      'SELECT user_id FROM seat_occupancy WHERE room_id = ? AND seat_number = ?',
      [roomId, seatNumber]
    );
    if (existing.length > 0 && existing[0].user_id !== userId) {
      return res.status(409).json({ ok: false, message: '이미 점유된 좌석입니다.' });
    }
    if (existing.length === 0) {
      await pool.query(
        'DELETE FROM seat_occupancy WHERE user_id = ?',
        [userId]
      );
      await pool.query(
        'INSERT INTO seat_occupancy (room_id, seat_number, user_id, status) VALUES (?, ?, ?, ?)',
        [roomId, seatNumber, userId, 'focusing']
      );
    } else {
      await pool.query(
        'UPDATE seat_occupancy SET status = ? WHERE room_id = ? AND seat_number = ?',
        ['focusing', roomId, seatNumber]
      );
    }

    //! 2) 세션 시작(좌석 focusing + study_logs INSERT)은 공용 헬퍼에 위임
    //    좌석 점유 분기는 위 1)에서 이미 처리됨 — 헬퍼의 좌석 UPDATE는 중복이나 무해.
    var logId = await study.startSession(pool, userId, roomId);

    // 3) 동일 좌석 정보 + 캐릭터로 브로드캐스트
    var io = req.app.get('io');
    if (io) {
      var [rows] = await pool.query(
        'SELECT u.id AS userId, u.nickname, c.emoji, c.image_path'
        + ' FROM users u LEFT JOIN characters c ON c.id = u.current_character_id'
        + ' WHERE u.id = ?',
        [userId]
      );
      var u = rows[0] || { userId: userId, nickname: req.session.user.nickname, emoji: '' };
      io.to('room-' + roomId).emit('seatUpdated', {
        seatNumber: seatNumber,
        status: 'focusing',
        user: {
          id: u.userId,
          nickname: u.nickname,
          emoji: u.emoji || '',
          imagePath: u.image_path || '',
        },
      });
      io.to('room-' + roomId).emit('studyStatusChanged', {
        userId: userId, seatNumber: seatNumber, status: 'start',
      });
    }

    res.json({
      ok: true,
      logId: logId,
      startedAt: new Date().toISOString(),
      seatNumber: seatNumber,
    });
  } catch (err) {
    next(err);
  }
});

// POST /study/end — 공부 종료
// body: { logId }
router.post('/end', async function (req, res, next) {
  try {
    if (!requireLogin(req, res)) return;
    var userId = req.session.user.id;
    var logId  = parseInt(req.body.logId, 10);
    if (!logId) {
      return res.status(400).json({ ok: false, message: 'logId가 필요합니다.' });
    }

    // 1) 본인 소유 + 진행 중인 로그인지 확인
    var [logRows] = await pool.query(
      'SELECT id, user_id, room_id, start_time, end_time FROM study_logs WHERE id = ?',
      [logId]
    );
    if (logRows.length === 0 || logRows[0].user_id !== userId) {
      return res.status(404).json({ ok: false, message: '해당 세션을 찾을 수 없습니다.' });
    }
    var log = logRows[0];
    if (log.end_time) {
      return res.status(400).json({ ok: false, message: '이미 종료된 세션입니다.' });
    }

    //! 2) 종료 처리(duration/누적/좌석/알)는 공용 헬퍼에 위임
    var result = await study.endSession(pool, log);

    // 3) 브로드캐스트
    var io = req.app.get('io');
    if (io) {
      io.to('room-' + log.room_id).emit('studyStatusChanged', {
        userId: userId, status: 'end',
      });
    }

    res.json({
      ok: true,
      duration: result.duration,
      egg: result.egg,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

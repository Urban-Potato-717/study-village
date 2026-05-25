// routes/room.js
// 담당: 김준영(라우터), 오유진(뷰)
// 학습방/좌석 라우터 — MVP

var express = require('express');
var router  = express.Router();
var pool    = require('../db/connection');

// GET /room — 학습방 화면 (1번방 고정, 12석)
router.get('/', async function (req, res, next) {
  try {
    if (!req.session.user) return res.redirect('/auth/login');
    var me = req.session.user;

    // 1) 방 정보
    var [roomRows] = await pool.query(
      'SELECT id, name, capacity FROM rooms WHERE id = 1'
    );
    if (roomRows.length === 0) {
      return res.status(500).send('학습방 데이터가 없습니다. db/schema.sql 을 실행하세요.');
    }
    var room = roomRows[0];

    // 2) 현재 점유 좌석들 (사용자/캐릭터 JOIN)
    var [occupied] = await pool.query(
      'SELECT so.seat_number, so.status, u.id AS user_id, u.nickname,'
      + ' c.emoji, c.image_path, c.name AS character_name'
      + ' FROM seat_occupancy so'
      + ' JOIN users u ON u.id = so.user_id'
      + ' LEFT JOIN characters c ON c.id = u.current_character_id'
      + ' WHERE so.room_id = ?',
      [room.id]
    );
    var occMap = {};
    occupied.forEach(function (r) { occMap[r.seat_number] = r; });

    // 3) 12석 배열 구성
    var seats = [];
    for (var i = 1; i <= room.capacity; i++) {
      var o = occMap[i];
      seats.push({
        seatNumber: i,
        occupied: !!o,
        status: o ? o.status : null,
        user: o ? {
          id: o.user_id,
          nickname: o.nickname,
          emoji: o.emoji || '',
          imagePath: o.image_path || '',
          characterName: o.character_name || null,
          isMe: o.user_id === me.id,
        } : null,
      });
    }

    // 4) 사이드바: 내 정보 + 활성 알 + 오늘 통계
    var [meRows] = await pool.query(
      'SELECT u.nickname, u.total_study_seconds, c.emoji, c.image_path, c.name AS character_name'
      + ' FROM users u LEFT JOIN characters c ON c.id = u.current_character_id'
      + ' WHERE u.id = ?',
      [me.id]
    );
    var meInfo = meRows[0] || { nickname: me.nickname, total_study_seconds: 0 };

    var [eggRows] = await pool.query(
      'SELECT required_seconds, progress_seconds FROM eggs'
      + ' WHERE user_id = ? AND is_active = TRUE ORDER BY id ASC LIMIT 1',
      [me.id]
    );
    var egg = eggRows[0]
      ? { progress: eggRows[0].progress_seconds, required: eggRows[0].required_seconds }
      : { progress: 0, required: 600 };

    var [todayRows] = await pool.query(
      'SELECT COALESCE(SUM(duration), 0) AS sec, COUNT(*) AS cnt'
      + ' FROM study_logs WHERE user_id = ? AND DATE(start_time) = CURDATE()'
      + ' AND end_time IS NOT NULL',
      [me.id]
    );
    var today = {
      minutes: Math.floor((todayRows[0].sec || 0) / 60),
      sessions: todayRows[0].cnt || 0,
    };

    res.render('room', {
      room: room,
      seats: seats,
      me: {
        id: me.id,
        nickname: meInfo.nickname,
        emoji: meInfo.emoji || '',
        imagePath: meInfo.image_path || '',
        characterName: meInfo.character_name,
        totalMinutes: Math.floor((meInfo.total_study_seconds || 0) / 60),
      },
      egg: egg,
      today: today,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

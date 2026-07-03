// routes/records.js
// 공부 기록 조회 + 도감 진행도 + 활성 알 진행도

var express = require('express');
var router  = express.Router();
var pool    = require('../db/connection');

// GET /records — 로그인 사용자의 공부 기록 조회
router.get('/', async function (req, res, next) {
  try {
    if (!req.session.user) return res.redirect('/auth/login');
    var userId = req.session.user.id;

    // 1) 오늘 통계
    var [todayRows] = await pool.query(
      'SELECT COALESCE(SUM(duration), 0) AS sec, COUNT(*) AS cnt'
      + ' FROM study_logs WHERE user_id = ? AND DATE(start_time) = CURDATE()'
      + ' AND end_time IS NOT NULL',
      [userId]
    );
    var today = {
      minutes: Math.floor((todayRows[0].sec || 0) / 60),
      sessions: todayRows[0].cnt || 0,
    };

    // 2) 누적
    var [userRows] = await pool.query(
      'SELECT total_study_seconds FROM users WHERE id = ?', [userId]
    );
    var totalSeconds = (userRows[0] && userRows[0].total_study_seconds) || 0;

    //* 3) 활성 알
    var [eggRows] = await pool.query(
      'SELECT required_seconds, progress_seconds FROM eggs'
      + ' WHERE user_id = ? AND is_active = TRUE ORDER BY id ASC LIMIT 1',
      [userId]
    );
    var egg = eggRows[0]
      ? { progress: eggRows[0].progress_seconds, required: eggRows[0].required_seconds }
      : { progress: 0, required: 60 }; // TODO(시연): 60초

    // 4) 도감 진행도
    var [dexRows] = await pool.query(
      'SELECT (SELECT COUNT(*) FROM user_characters WHERE user_id = ?) AS owned,'
      + ' (SELECT COUNT(*) FROM characters) AS total',
      [userId]
    );
    var owned = dexRows[0].owned || 0;
    var total = dexRows[0].total || 0;
    var dex = {
      owned: owned,
      total: total,
      percent: total > 0 ? Math.round((owned / total) * 100) : 0,
    };

    // 5) 최근 세션 10건
    var [records] = await pool.query(
      'SELECT id, start_time, end_time, duration FROM study_logs'
      + ' WHERE user_id = ? AND end_time IS NOT NULL'
      + ' ORDER BY start_time DESC LIMIT 10',
      [userId]
    );

    res.render('records', {
      today: today,
      totalMinutes: Math.floor(totalSeconds / 60),
      egg: egg,
      dex: dex,
      records: records,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

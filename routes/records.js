// routes/records.js
// 담당: 임태균 (feature/timer 브랜치)
// 공부 기록 조회

var express = require('express');
var router  = express.Router();
var pool = require('../db/connection'); // 주석 풀고 풀(pool) 가져오기

// ─── 임태균 담당 구현 영역 ────────────────────────────────

// GET /records — 로그인 사용자의 공부 기록 조회
router.get('/', async function (req, res, next) {
  try {
    // 1) req.session.user 확인 (로그인 필수)
    if (!req.session.user) {
      return res.redirect('/auth/login');
    }

    const userId = req.session.user.id;

    // 2) SELECT * FROM study_logs WHERE user_id = ? ORDER BY start_time DESC
    // 방 이름을 같이 보여줘야 하니까 rooms 테이블이랑 JOIN 처리
    const sql = `
      SELECT l.id, r.name AS room_name, l.start_time, l.end_time,
             TIMESTAMPDIFF(MINUTE, l.start_time, l.end_time) AS study_time
      FROM study_logs l
      JOIN rooms r ON l.room_id = r.id
      WHERE l.user_id = ?
      ORDER BY l.start_time DESC
    `;
    const [rows] = await pool.query(sql, [userId]);

    // 3) res.render('records', { records: rows })
    res.render('records', { records: rows });

  } catch (err) {
    console.error(err);
    next(err); // express 에러 핸들러로 넘기기
  }
});

// ─────────────────────────────────────────────────────────

module.exports = router;
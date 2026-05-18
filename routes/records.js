// routes/records.js
// 담당: 임태균 (feature/timer 브랜치)
// 공부 기록 조회

var express = require('express');
var router  = express.Router();
// var pool = require('../db/connection');

// ─── 임태균 담당 구현 영역 ────────────────────────────────

// GET /records — 로그인 사용자의 공부 기록 조회
router.get('/', function (req, res, next) {
  // 1) req.session.user 확인 (로그인 필수)
  // 2) SELECT * FROM study_logs WHERE user_id = ? ORDER BY start_time DESC
  // 3) res.render('records', { records: rows })
  // TODO: 임태균 구현
  res.render('records', { records: [] });
});

// ─────────────────────────────────────────────────────────

module.exports = router;

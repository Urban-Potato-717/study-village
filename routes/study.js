// routes/study.js
// 담당: 임태균 (feature/timer 브랜치)
// 공부 시작/종료 API

var express = require('express');
var router  = express.Router();
// var pool = require('../db/connection');

// ─── 임태균 담당 구현 영역 ────────────────────────────────

// POST /study/start — 공부 시작
router.post('/start', function (req, res, next) {
  // 1) req.session.user 확인 (로그인 필수)
  // 2) INSERT INTO study_logs (user_id, room_id, start_time) VALUES (?, ?, NOW())
  // 3) res.json({ ok: true, logId: ... })
  // TODO: 임태균 구현
  res.json({ ok: false, message: 'TODO: 공부 시작 (임태균)' });
});

// POST /study/end — 공부 종료
router.post('/end', function (req, res, next) {
  // 1) req.body.logId 또는 현재 진행 중인 로그 id 사용
  // 2) UPDATE study_logs SET end_time = NOW(), duration = TIMESTAMPDIFF(SECOND, start_time, NOW()) WHERE id = ?
  // 3) res.json({ ok: true, duration: ... })
  // TODO: 임태균 구현
  res.json({ ok: false, message: 'TODO: 공부 종료 (임태균)' });
});

// ─────────────────────────────────────────────────────────

module.exports = router;

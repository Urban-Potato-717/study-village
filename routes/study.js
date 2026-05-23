// routes/study.js
// 담당: 임태균 (feature/timer 브랜치)
// 타이머 시작 및 종료 API

var express = require('express');
var router  = express.Router();
var pool = require('../db/connection');

// ─── 임태균 담당 구현 영역 ────────────────────────────────

// POST /study/start — 학습 시작 기록
router.post('/start', async function (req, res, next) {
  try {
    if (!req.session.user) {
      return res.status(401).send('로그인이 필요합니다.');
    }

    const userId = req.session.user.id;
    const { roomId } = req.body;

    const sql = 'INSERT INTO study_logs (user_id, room_id, start_time) VALUES (?, ?, NOW())';
    const [result] = await pool.query(sql, [userId, roomId]);

    // 종료할 때 매칭해야 해서 logId 반환
    res.json({ 
      success: true, 
      logId: result.insertId 
        });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

// POST /study/end — 학습 종료 기록
router.post('/end', async function (req, res, next) {
  try {
    const { logId } = req.body;

    const sql = 'UPDATE study_logs SET end_time = NOW() WHERE id = ?';
    await pool.query(sql, [logId]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

// ─────────────────────────────────────────────────────────

module.exports = router;
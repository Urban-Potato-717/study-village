// routes/study.js
// 담당: 임태균 (feature/timer 브랜치) — MVP 본구현은 김준영이 통합 PR로 작성
// 공부 시작/종료 API + 알 부화 처리

var express = require('express');
var router  = express.Router();
var pool    = require('../db/connection');
var rng     = require('../lib/rng');

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

    // 2) study_logs INSERT (start_time = NOW())
    var [insertResult] = await pool.query(
      'INSERT INTO study_logs (user_id, room_id, start_time) VALUES (?, ?, NOW())',
      [userId, roomId]
    );
    var logId = insertResult.insertId;

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

    // 2) 종료 시각 + duration 갱신
    await pool.query(
      'UPDATE study_logs SET end_time = NOW(),'
      + ' duration = TIMESTAMPDIFF(SECOND, start_time, NOW()) WHERE id = ?',
      [logId]
    );
    var [updated] = await pool.query(
      'SELECT duration FROM study_logs WHERE id = ?', [logId]
    );
    var duration = updated[0].duration || 0;

    // 3) 누적 시간 갱신
    await pool.query(
      'UPDATE users SET total_study_seconds = total_study_seconds + ? WHERE id = ?',
      [duration, userId]
    );
    var [userRow] = await pool.query(
      'SELECT total_study_seconds FROM users WHERE id = ?', [userId]
    );
    var totalSeconds = userRow[0].total_study_seconds;

    // 4) 좌석 상태 → 대기
    await pool.query(
      'UPDATE seat_occupancy SET status = ? WHERE user_id = ?',
      ['waiting', userId]
    );

    // 5) 활성 알에 진행도 적용 + 부화 처리
    var eggPayload = null;
    var [eggRows] = await pool.query(
      'SELECT id, required_seconds, progress_seconds FROM eggs'
      + ' WHERE user_id = ? AND is_active = TRUE ORDER BY id ASC LIMIT 1',
      [userId]
    );
    if (eggRows.length > 0) {
      var egg = eggRows[0];
      var newProgress = Math.min(egg.required_seconds, egg.progress_seconds + duration);
      var justHatched = false;
      var newCharacter = null;

      if (newProgress >= egg.required_seconds) {
        // 부화 처리
        await pool.query(
          'UPDATE eggs SET progress_seconds = required_seconds,'
          + ' is_active = FALSE, hatched_at = NOW() WHERE id = ?',
          [egg.id]
        );
        // 가중치 랜덤으로 1장 추첨 (전체 등급)
        newCharacter = await rng.pickWeightedCharacter(pool, {});
        if (newCharacter) {
          await rng.grantCharacterAndMaybeRefreshCurrent(pool, userId, newCharacter.id);
        }
        // 다음 알 자동 지급
        // TODO(시연): 부화 시간은 60초(데모용). 보고서대로면 600초(10분)로 되돌릴 것.
        await pool.query(
          'INSERT INTO eggs (user_id, required_seconds, is_active) VALUES (?, 60, TRUE)',
          [userId]
        );
        justHatched = true;

        eggPayload = {
          progress: 0,
          required: 60,
          justHatched: true,
          newCharacter: newCharacter ? {
            id: newCharacter.id,
            name: newCharacter.name,
            emoji: newCharacter.emoji,
            rarity: newCharacter.rarity,
            imagePath: newCharacter.image_path,
          } : null,
        };
      } else {
        await pool.query(
          'UPDATE eggs SET progress_seconds = ? WHERE id = ?',
          [newProgress, egg.id]
        );
        eggPayload = {
          progress: newProgress,
          required: egg.required_seconds,
          justHatched: false,
        };
      }
    }

    // 6) 브로드캐스트
    var io = req.app.get('io');
    if (io) {
      io.to('room-' + log.room_id).emit('studyStatusChanged', {
        userId: userId, status: 'end',
      });
    }

    res.json({
      ok: true,
      duration: duration,
      totalSeconds: totalSeconds,
      egg: eggPayload,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

// routes/characters.js
// (MVP 통합)
// 도감 페이지 — 전체 캐릭터 + 획득 여부

var express = require('express');
var router  = express.Router();
var pool    = require('../db/connection');

// GET /characters — 도감
router.get('/', async function (req, res, next) {
  try {
    if (!req.session.user) return res.redirect('/auth/login');
    var userId = req.session.user.id;

    // 전체 캐릭터 + 사용자 획득 여부 (LEFT JOIN)
    var [rows] = await pool.query(
      'SELECT c.id, c.name, c.emoji, c.image_path, c.rarity, c.drop_weight,'
      + ' uc.obtained_at, (uc.user_id IS NOT NULL) AS owned'
      + ' FROM characters c'
      + ' LEFT JOIN user_characters uc ON uc.character_id = c.id AND uc.user_id = ?'
      + ' ORDER BY c.rarity DESC, c.id ASC',
      [userId]
    );

    // 0.6v 현재 대표 캐릭터 id — 뷰에서 "대표" 뱃지 표시에 사용
    var [meRows] = await pool.query(
      'SELECT current_character_id FROM users WHERE id = ?',
      [userId]
    );
    var currentCharacterId = meRows[0] ? meRows[0].current_character_id : null;

    var owned = rows.filter(function (r) { return r.owned; }).length;
    var total = rows.length;
    var percent = total > 0 ? Math.round((owned / total) * 100) : 0;

    res.render('characters', {
      characters: rows,
      dex: { owned: owned, total: total, percent: percent },
      currentCharacterId: currentCharacterId,
    });
  } catch (err) {
    next(err);
  }
});

// 0.6v POST /characters/select — 도감에서 대표 캐릭터 변경
// 핵심: 내가 "보유한" 캐릭터인지 서버에서 검증 후에만 users.current_character_id 갱신
// (안 가진 캐릭터를 클라가 직접 보내도 막아야 하므로 — 검증은 서버에서)
router.post('/select', async function (req, res, next) {
  try {
    // 1) 로그인 체크 (JSON 응답)
    if (!req.session.user) return res.status(401).json({ ok: false, message: '로그인이 필요합니다.' });
    var userId = req.session.user.id;

    // 2) 요청 캐릭터 id 파싱
    var characterId = parseInt(req.body.characterId, 10);
    if (!characterId) return res.status(400).json({ ok: false, message: '캐릭터를 선택하세요.' });

    // 3) 내가 보유한 캐릭터인지 검증 (user_characters 에 행이 있어야 함)
    var [ownRows] = await pool.query(
      'SELECT 1 FROM user_characters WHERE user_id = ? AND character_id = ?',
      [userId, characterId]
    );
    if (ownRows.length === 0) {
      return res.status(403).json({ ok: false, message: '아직 획득하지 않은 캐릭터입니다.' });
    }

    // 4) 선택 캐릭터 갱신 (방/좌석 렌더는 DB에서 매번 읽으므로 새로고침 시 자동 반영)
    await pool.query(
      'UPDATE users SET current_character_id = ? WHERE id = ?',
      [characterId, userId]
    );

    // 5) 학습방 실시간 반영 (방을 새로 안 들어가도 즉시 바뀌게)
    var io = req.app.get('io');
    if (io) {
      // 새 캐릭터 정보 (보유 검증을 통과했으므로 존재 보장)
      var [chRows] = await pool.query(
        'SELECT emoji, image_path, name FROM characters WHERE id = ?',
        [characterId]
      );
      var ch = chRows[0] || {};
      var charInfo = {
        userId: userId,
        emoji: ch.emoji || '',
        imagePath: ch.image_path || '',
        characterName: ch.name || null,
      };

      // 내가 보고 있는 방 결정 — GET /room 과 동일 규칙
      //   current_room_id 있으면 그 private 방, NULL 이면 로비(host 없는 기본 공용 방, 보통 id 1)
      //   ※ 로비는 current_room_id 가 NULL 이라 이 보정 없이는 room-null 로 새서 갱신이 안 됨
      var [uRows] = await pool.query('SELECT current_room_id FROM users WHERE id = ?', [userId]);
      var roomId = uRows[0] ? uRows[0].current_room_id : null;
      if (roomId === null) {
        var [lobbyRows] = await pool.query(
          'SELECT id FROM rooms WHERE host_user_id IS NULL ORDER BY id ASC LIMIT 1'
        );
        roomId = lobbyRows[0] ? lobbyRows[0].id : null;
      }

      if (roomId) {
        // 5-a) 사이드바 "내 캐릭터" 패널 → myCharacterChanged (좌석에 안 앉아도 갱신)
        io.to('room-' + roomId).emit('myCharacterChanged', charInfo);

        // 5-b) 좌석에 앉아 있으면 좌석 타일도 → seatUpdated (socket.js payload 모양과 동일)
        var [seatRows] = await pool.query(
          'SELECT seat_number, status FROM seat_occupancy WHERE user_id = ?',
          [userId]
        );
        if (seatRows.length > 0) {
          var s = seatRows[0];
          io.to('room-' + roomId).emit('seatUpdated', {
            seatNumber: s.seat_number,
            status: s.status,
            user: {
              id: userId,
              nickname: req.session.user.nickname,
              emoji: charInfo.emoji,
              imagePath: charInfo.imagePath,
              characterName: charInfo.characterName,
            },
          });
        }
      }
    }

    // 6) 응답
    res.json({ ok: true, characterId: characterId });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

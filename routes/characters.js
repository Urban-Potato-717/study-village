// routes/characters.js
// 담당: 김준영 (팀장 MVP 통합)
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

    var owned = rows.filter(function (r) { return r.owned; }).length;
    var total = rows.length;
    var percent = total > 0 ? Math.round((owned / total) * 100) : 0;

    res.render('characters', {
      characters: rows,
      dex: { owned: owned, total: total, percent: percent },
      currentCharacterId: null, // MVP: 변경 UI 미구현
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

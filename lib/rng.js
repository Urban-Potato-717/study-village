// lib/rng.js
// 담당: 김준영 (팀장 작업)
// 캐릭터 가중치 랜덤 추첨 + 도감 등록 헬퍼
// - 회원가입 직후 N등급 1장 자동 지급
// - /study/end 에서 알이 부화될 때 전체 등급에서 1장 추첨

// drop_weight 합산 후 Math.random() 으로 한 행을 골라 반환
// rarityIn 을 지정하면 해당 등급 안에서만 추첨 (예: ['N'])
async function pickWeightedCharacter(pool, options) {
  var opts = options || {};
  var rarityIn = Array.isArray(opts.rarityIn) && opts.rarityIn.length > 0
    ? opts.rarityIn
    : null;

  var sql = 'SELECT id, name, image_path, emoji, rarity, drop_weight FROM characters';
  var params = [];
  if (rarityIn) {
    sql += ' WHERE rarity IN (' + rarityIn.map(function () { return '?'; }).join(',') + ')';
    params = rarityIn;
  }

  var [rows] = await pool.query(sql, params);
  if (rows.length === 0) return null;

  var total = rows.reduce(function (acc, c) { return acc + c.drop_weight; }, 0);
  var pick = Math.random() * total;
  var cursor = 0;
  for (var i = 0; i < rows.length; i++) {
    cursor += rows[i].drop_weight;
    if (pick < cursor) return rows[i];
  }
  return rows[rows.length - 1]; // 부동소수 오차 대비
}

// user_characters 에 INSERT IGNORE 로 등록 (중복이면 무시)
// 사용자의 current_character_id 가 비어있으면 이 캐릭터로 세팅
async function grantCharacterAndMaybeRefreshCurrent(pool, userId, characterId) {
  await pool.query(
    'INSERT IGNORE INTO user_characters (user_id, character_id) VALUES (?, ?)',
    [userId, characterId]
  );

  var [userRows] = await pool.query(
    'SELECT current_character_id FROM users WHERE id = ?',
    [userId]
  );
  if (userRows.length === 0) return;

  if (userRows[0].current_character_id == null) {
    await pool.query(
      'UPDATE users SET current_character_id = ? WHERE id = ?',
      [characterId, userId]
    );
  }
}

module.exports = {
  pickWeightedCharacter: pickWeightedCharacter,
  grantCharacterAndMaybeRefreshCurrent: grantCharacterAndMaybeRefreshCurrent,
};

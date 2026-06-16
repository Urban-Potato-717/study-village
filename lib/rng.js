// 캐릭터 가중치 랜덤 추첨 + 도감 등록 역할을 수행한다
// 1. 회원가입 직후 N등급 1장 자동 지급
// 2. /study/end 에서 알이 부화될 때 전체 등급에서 1장 추첨
 
//! 룰렛 휠 알고리즘 방식 사용
async function pickWeightedCharacter(pool, options) {
  // 1) SQL 조건 조립
  var opts = options || {}; // options가 없거나 null -> 빈 객체 사용
  // opts.rarityIn이 배열인가? AND 배열 길이가 0보다 큰가?
  var rarityIn = Array.isArray(opts.rarityIn) && opts.rarityIn.length > 0
    ? opts.rarityIn
    : null;

  var sql = 'SELECT id, name, image_path, emoji, rarity, drop_weight FROM characters';
  var params = [];
  if (rarityIn) { // * rarityIn 을 지정하면 해당 등급 안에서만 추첨 (예: ['N']) *
    sql += ' WHERE rarity IN (' + rarityIn.map(function () { return '?'; }).join(',') + ')';
    params = rarityIn;
  }

  var [rows] = await pool.query(sql, params);
  if (rows.length === 0) return null;

  // 2) 가중치 총합 계산
  var total = rows.reduce(function (acc, c) { return acc + c.drop_weight; }, 0);

  // 3) 랜덤 숫자 뽑고 구간 탐색
  var pick = Math.random() * total;
  var cursor = 0;
  for (var i = 0; i < rows.length; i++) {
    cursor += rows[i].drop_weight;
    if (pick < cursor) return rows[i];
  }
  return rows[rows.length - 1]; // 오류 대비?
}

// user_characters 에 INSERT IGNORE 로 등록 (중복이면 무시)
// 사용자의 current_character_id 가 비어있으면 이 캐릭터로 세팅 
// 함수 이름 너무 길게 지은듯
async function grantCharacterAndMaybeRefreshCurrent(pool, userId, characterId) {
  // 1) 도감에 등록 - 이미 있으면 걍 건너뛰어 * INSERT IGNORE 활용
  await pool.query(
    'INSERT IGNORE INTO user_characters (user_id, character_id) VALUES (?, ?)',
    [userId, characterId]
  );

  // 2) 현재 대표 캐릭터가 없슴 (처음 가입함) - 이 캐릭터 대표로 세팅
  var [userRows] = await pool.query(
    'SELECT current_character_id FROM users WHERE id = ?',
    [userId]
  );
  if (userRows.length === 0) return;

  // undefined도 잡게
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

// 0.3v 신규: 공부 세션 시작/종료 로직을 라우터에서 분리한 공용 헬퍼.
// 개인 타이머(routes/study.js)와 (예정) 방장 그룹 타이머(socket/socket.js)에서 재사용.

var rng = require('./rng');

// 1) 세션 시작: 좌석을 focusing 으로 바꾸고 study_logs 한 줄(start_time=NOW()) INSERT
// 반환: 새로 생성된 logId
async function startSession(pool, userId, roomId) {
  // '집중중' 모드로 변경
  await pool.query(
    'UPDATE seat_occupancy SET status = ? WHERE user_id = ?',
    ['focusing', userId]
  );
  //* 시작 (NOW())
  var [result] = await pool.query(
    'INSERT INTO study_logs (user_id, room_id, start_time) VALUES (?, ?, NOW())',
    [userId, roomId]
  );
  return result.insertId;
}

// 2) 세션 종료: duration 계산 + 누적 시간 + 좌석 대기 + 알 진행/부화 처리
// log: { id, user_id } (진행 중인 study_logs 한 줄)
// 반환: { duration, egg }
async function endSession(pool, log) {
  //* 1 - 종료 시각 + duration (TIMESTAMPDIFF + NOW())
  await pool.query(
    'UPDATE study_logs SET end_time = NOW(),'
    + ' duration = TIMESTAMPDIFF(SECOND, start_time, NOW()) WHERE id = ?',
    [log.id]
  );
  var [updated] = await pool.query(
    'SELECT duration FROM study_logs WHERE id = ?', [log.id]
  );
  var duration = updated[0].duration || 0;

  // 2 - 누적 시간 계산 UPDATE
  await pool.query(
    'UPDATE users SET total_study_seconds = total_study_seconds + ? WHERE id = ?',
    [duration, log.user_id]
  );

  // 3 - 좌석을 '대기'상태로 UPDATE
  await pool.query(
    'UPDATE seat_occupancy SET status = ? WHERE user_id = ?',
    ['waiting', log.user_id]
  );

  // 4) 알 진행/부화
  var egg = await applyEgg(pool, log.user_id, duration);

  return { duration: duration, egg: egg };
}

// 1) 내 활성 알 가져오기 - from DB
async function applyEgg(pool, userId, duration) {
  var [eggRows] = await pool.query(
    'SELECT id, required_seconds, progress_seconds FROM eggs'
    + ' WHERE user_id = ? AND is_active = TRUE ORDER BY id ASC LIMIT 1',
    [userId]
  );
  // 알이 없을 시 (err) 끝
  if (eggRows.length === 0) return null;

  var egg = eggRows[0];
  // 2) 새 진행도 계산(필요 시간, 달성 시간)
  var newProgress = Math.min(egg.required_seconds, egg.progress_seconds + duration);

  // 3) 부화 판정
  if (newProgress >= egg.required_seconds) {
    // * 부화 - is_active = FALSE (부화 됐다는 뜻)
    await pool.query(
      'UPDATE eggs SET progress_seconds = required_seconds,'
      + ' is_active = FALSE, hatched_at = NOW() WHERE id = ?',
      [egg.id]
    );
    //* 캐릭터 추첨 lib/rng
    var newCharacter = await rng.pickWeightedCharacter(pool, {});
    if (newCharacter) {
      await rng.grantCharacterAndMaybeRefreshCurrent(pool, userId, newCharacter.id);
    }
    // 다음 알 자동 지급
    // TODO(시연): 새 알 - 부화 요구 시간 60초 시연용
    await pool.query(
      'INSERT INTO eggs (user_id, required_seconds, is_active) VALUES (?, 60, TRUE)',
      [userId]
    );
    // client에 반환할것들
    return {
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
  }

  // 부화 안함 - 진행도만 증가
  await pool.query(
    'UPDATE eggs SET progress_seconds = ? WHERE id = ?',
    [newProgress, egg.id]
  );
  return { progress: newProgress, required: egg.required_seconds, justHatched: false };
}

module.exports = { startSession: startSession, endSession: endSession };

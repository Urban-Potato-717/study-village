// Object: 초대 코드 발급 -> rooms에 INSERT 이름 + host_id 혹은 invite_code=[code] -> 나를 그 방으로 이동 -> /room redirect

var express = require('express');
var router  = express.Router();
var pool    = require('../db/connection');
var inviteCode = require('../lib/inviteCode');

// GET /room 처리
router.get('/', async function (req, res, next) {
  try {
    if (!req.session.user) return res.redirect('/auth/login');
    var me = req.session.user;

    // 1) 내 최신 current_room_id 를 DB에서 직접 조회.
    var [userRows] = await pool.query(
        'SELECT current_room_id FROM users WHERE id = ?',                                                     
        [me.id] // me는 객체 전체 - 유저 번호 하나는 me.id    
      );
    var currentRoomId = userRows[0] ? userRows[0].current_room_id : null; //SELECT 했던 컬럼명과 같게

    // 2) 방 결정 — NULL 이면 로비, 값 있으면 그 private 방
    var roomRows;
    if (currentRoomId === null) {
        // 로비: 공용 라이브러리 (host 없는 기본 공용 방)
        [roomRows] = await pool.query(
          'SELECT id, name, capacity, host_user_id, invite_code FROM rooms WHERE host_user_id IS NULL ORDER BY id ASC LIMIT 1'
        );
    } else {
        // private 방
        [roomRows] = await pool.query(
          'SELECT id, name, capacity, host_user_id, invite_code FROM rooms WHERE id = ?',
          [currentRoomId]
      );
    }

    if (roomRows.length === 0) {
        return res.status(500).send('학습방 데이터가 없습니다. db/schema.sql 을 실행하세요.');
    }
    var room = roomRows[0];

    // 2) 현재 점유 좌석들 (사용자/캐릭터 JOIN)
    var [occupied] = await pool.query(
      'SELECT so.seat_number, so.status, u.id AS user_id, u.nickname,'
      + ' c.emoji, c.image_path, c.name AS character_name'
      + ' FROM seat_occupancy so'
      + ' JOIN users u ON u.id = so.user_id'
      + ' LEFT JOIN characters c ON c.id = u.current_character_id'
      + ' WHERE so.room_id = ?',
      [room.id]
    );
    var occMap = {};
    occupied.forEach(function (r) { occMap[r.seat_number] = r; });

    // 3) 12석 배열 구성
    var seats = [];
    for (var i = 1; i <= room.capacity; i++) {
      var o = occMap[i];
      seats.push({
        seatNumber: i,
        occupied: !!o,
        status: o ? o.status : null,
        user: o ? {
          id: o.user_id,
          nickname: o.nickname,
          emoji: o.emoji || '',
          imagePath: o.image_path || '',
          characterName: o.character_name || null,
          isMe: o.user_id === me.id,
        } : null,
      });
    }

    // 4) 사이드바: 내 정보 + 활성 알 + 오늘 통계
    var [meRows] = await pool.query(
      'SELECT u.nickname, u.total_study_seconds, c.emoji, c.image_path, c.name AS character_name'
      + ' FROM users u LEFT JOIN characters c ON c.id = u.current_character_id'
      + ' WHERE u.id = ?',
      [me.id]
    );
    var meInfo = meRows[0] || { nickname: me.nickname, total_study_seconds: 0 };

    var [eggRows] = await pool.query(
      'SELECT required_seconds, progress_seconds FROM eggs'
      + ' WHERE user_id = ? AND is_active = TRUE ORDER BY id ASC LIMIT 1',
      [me.id]
    );
    var egg = eggRows[0]
      ? { progress: eggRows[0].progress_seconds, required: eggRows[0].required_seconds }
      : { progress: 0, required: 60 }; // TODO(시연): 보고서대로면 600

    var [todayRows] = await pool.query(
      'SELECT COALESCE(SUM(duration), 0) AS sec, COUNT(*) AS cnt'
      + ' FROM study_logs WHERE user_id = ? AND DATE(start_time) = CURDATE()'
      + ' AND end_time IS NOT NULL',
      [me.id]
    );
    var today = {
      minutes: Math.floor((todayRows[0].sec || 0) / 60),
      sessions: todayRows[0].cnt || 0,
    };

    // 5) 방 소속 인원 목록 (로비=current_room_id NULL, private=room.id)
    //    WHERE 절만 분기 — 값은 항상 파라미터로 바인딩(SQL 안전)라는데 음 뭐라는거지
    var memberWhere = currentRoomId === null
      ? 'u.current_room_id IS NULL'
      : 'u.current_room_id = ?';
    var memberParams = currentRoomId === null ? [] : [currentRoomId];
    var [memberRows] = await pool.query(
      'SELECT u.id, u.nickname, c.emoji'
      + ' FROM users u LEFT JOIN characters c ON c.id = u.current_character_id'
      + ' WHERE ' + memberWhere
      + ' ORDER BY u.id ASC',
      memberParams
    );
    var members = memberRows.map(function (m) {
      return { id: m.id, nickname: m.nickname, emoji: m.emoji || '', isMe: m.id === me.id };
    });

    res.render('room', {
      room: room,
      seats: seats,
      me: {
        id: me.id,
        nickname: meInfo.nickname,
        emoji: meInfo.emoji || '',
        imagePath: meInfo.image_path || '',
        characterName: meInfo.character_name,
        totalMinutes: Math.floor((meInfo.total_study_seconds || 0) / 60),
      },
      egg: egg,
      today: today,
      members: members,
      // 로비 여부: host 없는 방이면 로비. 뷰에서 방만들기/입장 폼 vs 초대코드/나가기 분기에 사용
      isLobby: room.host_user_id == null,
      error: req.flash('error'),
    });
  } catch (err) {
    next(err);
  }
});

// GET /room/members - 현재 내 방의 인원 목록 (JSON, 클라 폴링용)
router.get('/members', async function (req, res, next) {
  try {
    if (!req.session.user) return res.status(401).json({ members: [] });
    var me = req.session.user;

    // 내 최신 current_room_id 조회 (세션 값은 stale)
    var [userRows] = await pool.query(
      'SELECT current_room_id FROM users WHERE id = ?',
      [me.id]
    );
    var currentRoomId = userRows[0] ? userRows[0].current_room_id : null;

    // 소속 인원 (로비=NULL, private=그 방). WHERE 절만 분기, 값은 ? 바인딩
    var memberWhere = currentRoomId === null
      ? 'u.current_room_id IS NULL'
      : 'u.current_room_id = ?';
    var memberParams = currentRoomId === null ? [] : [currentRoomId];
    var [rows] = await pool.query(
      'SELECT u.id, u.nickname, c.emoji'
      + ' FROM users u LEFT JOIN characters c ON c.id = u.current_character_id'
      + ' WHERE ' + memberWhere
      + ' ORDER BY u.id ASC',
      memberParams
    );
    res.json({
      members: rows.map(function (m) {
        return { id: m.id, nickname: m.nickname, emoji: m.emoji || '' };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// POST /room/create 처리 - 방 생성
router.post('/create', async function (req, res, next){
  try{
    if (!req.session.user) return res.redirect('/auth/login');
    var me = req.session.user;
    var name = req.body.name || (me.nickname + '의 방');

    // 1) 초대코드 발급 받아오기
    var code = await inviteCode.generateUniqueInviteCode(pool);

    // 2) rooms INSERT - DB
    var [result] = await pool.query(
      'INSERT INTO rooms (name, host_user_id, invite_code) VALUES (?,?,?)',
      // INSERT INTO 테이블 (칼럼, 칼럼, 칼럼) VALUES (실제 들어갈 값들의 플레이스 홀더 = ?) 
      //! rooms 테이블에 "새 row" 하나를 추가한다. (칼럼 칼럼 칼럼)은 이 row의 구성, values에 실제 들어갈 값.
      [name, me.id, code]
    );
    var newRoomID = result.insertId; //! insertID = 방금 생성된 행의 AUTO_INCREMENT id.

    // 3) 나를 그 방으로 이동
    await pool.query(
      'UPDATE users SET current_room_id = ? WHERE id = ?',
      [newRoomID, me.id]
    );

    // 4) 방 화면으로
    res.redirect('/room');
  } catch (err){
    next(err);
  }
});

// POST /room/join 처리 - 초대코드로 입장
router.post('/join', async function (req, res, next) {
  try{
    if(!req.session.user) return res.redirect('/auth/login');
    var me = req.session.user;

    // 1) 폼에서 받은 코드 다듬기 - 사용자가 소문자/공백 입력할 수 있으니 다듬기. (공백 제거 + 소문자 대문자 변환)
    var code = (req.body.code || '').trim().toUpperCase();

    // 2) 빈 입력 방어 - 로비 리다리렉트
    if(!code) {
      req.flash('error', '초대코드를 입력하세요.');
      return res.redirect('/room');
    }

    // 3) 코드로 방 조회
    var [rooms] = await pool.query(
      'SELECT id FROM rooms WHERE invite_code = ?',
      [code]
    );

    // 4) 없는 코드만 입장 실패 처리
    if (rooms.length === 0){
      req.flash('error', '존재하지 않는 초대코드 입니다');
      return res.redirect('/room');
    }
    var roomId = rooms[0].id; //! 조회된 첫 번째 방 객체에서 방의 id 값 저장해두기

    // 5) 나를 그 방으로 이동 ("한 방만" 제약)
    await pool.query(
      'UPDATE users SET current_room_id = ? WHERE id = ?',
      [roomId, me.id] // 아까 조회한 roomId 활용
    );

    // 6) 방 화면으로
    res.redirect('/room');
  } catch (err) {
    next(err);
  }
});

// POST /room/leave 처리 - 방 나가기 (로비로 복귀)
router.post('/leave', async function (req, res, next){
  try{
    if (!req.session.user) return res.redirect('/auth/login');
    var me = req.session.user;

    // current_room_id 를 NULL 로 → GET /room 이 로비를 렌더
    await pool.query(
      'UPDATE users SET current_room_id = NULL WHERE id = ?',
      [me.id]
    );

    res.redirect('/room');
  } catch (err){
    next(err);
  }
});

module.exports = router;

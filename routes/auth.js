// routes/auth.js
// 담당: 송정한 (feature/auth 브랜치)
// 수업 11주차: express.Router()로 라우터 객체 생성 → 라우팅 분리

var express = require('express');
var router  = express.Router();
var pool = require('../db/connection'); // 12주차: 필요 시 주석 해제하여 DB 사용
var crypto  = require('crypto');
// MVP: 회원가입 시 알 지급 + N등급 캐릭터 자동 추첨에 사용
var rng = require('../lib/rng');

// ─── 송정한 담당 구현 영역 ────────────────────────────────

// GET /auth/login - 로그인 페이지 렌더링
router.get('/login', function (req, res, next) {
    res.render('login', { message: req.flash('error') });
});

// POST /auth/login - 로그인 처리
router.post('/login', async function (req, res, next) {
    try {
        // 1) req.body에서 폼 데이터 접근
        const { username, password } = req.body;

        // 2) pool.query로 DB에서 사용자 조회
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        
        if (rows.length === 0) {
            req.flash('error', '존재하지 않는 아이디입니다.');
            return res.redirect('/auth/login');
        }

        const user = rows[0];

        // 3) 비밀번호 확인 (crypto sha512 방식 적용)
        const hashedPassword = crypto.createHash('sha512').update(password).digest('base64');

        if (user.password !== hashedPassword) {
            // 5) 실패 시 req.flash 후 redirect
            req.flash('error', '비밀번호가 일치하지 않습니다.');
            return res.redirect('/auth/login');
        }

        // 4) 성공 시 req.session.user에 세션 저장
        req.session.user = {
            id: user.id,
            username: user.username,
            nickname: user.nickname
        };

        // 메인 화면이나 로비로 이동 (프로젝트 구조에 맞게 수정 가능)
        res.redirect('/'); 

    } catch (err) {
        next(err);
    }
});

// GET /auth/register - 회원가입 페이지
router.get('/register', function (req, res, next) {
    res.render('register');
});

// POST /auth/register - 회원가입 처리
router.post('/register', async function (req, res, next) {
    try {
        // 1) req.body에서 username, password, nickname 받기
        const { username, password, nickname } = req.body;

        // [추가 항목] 아이디 중복 체크
        const [existUser] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existUser.length > 0) {
            return res.send('<script>alert("이미 존재하는 아이디입니다."); history.back();</script>');
        }

        // 2) 비밀번호 해시 처리 (crypto)
        const hashedPassword = crypto.createHash('sha512').update(password).digest('base64');

        // 3) INSERT INTO users로 DB에 새 회원 저장
        const [insertResult] = await pool.query(
            'INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)',
            [username, hashedPassword, nickname]
        );
        const newUserId = insertResult.insertId;

        // ─── MVP: 첫 알 1개 + N등급 캐릭터 1장 자동 지급 ───
        // 알: 활성(is_active=TRUE) 상태로 즉시 등록 → 첫 공부 종료부터 부화 진행도 증가
        await pool.query(
            'INSERT INTO eggs (user_id, required_seconds, is_active) VALUES (?, 600, TRUE)',
            [newUserId]
        );

        // N등급 캐릭터에서 가중치 랜덤 1장 추첨 → 도감 등록 + 현재 캐릭터로 세팅
        const starter = await rng.pickWeightedCharacter(pool, { rarityIn: ['N'] });
        if (starter) {
            await rng.grantCharacterAndMaybeRefreshCurrent(pool, newUserId, starter.id);
        }

        // 4) 성공 시 /auth/login 으로 리다이렉트
        res.redirect('/auth/login');

    } catch (err) {
        next(err);
    }
});

// GET /auth/logout - 로그아웃
router.get('/logout', function (req, res, next) {
    // 세션 파괴 후 홈으로 이동
    req.session.destroy(function () {
        res.redirect('/');
    });
});

// POST /auth/withdraw - 회원 탈퇴 처리
router.post('/withdraw', async function (req, res, next) {
    try {
        // 1) 로그인한 사용자인지 확인 (세션 체크)
        if (!req.session.user) {
            return res.send('<script>alert("로그인이 필요합니다."); location.href="/auth/login";</script>');
        }

        const username = req.session.user.username;

        // 2) DB에서 해당 사용자 데이터 삭제 (DELETE문 사용)
        await pool.query('DELETE FROM users WHERE username = ?', [username]);

        // 3) 세션 파괴 (로그아웃 처리)
        req.session.destroy(function () {
            // 4) 탈퇴 성공 메시지 띄우고 메인 화면으로 리다이렉트
            res.send('<script>alert("회원 탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다."); location.href="/";</script>');
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
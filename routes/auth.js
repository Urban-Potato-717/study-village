// routes/auth.js
// 담당: 송정한 (feature/auth 브랜치)
// 수업 11주차: express.Router()로 라우터 객체 생성 → 라우팅 분리

var express = require('express');
var router  = express.Router();
// var pool = require('../db/connection'); // 12주차: 필요 시 주석 해제하여 DB 사용

// ─── 송정한 담당 구현 영역 ────────────────────────────────

// GET /auth/login — 로그인 페이지 렌더링
router.get('/login', function (req, res, next) {
  // res.render('login') — 11주차: res.render로 EJS 템플릿 렌더링
  res.render('login', { message: req.flash('error') });
});

// POST /auth/login — 로그인 처리
router.post('/login', function (req, res, next) {
  // 1) req.body.username, req.body.password로 폼 데이터 접근 (10주차)
  // 2) pool.query('SELECT * FROM users WHERE username = ?', [...]) (12주차)
  // 3) 비밀번호 확인 (crypto sha512 등 — 5~7주차)
  // 4) 성공 시 req.session.user = { id, username, nickname } (11주차)
  // 5) 실패 시 req.flash('error', '메시지') 후 redirect
  // TODO: 송정한 구현
  res.send('TODO: 로그인 처리 (송정한)');
});

// GET /auth/register — 회원가입 페이지
router.get('/register', function (req, res, next) {
  res.render('register');
});

// POST /auth/register — 회원가입 처리
router.post('/register', function (req, res, next) {
  // 1) req.body.username, password, nickname 받기
  // 2) 비밀번호 해시 처리 (crypto)
  // 3) INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)
  // 4) 성공 시 /auth/login 으로 redirect
  // TODO: 송정한 구현
  res.send('TODO: 회원가입 처리 (송정한)');
});

// GET /auth/logout — 로그아웃
router.get('/logout', function (req, res, next) {
  // req.session.destroy() 후 / 로 redirect
  // TODO: 송정한 구현
  req.session.destroy(function () {
    res.redirect('/');
  });
});

// ─────────────────────────────────────────────────────────

module.exports = router;

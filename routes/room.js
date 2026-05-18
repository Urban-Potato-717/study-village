// routes/room.js
// 담당: 김준영(일부), 오유진(뷰)
// 학습방/좌석 라우터

var express = require('express');
var router  = express.Router();
// var pool = require('../db/connection');

// GET /room — 학습방 화면
router.get('/', function (req, res, next) {
  // TODO: 로그인 안 했으면 /auth/login 으로 redirect
  // if (!req.session.user) return res.redirect('/auth/login');

  // 임시: 좌석 6개 더미 데이터 — 추후 DB 또는 socket으로 대체
  var seats = [
    { id: 1, occupied: false },
    { id: 2, occupied: false },
    { id: 3, occupied: false },
    { id: 4, occupied: false },
    { id: 5, occupied: false },
    { id: 6, occupied: false },
  ];
  res.render('room', { seats: seats });
});

module.exports = router;

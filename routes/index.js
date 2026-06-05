// routes/index.js
// express.Router()로 라우터 객체 생성 → module.exports = router로 모듈화
// 메인 페이지 라우터

var express = require('express');
var router  = express.Router();

// GET / — 메인 화면
router.get('/', function (req, res, next) {
  res.render('index');
});

module.exports = router;

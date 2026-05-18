// app.js
// 수업 10주차: app.js는 서버의 본체(핵심 파일)
// 팀원 안내: 이 파일은 팀장(김준영)이 관리합니다. 직접 수정하지 말고 요청해주세요.

var express      = require('express');
var path         = require('path');
var morgan       = require('morgan');          // 10주차: logger 미들웨어
var cookieParser = require('cookie-parser');   // 10주차: 쿠키 파싱 미들웨어
var session      = require('express-session'); // 11주차: 세션 관리 미들웨어
var flash        = require('connect-flash');   // 11주차: 일회성 메시지 미들웨어
require('dotenv').config();                    // .env 파일 로드

// ① express 패키지를 호출하여 app 객체 생성 (10주차 슬라이드 13)
var app = express();

// ② app.set으로 익스프레스 옵션 설정 (10주차 슬라이드 13)
// 수업: "app.set(키, 값)으로 데이터를 저장하고, app.get(키)로 가져올 수 있음"
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs'); // EJS 템플릿 엔진 (10주차 6.5절)

// ③ app.use로 미들웨어 연결 (10주차 슬라이드 15)
// 수업: "next()로 다음 미들웨어로 넘어감 — 라우터와 에러 핸들러도 미들웨어"

// morgan: HTTP 요청 로그를 콘솔에 출력
app.use(morgan('dev'));

// body-parser: req.body 사용 (10주차: json + urlencoded)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// cookie-parser: req.cookies 사용
app.use(cookieParser(process.env.SESSION_SECRET));

// static: public 폴더를 정적 파일로 제공
app.use(express.static(path.join(__dirname, 'public')));

// express-session: 세션 관리 (11주차 슬라이드 4)
app.use(session({
  resave: false,            // 수정사항 없으면 다시 저장하지 않음
  saveUninitialized: false, // 저장할 내역이 없으면 세션을 만들지 않음
  secret: process.env.SESSION_SECRET || 'study-village-secret',
  cookie: {
    httpOnly: true, // 클라이언트 JS에서 쿠키 접근 금지
    secure: false,  // https 환경이면 true
  },
}));

// connect-flash: 일회성 메시지 (11주차 슬라이드 5)
// 수업: "cookie-parser와 express-session 아래에 위치(의존 관계)"
app.use(flash());

// 모든 뷰에서 현재 로그인 사용자(currentUser)에 접근 가능
app.use(function (req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
});

// ─────────────────────────────────────────
// 라우터 연결 (11주차: Router 객체로 라우팅 분리)
// ─────────────────────────────────────────
var indexRouter   = require('./routes/index');
var authRouter    = require('./routes/auth');
var roomRouter    = require('./routes/room');
var studyRouter   = require('./routes/study');
var recordsRouter = require('./routes/records');

app.use('/',        indexRouter);
app.use('/auth',    authRouter);
app.use('/room',    roomRouter);
app.use('/study',   studyRouter);
app.use('/records', recordsRouter);

// Socket.IO 연결은 bin/www에서 처리

// ─────────────────────────────────────────
// 404 처리 미들웨어 (10주차)
// ─────────────────────────────────────────
app.use(function (req, res, next) {
  res.status(404).send('페이지를 찾을 수 없습니다.');
});

// ─────────────────────────────────────────
// 에러 핸들러 (10주차): 매개변수가 (err, req, res, next) 4개
// ─────────────────────────────────────────
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error   = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// ④ app 객체를 모듈로 만듦 → bin/www에서 require('../app')으로 불러옴
module.exports = app;

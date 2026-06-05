// 해당 파일은 팀장이 관리.
var express      = require('express');         // exrpess FrameWork. 
var path         = require('path');            // 경로
var morgan       = require('morgan');          // logger 미들웨어
var cookieParser = require('cookie-parser');   // 쿠키 파싱 미들웨어 (req.cookies.이름)
var session      = require('express-session'); // 세션 관리 미들웨어 (로그인 상태유지)
var flash        = require('connect-flash');   // 일회성 메시지 미들웨어
require('dotenv').config();                    // .env 파일 로드 (process.env.xxx)

var app = express();

//* app.set - 설정 저장 
// "app.set(키, 값)으로 데이터 저장, app.get(키)로 가져올 수 있음"
app.set('views', path.join(__dirname, 'views')); // 템플릿 파일이 'views/' 폴더에 있다.
app.set('view engine', 'ejs');                   // EJS 템플릿 엔진 선언

//* app.use - 미들웨어 장착
// 요청(req) → [미들웨어1] → [미들웨어2] → [라우터] → 응답(res)
app.use(morgan('dev')); // HTTP 요청 로그를 콘솔에 출력

//! paser: 브라우저가 보낸 요청 데이터를 Express가 읽기 좋게 바꿔주는 미들웨어
app.use(express.json());                            // JSON body를 req.body로 읽게 해줌
app.use(express.urlencoded({ extended: false }));   // HTML form body를 req.body로 읽게 해줌
app.use(cookieParser(process.env.SESSION_SECRET));  // Cookie 헤더를 req.cookies로 읽게 해줌

app.use(express.static(path.join(__dirname, 'public'))); // static: public 폴더를 정적 파일로 제공

app.use(session({           // express-session: 서버가 특정 브라우저/사용자에 대해 기억해두는 임시 저장소
  resave: false,            // 수정사항 없으면 다시 저장하지 않음
  saveUninitialized: false, // 저장할 내역이 없으면 세션을 만들지 않음
  secret: process.env.SESSION_SECRET || 'study-village-secret',
  cookie: {
    httpOnly: true, // 클라이언트 JS에서 쿠키 접근 금지
    secure: false,  // https 환경이면 true
  },
}));

// connect-flash: 일회성 메시지 
// "무조건 cookie-parser와 express-session 아래에 위치(의존 관계)"
app.use(flash());

// 모든 View(EJS)에서 현재 로그인 사용자(currentUser)에 접근 
// 모든 view에서 currentUser라는 이름으로 쓸 수 있게 복사해주는 미들웨어
app.use(function (req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
});

//* 라우터 연결 (Router 객체로 라우팅 분리)
var indexRouter = require('./routes/index');
var authRouter = require('./routes/auth');
var roomRouter = require('./routes/room');
var studyRouter = require('./routes/study');
var recordsRouter = require('./routes/records');
var charactersRouter = require('./routes/characters');

// 가져온 라우터를 Express 앱의 특정 주소에 붙이는 작업
app.use('/', indexRouter);
app.use('/auth', authRouter); // /auth로 시작하는 요청은 authRouter가 처리하게 하겠다
app.use('/room', roomRouter);
app.use('/study', studyRouter);
app.use('/records', recordsRouter);
app.use('/characters', charactersRouter);

//! Socket.IO 연결은 bin/www에서 처리

// 404 처리 미들웨어
app.use(function (req, res, next) {
  res.status(404).send('페이지를 찾을 수 없습니다.');
});

// 에러 핸들러 : 매개변수가 (err, req, res, next) 4개
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error   = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// app 객체를 모듈로
module.exports = app;

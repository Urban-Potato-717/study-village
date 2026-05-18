# Study Village

웹서버프로그래밍 팀 프로젝트 — 웹 기반 공동 학습 서비스.

수업(정복래 교수님 10~12주차)의 Express + EJS + MySQL 패턴을 그대로 따릅니다.

## 기술 스택

- Node.js + Express
- EJS 템플릿
- express-session, connect-flash, cookie-parser, morgan
- MySQL (mysql2/promise)
- Socket.IO

## 폴더 구조

```
study-village/
├─ app.js              서버 본체 (미들웨어, 라우터 연결)
├─ bin/www             서버 실행 스크립트 (포트 지정, http 서버 + Socket.IO)
├─ routes/             URL 경로별 라우터
├─ views/              EJS 템플릿
├─ public/             정적 파일 (css, js, images)
├─ db/                 connection.js (mysql2 pool) + schema.sql
└─ socket/socket.js    Socket.IO 이벤트
```

## 처음 실행하는 방법 (팀원용)

### 1. 프로젝트 받기

```cmd
git clone <저장소-주소>
cd study-village
```

### 2. 패키지 설치

```cmd
npm install
```

### 3. 환경변수 파일 만들기

```cmd
copy .env.example .env
```

`.env` 파일을 열어 본인 MySQL 비밀번호를 채워주세요.

```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=본인_MySQL_비밀번호
DB_NAME=study_village
SESSION_SECRET=study_village_secret_key
```

> `.env`는 절대 GitHub에 올리지 마세요. `.gitignore`에 등록되어 있습니다.

### 4. MySQL 스키마 실행

MySQL Workbench를 열고 `db/schema.sql` 파일 내용을 실행합니다.
`study_village` 데이터베이스, `사용자`, `rooms`, `study_logs` 테이블이 생성됩니다.

### 5. 서버 실행

개발용 (코드 변경 시 자동 재시작):

```cmd
npm run dev
```

운영용:

```cmd
npm start
```

### 6. 브라우저 접속

http://localhost:3000

## 기본 경로

| 경로 | 설명 | 담당 |
|---|---|---|
| `/` | 메인 | 김준영 |
| `/auth/login` | 로그인 | 송정한 |
| `/auth/register` | 회원가입 | 송정한 |
| `/auth/logout` | 로그아웃 | 송정한 |
| `/room` | 학습방/좌석 | 오유진(뷰), 김준영(라우터) |
| `/study/start`, `/study/end` | 공부 시작/종료 | 임태균 |
| `/records` | 내 공부 기록 | 임태균 |

## 팀 작업 방식

### 작업 전

```cmd
git checkout main
git pull origin main
```

### 본인 브랜치에서 작업

```cmd
:: 송정한
git checkout -b feature/auth

:: 임태균
git checkout -b feature/timer

:: 오유진
git checkout -b feature/room
```

### 작업 후 push & Pull Request

```cmd
git add .
git commit -m "feat: 로그인 기능 구현"
git push origin feature/auth
```

GitHub에서 Pull Request를 생성합니다. 팀장(김준영)이 확인 후 main에 merge합니다.

### 수정하면 안 되는 공통 파일

`app.js`, `bin/www`, `package.json`, `package-lock.json`, `db/schema.sql`, `db/connection.js`, `socket/socket.js`, `.env.example`, `.gitignore`, `README.md`

변경이 필요하면 팀장에게 요청해주세요.

## 에러 대처

에러가 나면 다음 정보를 팀장에게 공유해주세요.

1. 무엇을 하다가 발생했는지 (URL, 클릭한 버튼 등)
2. 콘솔에 찍힌 에러 메시지 전체 (스크린샷도 좋음)
3. 브라우저 개발자 도구의 Network 탭에서 실패한 요청

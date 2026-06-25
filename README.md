# Study Village

웹서버프로그래밍 팀 프로젝트로 만든 웹 기반 공동 학습 서비스입니다. 사용자는 공부방에 입장해 좌석을 선택하고, 스톱워치 또는 포모도로 타이머로 공부 시간을 기록합니다. 누적된 공부 시간은 알 부화 진행도에 반영되며, 부화한 캐릭터는 도감에 등록해 대표 캐릭터로 사용할 수 있습니다.

> 팀원 대상 개발 환경 설정 및 협업 안내는 [docs/TEAM_GUIDE.md](docs/TEAM_GUIDE.md)를 참고하세요.

## 주요 기능

- 회원가입, 로그인, 로그아웃, 회원 탈퇴
- 공용 로비와 초대코드 기반 개인 공부방
- 12석 좌석 선택과 Socket.IO 기반 실시간 좌석 상태 동기화
- 개인 스톱워치 타이머와 데모용 포모도로 타이머
- 방장 전용 전체 시작/전체 종료 신호
- 공부 세션 기록, 오늘/누적 공부 시간, 최근 기록 조회
- 공부 시간 기반 알 부화와 캐릭터 랜덤 획득
- 캐릭터 도감, 획득 진행도, 대표 캐릭터 변경

## 기술 스택

- Node.js
- Express 5
- EJS
- MySQL, mysql2/promise
- express-session, connect-flash, cookie-parser, morgan
- Socket.IO
- Vanilla JavaScript, CSS

## 프로젝트 구조

```text
study-village/
├─ app.js                 # Express 앱 설정, 미들웨어, 라우터 연결
├─ bin/www                # HTTP 서버와 Socket.IO 서버 실행
├─ db/
│  ├─ connection.js       # mysql2/promise connection pool
│  └─ schema.sql          # DB, 테이블, 기본 데이터 생성 스크립트
├─ lib/
│  ├─ inviteCode.js       # 초대코드 생성
│  ├─ rng.js              # 캐릭터 가중치 랜덤 추첨
│  └─ study.js            # 공부 세션 시작/종료, 알 부화 공통 로직
├─ public/
│  ├─ css/style.css
│  ├─ js/                 # room, timer, characters 클라이언트 로직
│  └─ images/             # 캐릭터와 타일 이미지
├─ routes/                # 기능별 Express 라우터
├─ socket/socket.js       # Socket.IO 이벤트 처리
└─ views/                 # EJS 화면 템플릿
```

## 실행 준비

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사해 `.env`를 만들고, 로컬 MySQL 접속 정보에 맞게 수정합니다.

```bash
cp .env.example .env
```

Windows CMD에서는 다음 명령을 사용할 수 있습니다.

```cmd
copy .env.example .env
```

필수 값:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=여기에_본인_MySQL_비밀번호
DB_NAME=study_village
SESSION_SECRET=study-village-secret-change-me
```

`.env`는 개인 로컬 설정 파일이므로 Git에 올리지 않습니다.

### 3. 데이터베이스 초기화

MySQL 서버를 실행한 뒤 `db/schema.sql`을 실행합니다. 이 스크립트는 다음을 생성합니다.

- `study_village` 데이터베이스
- `users`, `rooms`, `study_logs`, `characters`, `user_characters`, `eggs`, `seat_occupancy` 테이블
- 기본 공용 학습방 `1번 학습방`
- 기본 캐릭터 9종

Workbench에서 `db/schema.sql`을 열어 실행하거나, MySQL CLI를 사용합니다.

```bash
mysql -u root -p < db/schema.sql
```

초기화 확인 쿼리:

```sql
USE study_village;
SHOW TABLES;
SELECT name, capacity FROM rooms;
SELECT name, rarity, drop_weight FROM characters ORDER BY id;
```

## 서버 실행

개발 모드:

```bash
npm run dev
```

일반 실행:

```bash
npm start
```

기본 주소는 다음과 같습니다.

```text
http://localhost:3000
```

## 화면과 라우트

| 경로 | 설명 |
|---|---|
| `/` | 메인 화면 |
| `/auth/register` | 회원가입 |
| `/auth/login` | 로그인 |
| `/auth/logout` | 로그아웃 |
| `/auth/withdraw` | 회원 탈퇴 |
| `/room` | 로비 또는 현재 공부방 |
| `/room/create` | 공부방 생성 |
| `/room/join` | 초대코드로 공부방 입장 |
| `/room/leave` | 개인 공부방에서 로비로 이동 |
| `/room/members` | 현재 방 인원 JSON |
| `/room/group/start` | 방장 전체 시작 신호 |
| `/room/group/end` | 방장 전체 종료 신호 |
| `/study/start` | 공부 세션 시작 API |
| `/study/end` | 공부 세션 종료 API |
| `/records` | 내 공부 기록 |
| `/characters` | 캐릭터 도감 |
| `/characters/select` | 대표 캐릭터 변경 API |

## 데이터 흐름

1. 회원가입 시 사용자 계정이 생성되고, 활성 알 1개와 N등급 시작 캐릭터 1장이 지급됩니다.
2. 사용자는 `/room`에서 좌석을 선택합니다. 좌석 점유 상태는 `seat_occupancy`에 저장되고 Socket.IO로 같은 방 사용자에게 동기화됩니다.
3. 공부를 시작하면 `study_logs`에 진행 중인 세션이 생성되고 좌석 상태가 `focusing`으로 바뀝니다.
4. 공부를 종료하면 세션 시간이 계산되어 `study_logs.duration`과 `users.total_study_seconds`에 반영됩니다.
5. 종료된 공부 시간만큼 활성 알의 진행도가 증가합니다.
6. 알이 요구 시간을 채우면 캐릭터가 가중치 기반으로 추첨되어 `user_characters`에 등록되고, 다음 알이 자동 지급됩니다.
7. 도감에서 보유한 캐릭터를 선택하면 `users.current_character_id`가 변경되고 학습방 화면에도 실시간 반영됩니다.

## 현재 데모 설정

시연 편의를 위해 일부 시간이 짧게 설정되어 있습니다.

- 알 부화 시간: 60초
- 포모도로 공부 시간: 10초
- 포모도로 휴식 시간: 5초

운영용에 가깝게 바꾸려면 다음 파일의 상수를 조정합니다.

- `routes/auth.js`: 회원가입 시 첫 알 `required_seconds`
- `lib/study.js`: 부화 후 다음 알 `required_seconds`
- `public/js/timer.js`: `POMODORO.STUDY_SECONDS`, `POMODORO.BREAK_SECONDS`

## 주의사항

- 현재 비밀번호는 Node.js `crypto`의 SHA-512 해시로 저장됩니다. 실제 서비스라면 `bcrypt` 같은 password hashing 전용 라이브러리 적용이 필요합니다.
- 세션 저장소는 기본 메모리 저장소입니다. 배포 환경에서는 Redis, DB 기반 session store 등으로 교체해야 합니다.
- DB 마이그레이션 도구는 포함되어 있지 않습니다. 스키마 변경 시 `db/schema.sql`과 기존 데이터 반영 방법을 함께 관리해야 합니다.
- 도감 부화 축하 효과는 CDN의 `canvas-confetti`를 사용하므로 오프라인 환경에서는 폭죽 효과가 표시되지 않을 수 있습니다.

## 자주 발생하는 문제

| 증상 | 원인 | 해결 |
|---|---|---|
| `ER_ACCESS_DENIED_ERROR` | MySQL 계정 또는 비밀번호 불일치 | `.env`의 `DB_USER`, `DB_PASSWORD` 확인 |
| `ER_BAD_DB_ERROR` | `study_village` DB가 없음 | `db/schema.sql` 실행 |
| `ECONNREFUSED` | MySQL 서버가 꺼져 있음 | MySQL 서비스 실행 상태 확인 |
| `EADDRINUSE` | 3000번 포트가 이미 사용 중 | 기존 서버 종료 또는 `.env`의 `PORT` 변경 |
| 좌석/타이머가 실시간 반영되지 않음 | Socket.IO 연결 실패 또는 서버 미실행 | 브라우저 콘솔과 서버 로그 확인 |

## 라이선스

`package.json` 기준 라이선스는 `ISC`입니다.

# Study Village

웹서버프로그래밍 팀 프로젝트 — 웹 기반 공동 학습 서비스.

수업의 Express + EJS + MySQL 패턴을 그대로 따릅니다.

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
├─ routes/             URL 경로별 라우터  ← 본인이 맡은 파일을 여기서 수정
├─ views/              EJS 템플릿        ← 본인이 맡은 화면을 여기서 수정
├─ public/             정적 파일 (css, js, images)
├─ db/                 connection.js (mysql2 pool) + schema.sql
├─ lib/                공용 헬퍼 (rng.js — 캐릭터 가중치 추첨/도감 등록)
└─ socket/socket.js    Socket.IO 이벤트
```

---

## 📦 처음 한 번만 하면 되는 사전 작업

순서대로 따라하세요.

### 1. Node.js 설치

[https://nodejs.org](https://nodejs.org) 에서 **LTS 버전**을 다운로드해 설치합니다. 설치 확인:

```cmd
node -v
npm -v
```

버전이 출력되면 OK.

### 2. Git 설치

[https://git-scm.com](https://git-scm.com) 에서 설치. 설치 확인:

```cmd
git --version
```

처음 설치한 사람은 본인 정보를 한 번 등록해주세요:

```cmd
git config --global user.name "본인이름"
git config --global user.email "본인깃허브이메일"
```

### 3. MySQL Community Server + Workbench 설치

[https://dev.mysql.com/downloads/installer/](https://dev.mysql.com/downloads/installer/) 에서 **MySQL Installer for Windows** 다운로드.

설치 마법사에서:
- **Setup Type**: `Developer Default` 선택 (Server + Workbench 같이 설치됨)
- **Type and Networking**: 기본값 (TCP/IP, Port 3306) 그대로
- **Authentication Method**: `Use Strong Password Encryption` 선택
- **Root Password**: 본인이 기억할 수 있는 비밀번호 설정 → 이걸 `.env`에 적게 됩니다
- **Windows Service**: 기본값(자동 시작) 그대로
- 나머지는 Next 누르며 진행

설치 확인 — PowerShell에서:

```powershell
Get-Service MySQL*
```

`Running` 상태로 보이면 OK.

### 4. 프로젝트 받기

```cmd
git clone https://github.com/Urban-Potato-717/study-village.git
cd study-village
```

### 5. 패키지 설치

```cmd
npm install
```

### 6. 환경변수 파일 만들기

```cmd
copy .env.example .env
```

`.env` 파일을 메모장이나 VSCode로 열어 **3단계에서 정한 MySQL root 비밀번호**를 채워주세요:

```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=본인_MySQL_비밀번호
DB_NAME=study_village
SESSION_SECRET=study_village_secret_key
```

> ⚠️ `.env`는 절대 GitHub에 올리지 마세요. `.gitignore`에 등록되어 있어 자동으로 제외됩니다.

### 7. MySQL에 DB/테이블 만들기

1. **MySQL Workbench** 실행
2. `Local instance MySQL` 클릭 → root 비밀번호 입력해서 접속
3. 상단 메뉴 **File > Open SQL Script…** → `db/schema.sql` 선택
4. ⚡ **번개 아이콘**(Execute) 클릭
5. 하단 Action Output에 전부 ✓(초록색) 뜨면 성공
6. 왼쪽 SCHEMAS 패널 새로고침 → `study_village` 안에 7개 테이블이 보이면 OK
   - 기존: `users`, `rooms`, `study_logs`
   - MVP 추가: `characters`, `user_characters`, `eggs`, `seat_occupancy`

확인 쿼리:

```sql
USE study_village;
SHOW TABLES;                       -- 7개
SELECT name, capacity FROM rooms;  -- "1번 학습방" / capacity 12
SELECT COUNT(*) FROM characters;   -- 5
```

위처럼 나오면 끝.

> 회원가입을 하면 첫 알 1개와 N등급 캐릭터 1장이 자동 지급됩니다. 그래서 가입 직후 바로 학습방에서 좌석 점유 → 공부 시작이 가능합니다.

### 8. 서버 실행해보기

```cmd
npm run dev
```

콘솔에 `3000번 포트에서 서버 실행 중`이 뜨면 성공. 브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

> 코드를 수정하면 nodemon이 자동으로 서버를 재시작해줍니다.

---

## 👥 담당 역할 / 작업할 파일

| 담당 | 경로 | 수정할 파일 |
|---|---|---|
| 송정한 | `/auth/login`, `/auth/register`, `/auth/logout`, `/auth/withdraw` | `routes/auth.js`, `views/login.ejs`, `views/register.ejs` |
| 임태균 | `/study/start`, `/study/end`, `/records` | `routes/study.js`, `routes/records.js`, `views/records.ejs` |
| 오유진 | `/room` 화면 + 마을 테마 | `views/room.ejs`, `public/js/room.js`, `public/css/style.css` (라우터는 김준영) |
| 김준영(팀장) | 메인 + 인프라 + `/room` 라우터 + 캐릭터/도감 | `routes/index.js`, `routes/room.js`, `routes/characters.js`, `views/characters.ejs`, `app.js`, `bin/www`, `db/*`, `socket/*`, `lib/*` |

### DB 접근 예시 (송정한·임태균·오유진 참고)

라우터에서 DB를 쓸 때는 이렇게:

```js
var pool = require('../db/connection'); // mysql2/promise pool

// SELECT
var [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

// INSERT
await pool.query('INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)',
  [username, hashed, nickname]);
```

물음표(`?`) 자리에 값을 넣는 방식만 사용하세요 — SQL Injection 방지를 위해서입니다.

### 로그인 상태 확인 (모든 라우터 공통)

세션 사용자는 `req.session.user`에 들어있어요. 뷰에서는 `currentUser`로 접근 가능.

---

## 🌿 작업 → GitHub에 올리는 방법 (매번)

### 1. 작업 시작 전 — 항상 최신 develop 가져오기

```cmd
git checkout develop
git pull origin develop
```

### 2. 본인 브랜치 만들고 이동

```cmd
:: 송정한
git checkout -b feature/auth

:: 임태균
git checkout -b feature/timer

:: 오유진
git checkout -b feature/room
```

> 이미 브랜치를 만들어둔 경우엔 `git checkout feature/auth` 처럼 `-b` 없이 이동.

### 3. 본인이 맡은 파일만 수정

위 **담당 역할** 표에 있는 파일만 건드리세요. **수정 금지 파일**은 아래 참고.

### 4. 변경사항 확인

```cmd
git status
git diff
```

- `git status`: 어떤 파일이 바뀌었는지
- `git diff`: 구체적으로 어디가 바뀌었는지

내가 수정한 파일만 보이는지 꼭 확인하세요. 다른 파일이 보이면 팀장에게 문의.

### 5. 본인이 맡은 파일만 stage

전체(`git add .`) 대신 **파일을 직접 지정**하는 게 안전해요:

```cmd
:: 예시 — 송정한
git add routes/auth.js views/login.ejs views/register.ejs
```

### 6. 커밋

```cmd
git commit -m "feat: 로그인 기능 구현"
```

커밋 메시지 규칙:
- `feat:` 새 기능 추가
- `fix:` 버그 수정
- `style:` CSS / 화면 디자인 수정
- `chore:` 그 외 자잘한 작업

### 7. GitHub에 push

```cmd
git push origin feature/auth
```

(처음 push일 때는 `git push -u origin feature/auth`로 한 번만)

### 8. GitHub에서 Pull Request 생성

1. 본인 저장소 페이지([https://github.com/Urban-Potato-717/study-village](https://github.com/Urban-Potato-717/study-village)) 들어가기
2. 노란 배너 `Compare & pull request` 클릭
3. **base 브랜치를 `develop` 으로 변경** (기본값이 main일 수 있으니 주의)
4. 제목과 설명 적고 **Create pull request**
5. 팀장(김준영)이 확인 후 develop에 merge → develop에서 정상 작동이 확인되면 별도로 main에 promote

merge가 끝나면 다시 1번부터 시작 (`git checkout develop → git pull`).

---

## 🚫 수정하면 안 되는 공통 파일 (팀장 관리)

아래 파일은 절대 직접 수정하지 마세요. 변경이 필요하면 **카톡으로 팀장에게 요청**:

`app.js`, `bin/www`, `package.json`, `package-lock.json`, `db/schema.sql`, `db/connection.js`, `socket/socket.js`, `lib/*`, `routes/characters.js`, `views/characters.ejs`, `.env.example`, `.gitignore`, `README.md`

---

## ❗ 에러 대처

에러가 나면 다음 정보를 팀장에게 공유해주세요.

1. 무엇을 하다가 발생했는지 (URL, 클릭한 버튼 등)
2. 콘솔에 찍힌 에러 메시지 전체 (스크린샷도 좋음)
3. 브라우저 개발자 도구의 Network 탭에서 실패한 요청

### 자주 나오는 에러

| 에러 메시지 | 원인 | 해결 |
|---|---|---|
| `ER_ACCESS_DENIED_ERROR` | `.env`의 MySQL 비밀번호 틀림 | `.env` 다시 확인 |
| `ECONNREFUSED` | MySQL 서비스가 안 켜져 있음 | `Get-Service MySQL*` 확인, 꺼져있으면 `Start-Service MySQL80` |
| `ER_BAD_DB_ERROR` | `study_village` DB가 없음 | Workbench에서 `db/schema.sql` 다시 실행 |
| `Duplicate column name 'current_character_id'` | `db/schema.sql` 재실행 시 `ALTER TABLE users` 가 두 번째로 실행됨 | 해당 ALTER 두 줄만 주석 처리하고 나머지 다시 실행 |
| `EADDRINUSE` | 3000번 포트가 이미 사용 중 | 다른 npm 서버가 켜져있는지 확인 후 종료 |
| push할 때 `rejected` | 원격에 새 커밋이 있음 | `git pull origin develop --no-rebase` 후 다시 push |

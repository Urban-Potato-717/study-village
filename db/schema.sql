-- db/schema.sql
-- 수업 12주차 7.3: 데이터베이스, 테이블 생성하기
-- MySQL Workbench에서 이 파일을 열어 Execute 버튼으로 실행하세요.
-- 다시 실행해도 안전합니다 (IF NOT EXISTS / 중복 INSERT 방지).

-- ─── 데이터베이스 생성 ────────────────────────────────────
-- utf8mb4: 한글 + 이모지까지 저장 가능한 문자셋
-- utf8mb4_unicode_ci: 대소문자 구분 없이 비교(정렬)
CREATE DATABASE IF NOT EXISTS study_village
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE study_village;

-- ─── 사용자 테이블 (송정한 담당, MVP 컬럼 확장은 김준영) ─────
-- 수업: id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY(id)
-- MVP 확장 컬럼:
--   current_character_id : 현재 선택한 캐릭터 (도감에서 변경 — 미구현)
--   total_study_seconds  : 누적 공부 시간 (초)
CREATE TABLE IF NOT EXISTS users (
  id                   INT          NOT NULL AUTO_INCREMENT,
  username             VARCHAR(20)  NOT NULL UNIQUE,                 -- 로그인 아이디 (중복 불가)
  password             VARCHAR(200) NOT NULL,                        -- 해시된 비밀번호
  nickname             VARCHAR(20)  NOT NULL,
  current_character_id INT          NULL,                            -- MVP: 도감에서 선택한 캐릭터
  total_study_seconds  INT          NOT NULL DEFAULT 0,               -- MVP: 누적 공부 시간(초)
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 가입 시각 자동 기록
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '사용자 정보';

-- ─── 학습방 테이블 (김준영 담당) ─────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id         INT         NOT NULL AUTO_INCREMENT,
  name       VARCHAR(50) NOT NULL,
  capacity   INT         NOT NULL DEFAULT 6,               -- 좌석 수 (기본 6석)
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '학습방';

-- ─── 공부 기록 테이블 (임태균 담당) ──────────────────────
-- 수업 12주차 슬라이드 33: FOREIGN KEY (컬럼명) REFERENCES 테이블명 (컬럼)
-- ON DELETE CASCADE — 부모 행(users/rooms)이 삭제되면 이 행도 함께 삭제됨
CREATE TABLE IF NOT EXISTS study_logs (
  id         INT      NOT NULL AUTO_INCREMENT,
  user_id    INT      NOT NULL,                            -- FK → users.id
  room_id    INT      NOT NULL,                            -- FK → rooms.id
  start_time DATETIME NOT NULL,                            -- 공부 시작 시각
  end_time   DATETIME,                                     -- 공부 종료 시각 (진행 중이면 NULL)
  duration   INT,                                          -- 공부 시간 (초 단위)
  PRIMARY KEY (id),
  CONSTRAINT fk_study_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_study_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '공부 기록';

-- ─── 기본 학습방 1개 삽입 ─────────────────────────
-- WHERE NOT EXISTS: schema.sql을 다시 실행해도 중복 행이 생기지 않도록 함
INSERT INTO rooms (name, capacity)
SELECT '1번 학습방', 12
WHERE NOT EXISTS (
  SELECT 1 FROM rooms WHERE name = '1번 학습방'
);

-- MVP에서 좌석 수를 12석으로 늘림 (기존에 6석으로 만들어진 행이 있어도 12로 갱신)
UPDATE rooms SET capacity = 12 WHERE name = '1번 학습방' AND capacity <> 12;

-- ===========================================================
-- MVP 확장: 캐릭터 / 도감 / 알 / 좌석 점유 영속화 (김준영 담당)
-- ===========================================================

-- ─── 캐릭터 마스터 (도감 전체 목록) ─────────────────────
-- emoji: PNG 에셋 준비 전에는 이모지로 폴백 렌더
-- rarity: N(노멀) / R(레어) / SR(슈퍼레어)
-- drop_weight: 가중치 랜덤 추첨에 사용 (값이 클수록 자주 등장)
CREATE TABLE IF NOT EXISTS characters (
  id          INT          NOT NULL AUTO_INCREMENT,
  name        VARCHAR(30)  NOT NULL,
  image_path  VARCHAR(200) NOT NULL DEFAULT '',
  emoji       VARCHAR(10)  NOT NULL DEFAULT '',
  rarity      ENUM('N','R','SR') NOT NULL DEFAULT 'N',
  drop_weight INT          NOT NULL DEFAULT 100,
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '캐릭터 마스터';

-- ─── 사용자 도감 (획득한 캐릭터) ─────────────────────
-- (user_id, character_id) 복합 PK 로 같은 캐릭터 중복 획득 방지
CREATE TABLE IF NOT EXISTS user_characters (
  user_id      INT      NOT NULL,
  character_id INT      NOT NULL,
  obtained_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, character_id),
  CONSTRAINT fk_uc_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_uc_character
    FOREIGN KEY (character_id) REFERENCES characters (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '사용자 도감';

-- ─── 알 (부화 대상) ─────────────────────────────────
-- 사용자당 is_active=TRUE 인 알은 1개만 존재한다는 약속을 라우터에서 지킴
-- progress_seconds 가 required_seconds 에 도달하면 부화
CREATE TABLE IF NOT EXISTS eggs (
  id               INT      NOT NULL AUTO_INCREMENT,
  user_id          INT      NOT NULL,
  required_seconds INT      NOT NULL DEFAULT 60,   -- demo version time, 60sec
  progress_seconds INT      NOT NULL DEFAULT 0,
  is_active        BOOLEAN  NOT NULL DEFAULT TRUE,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hatched_at       DATETIME NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_egg_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '알 (부화 진행도)';

-- ─── 좌석 점유 영속화 ─────────────────────────────────
-- 새로고침에도 좌석 상태가 유지되도록 DB에 저장
-- UNIQUE (user_id): 한 사용자는 한 번에 한 자리만 점유 가능
CREATE TABLE IF NOT EXISTS seat_occupancy (
  room_id     INT      NOT NULL,
  seat_number INT      NOT NULL,
  user_id     INT      NOT NULL,
  status      ENUM('waiting','focusing','resting','away') NOT NULL DEFAULT 'waiting',
  occupied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, seat_number),
  UNIQUE KEY uk_user_seat (user_id),
  CONSTRAINT fk_seat_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_seat_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '좌석 점유 상태';

-- ─── users 컬럼 확장 (마이그레이션용) ──────────────────────
-- 새 DB에는 위 CREATE TABLE users 가 이미 두 컬럼을 포함하고 있으므로 불필요.
-- 단, MVP 이전에 만들어진 기존 users 테이블에 컬럼이 없는 경우에만
-- 아래 두 줄의 주석을 해제하여 1회 실행할 것.
-- ALTER TABLE users
--  ADD COLUMN current_character_id INT NULL,
--  ADD COLUMN total_study_seconds  INT NOT NULL DEFAULT 0;

-- ─── 캐릭터 시드 5종 ─────────────────────
-- WHERE NOT EXISTS 로 멱등성 확보
-- image_path 는 추후 PNG 에셋이 준비되면 사용
INSERT INTO characters (name, image_path, emoji, rarity, drop_weight)
SELECT '뿡뿡이', '/images/characters/c1.png', '', 'N', 100
WHERE NOT EXISTS (SELECT 1 FROM characters WHERE name = '뿡뿡이');

INSERT INTO characters (name, image_path, emoji, rarity, drop_weight)
SELECT '펭이', '/images/characters/c2.png', '', 'N', 100
WHERE NOT EXISTS (SELECT 1 FROM characters WHERE name = '펭이');

INSERT INTO characters (name, image_path, emoji, rarity, drop_weight)
SELECT '여우공주', '/images/characters/c3.png', '', 'R', 40
WHERE NOT EXISTS (SELECT 1 FROM characters WHERE name = '여우공주');

INSERT INTO characters (name, image_path, emoji, rarity, drop_weight)
SELECT '곰돌이', '/images/characters/c4.png', '', 'R', 40
WHERE NOT EXISTS (SELECT 1 FROM characters WHERE name = '곰돌이');

INSERT INTO characters (name, image_path, emoji, rarity, drop_weight)
SELECT '황금용', '/images/characters/c5.png', '', 'SR', 20
WHERE NOT EXISTS (SELECT 1 FROM characters WHERE name = '황금용');

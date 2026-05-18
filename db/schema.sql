-- db/schema.sql
-- 수업 12주차 7.3: 데이터베이스, 테이블 생성하기
-- MySQL Workbench에서 이 파일을 열어 ⚡(Execute) 버튼으로 실행하세요.
-- 다시 실행해도 안전합니다 (IF NOT EXISTS / 중복 INSERT 방지).

-- ─── 데이터베이스 생성 ────────────────────────────────────
-- utf8mb4: 한글 + 이모지까지 저장 가능한 문자셋
-- utf8mb4_unicode_ci: 대소문자 구분 없이 비교(정렬)
CREATE DATABASE IF NOT EXISTS study_village
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE study_village;

-- ─── 사용자 테이블 (송정한 담당) ─────────────────────────
-- 수업: id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY(id)
CREATE TABLE IF NOT EXISTS users (
  id         INT          NOT NULL AUTO_INCREMENT,
  username   VARCHAR(20)  NOT NULL UNIQUE,                 -- 로그인 아이디 (중복 불가)
  password   VARCHAR(200) NOT NULL,                        -- 해시된 비밀번호
  nickname   VARCHAR(20)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 가입 시각 자동 기록
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
SELECT '1번 학습방', 6
WHERE NOT EXISTS (
  SELECT 1 FROM rooms WHERE name = '1번 학습방'
);

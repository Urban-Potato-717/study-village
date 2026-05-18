-- db/schema.sql
-- 수업 12주차 7.3: 데이터베이스, 테이블 생성하기
-- MySQL Workbench에서 이 파일을 열어 실행하세요.

CREATE DATABASE IF NOT EXISTS study_village DEFAULT CHARSET = utf8mb4;
USE study_village;

-- ─── 사용자 테이블 (송정한 담당) ─────────────────────────
-- 수업: id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY(id)
CREATE TABLE IF NOT EXISTS users (
  id         INT          NOT NULL AUTO_INCREMENT,
  username   VARCHAR(20)  NOT NULL UNIQUE,           -- 로그인 아이디
  password   VARCHAR(200) NOT NULL,                  -- 해시된 비밀번호
  nickname   VARCHAR(20)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT now(),    -- 수업: DEFAULT now()
  PRIMARY KEY(id)
) COMMENT = '사용자 정보' DEFAULT CHARSET = utf8mb4 ENGINE = InnoDB;

-- ─── 학습방 테이블 (김준영 담당) ─────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id         INT         NOT NULL AUTO_INCREMENT,
  name       VARCHAR(50) NOT NULL,
  capacity   INT         NOT NULL DEFAULT 6,
  created_at DATETIME    NOT NULL DEFAULT now(),
  PRIMARY KEY(id)
) COMMENT = '학습방' DEFAULT CHARSET = utf8mb4 ENGINE = InnoDB;

-- ─── 공부 기록 테이블 (임태균 담당) ──────────────────────
-- 수업 12주차 슬라이드 33: FOREIGN KEY (컬럼명) REFERENCES 테이블명 (컬럼)
-- 수업: ON DELETE CASCADE — users 행이 삭제되면 study_logs도 함께 삭제
CREATE TABLE IF NOT EXISTS study_logs (
  id         INT      NOT NULL AUTO_INCREMENT,
  user_id    INT      NOT NULL,                       -- FK: users.id
  room_id    INT      NOT NULL,                       -- FK: rooms.id
  start_time DATETIME NOT NULL,
  end_time   DATETIME,
  duration   INT,                                     -- 공부 시간(초)
  PRIMARY KEY(id),
  CONSTRAINT fk_study_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_study_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) COMMENT = '공부 기록' DEFAULT CHARSET = utf8mb4 ENGINE = InnoDB;

-- ─── 기본 학습방 1개 삽입 ─────────────────────────
INSERT INTO rooms (name, capacity) VALUES ('1번 학습방', 6);

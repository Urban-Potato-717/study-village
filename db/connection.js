// db/connection.js
// 수업 12주차 7장: Node.js에서 mysql2 패키지로 DB 연결
// mysql2/promise 기반 connection pool 사용

var mysql = require('mysql2/promise');

// connection pool 생성
// pool을 사용하면 연결을 재사용할 수 있어 효율적
var pool = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

// 사용 예시 (라우터에서):
//   var pool = require('../db/connection');
//   var [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [name]);

module.exports = pool;

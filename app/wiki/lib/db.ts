// File: app/wiki/lib/db.ts

/**
 * MariaDB(MySQL) 연결 모듈
 * - DB 접속 정보는 환경변수로 관리
 */

import mysql from 'mysql2/promise';

// DB 연결 풀 생성
export const db = mysql.createPool({
  host: process.env.DB_HOST!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10, // 동시 커넥션 제한
});

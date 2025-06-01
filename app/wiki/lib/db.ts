// File: app/wiki/lib/db.ts

/**
 * MariaDB(MySQL) 연결 모듈
 * - DB 접속 정보는 환경변수로 관리
 */

// DB 연결 풀 생성

import mysql from 'mysql2/promise';
export const db = mysql.createPool(process.env.DATABASE_URL!);
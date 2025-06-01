import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const ca = fs.readFileSync(path.join(process.cwd(), 'app', 'wiki', 'lib', 'isrgrootx1.pem'))

export const db = mysql.createPool({
  host: process.env.DB_HOST!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  ssl: {
    ca: ca.toString(),
    rejectUnauthorized: true,
  },
});

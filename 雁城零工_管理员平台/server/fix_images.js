const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'yancheng_lingong',
  waitForConnections: true,
  connectionLimit: 5
});

const OLD_BASE = 'http://192.168.200.103:3000';

async function main() {
  // convenience_posts.images
  const [rows] = await pool.query(
    `SELECT id, images FROM convenience_posts WHERE images LIKE ?`,
    [`%${OLD_BASE}%`]
  );
  console.log(`[convenience_posts] 找到 ${rows.length} 条含旧IP记录`);
  for (const row of rows) {
    const oldVal = row.images;
    let newVal = oldVal;
    try {
      const arr = JSON.parse(oldVal);
      if (Array.isArray(arr)) {
        newVal = JSON.stringify(arr.map(u => u.replace(OLD_BASE, '')));
      }
    } catch {
      newVal = oldVal.replaceAll(OLD_BASE, '');
    }
    await pool.query(`UPDATE convenience_posts SET images = ? WHERE id = ?`, [newVal, row.id]);
    console.log(`  id=${row.id}: ${oldVal} -> ${newVal}`);
  }

  // wx_users.avatar_url
  const [userRows] = await pool.query(
    `SELECT id, avatar_url FROM wx_users WHERE avatar_url LIKE ?`,
    [`%${OLD_BASE}%`]
  );
  console.log(`[wx_users.avatar_url] 找到 ${userRows.length} 条`);
  for (const row of userRows) {
    const newUrl = row.avatar_url.replace(OLD_BASE, '');
    await pool.query(`UPDATE wx_users SET avatar_url = ? WHERE id = ?`, [newUrl, row.id]);
    console.log(`  id=${row.id}: ${row.avatar_url} -> ${newUrl}`);
  }

  await pool.end();
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });

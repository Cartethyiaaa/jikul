import { neon } from '@neondatabase/serverless';

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

let sql = null;
if (connectionString) {
  try {
    sql = neon(connectionString);
  } catch (err) {
    console.error('Neon client initialization error:', err);
  }
}

// In-memory fallback if database not configured yet
export const memoryStore = {
  messages: [
    { id: 1, name: "Yasha", role: "Ketua Circle", tag: "Ramen & Jajan", time: "12 Mar 2026, 20:15", content: "Circle ter-gokil seumur hidup! Niat awal bikin klub bahasa Jepang biar pinter, ujung-ujungnya malah hafal seluruh menu kedai ramen se-kota." },
    { id: 2, name: "Alex", role: "Wakil Ketua", tag: "Nostalgia", time: "10 Mar 2026, 18:40", content: "Gak bakal lupa momen motoran malam-malam kehujanan cuma buat nyari kuah tonkotsu pedas. Solid terus buat Japanese Culinary!" },
    { id: 3, name: "Ilma", role: "Bendahara Circle", tag: "Kocak", time: "08 Mar 2026, 21:05", content: "Sebagai bendahara, tugas terberatku bukan ngitung uang kas, tapi nagih split bill ramen kalian yang selalu pura-pura lupa kembalian wkwk." },
    { id: 4, name: "Mail", role: "Ketua Divisi", tag: "Terima Kasih", time: "05 Mar 2026, 19:22", content: "Makasih udah jadi tempat pulang paling nyaman. Walaupun kita sering gabut, kebersamaan sama kalian adalah kenangan terindah." },
    { id: 5, name: "Sigit", role: "Ketua Nikuma", tag: "Ramen & Jajan", time: "01 Mar 2026, 22:10", content: "Siapapun yang nemu kedai ramen baru, wajib drop titik maps di grup! Jangan makan sendirian tanpa ngajak squad!" }
  ],
  users: [
    { email: "jikul@jc.co.id", username: "jikul", password_hash: "japaneseculinary", name: "Member Circle", role: "circle_member" },
    { email: "jculinary@gmail.com", username: "jculinary", password_hash: "japaneseculinary", name: "Circle Admin", role: "circle_member" },
    { email: "jculinary06@gmail.com", username: "jculinary06", password_hash: "japaneseculinary", name: "Circle Lead", role: "circle_member" }
  ]
};

let dbInitialized = false;

export async function getDb() {
  if (!sql) return null;

  if (!dbInitialized) {
    try {
      // 1. Messages table
      await sql`
        CREATE TABLE IF NOT EXISTS messages (
          id BIGSERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          role VARCHAR(100) NOT NULL,
          tag VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          time_str VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // 2. Users table
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(100),
          role VARCHAR(50) DEFAULT 'circle_member',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // Seed default circle user
      await sql`
        INSERT INTO users (email, username, password_hash, name, role)
        VALUES ('jikul@jc.co.id', 'jikul', 'japaneseculinary', 'Member Circle', 'circle_member')
        ON CONFLICT (email) DO NOTHING;
      `;

      // Seed initial messages if empty
      const countRes = await sql`SELECT count(*) as count FROM messages;`;
      const count = Number(countRes[0]?.count || 0);
      if (count === 0) {
        for (const m of memoryStore.messages) {
          await sql`
            INSERT INTO messages (name, role, tag, content, time_str)
            VALUES (${m.name}, ${m.role}, ${m.tag}, ${m.content}, ${m.time});
          `;
        }
      }

      dbInitialized = true;
    } catch (e) {
      console.error('Database auto-initialization error:', e);
    }
  }

  return sql;
}

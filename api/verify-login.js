import { SignJWT } from 'jose';
import { serialize } from 'cookie';
import { getDb, memoryStore } from './db.js';

const ALLOWED_PASS = process.env.ALLOWED_PASS || 'japaneseculinary';
const SESSION_SECRET = process.env.SESSION_SECRET || 'default_super_secret_circle_japanese_culinary_key_2026';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }
    const { username, password } = body || {};

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username dan password wajib diisi.' 
      });
    }

    const inputUser = String(username).toLowerCase().trim();
    const inputPass = String(password);

    let userFound = null;

    // 1. Check Database if available
    const db = await getDb();
    if (db) {
      try {
        const rows = await db`
          SELECT id, email, username, password_hash, name, role
          FROM users
          WHERE LOWER(email) = ${inputUser} OR LOWER(username) = ${inputUser}
          LIMIT 1;
        `;
        if (rows.length > 0) {
          const u = rows[0];
          if (u.password_hash === inputPass) {
            userFound = {
              email: u.email,
              username: u.username,
              name: u.name || 'Member Circle',
              role: u.role || 'circle_member'
            };
          }
        }
      } catch (err) {
        console.error('Database query error during login:', err);
      }
    }

    // 2. Fallback check memoryStore and environment defaults
    if (!userFound) {
      const allowedUsers = [
        (process.env.ALLOWED_USER || 'jikul@jc.co.id').toLowerCase().trim(),
        (process.env.ALLOWED_EMAIL || '').toLowerCase().trim(),
        'jikul@jc.co.id',
        'jikul',
        'jculinary',
        'jculinary@gmail.com',
        'jculinary06@gmail.com'
      ].filter(Boolean);

      const memUser = memoryStore.users.find(
        u => (u.email.toLowerCase() === inputUser || u.username.toLowerCase() === inputUser) && u.password_hash === inputPass
      );

      if (memUser) {
        userFound = {
          email: memUser.email,
          username: memUser.username,
          name: memUser.name,
          role: memUser.role
        };
      } else if (allowedUsers.includes(inputUser) && inputPass === ALLOWED_PASS) {
        userFound = {
          email: inputUser.includes('@') ? inputUser : `${inputUser}@jc.co.id`,
          username: inputUser,
          name: 'Member Circle',
          role: 'circle_member'
        };
      }
    }

    if (!userFound) {
      return res.status(401).json({
        success: false,
        message: 'Username atau password salah.'
      });
    }

    // Sign JWT Session Token
    const secretKey = new TextEncoder().encode(SESSION_SECRET);
    const sessionToken = await new SignJWT({
      email: userFound.email,
      username: userFound.username,
      name: userFound.name,
      picture: 'mascot-cutout.png',
      role: userFound.role
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secretKey);

    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    const cookieSerialized = serialize('session_token', sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    res.setHeader('Set-Cookie', cookieSerialized);

    return res.status(200).json({
      success: true,
      message: 'Login berhasil!',
      user: {
        email: userFound.email,
        username: userFound.username,
        name: userFound.name,
        picture: 'mascot-cutout.png'
      }
    });

  } catch (error) {
    console.error('Login Verification Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat memproses login.'
    });
  }
}

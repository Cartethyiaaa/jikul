import { SignJWT } from 'jose';
import { serialize } from 'cookie';
import { getDb, memoryStore } from './db.js';

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

    const { name, username, email, password } = body || {};

    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nama, username, email, dan password wajib diisi.'
      });
    }

    const cleanUser = String(username).toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '');
    const cleanEmail = String(email).toLowerCase().trim();
    const cleanPass = String(password);
    const cleanName = String(name || cleanUser).trim().slice(0, 100);

    if (cleanUser.length < 3) {
      return res.status(400).json({ success: false, message: 'Username minimal 3 karakter alfanumerik.' });
    }
    if (cleanPass.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
    }

    const db = await getDb();
    if (db) {
      const existing = await db`
        SELECT id FROM users
        WHERE LOWER(username) = ${cleanUser} OR LOWER(email) = ${cleanEmail}
        LIMIT 1;
      `;
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Username atau email sudah terdaftar. Silakan langsung login.'
        });
      }

      await db`
        INSERT INTO users (name, username, email, password_hash, role)
        VALUES (${cleanName}, ${cleanUser}, ${cleanEmail}, ${cleanPass}, 'circle_member');
      `;
    } else {
      const exists = memoryStore.users.some(
        u => u.username.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanEmail
      );
      if (exists) {
        return res.status(409).json({
          success: false,
          message: 'Username atau email sudah terdaftar.'
        });
      }
      memoryStore.users.push({
        name: cleanName,
        username: cleanUser,
        email: cleanEmail,
        password_hash: cleanPass,
        role: 'circle_member'
      });
    }

    // Set JWT Session Cookie
    const secretKey = new TextEncoder().encode(SESSION_SECRET);
    const sessionToken = await new SignJWT({
      email: cleanEmail,
      username: cleanUser,
      name: cleanName,
      picture: 'mascot-cutout.png',
      role: 'circle_member'
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

    return res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil! Selamat datang di circle.',
      user: {
        email: cleanEmail,
        username: cleanUser,
        name: cleanName,
        picture: 'mascot-cutout.png'
      }
    });
  } catch (error) {
    console.error('Register API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat mendaftarkan akun.'
    });
  }
}

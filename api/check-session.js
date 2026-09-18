import { jwtVerify } from 'jose';
import { parse } from 'cookie';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default_super_secret_circle_japanese_culinary_key_2026';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const cookies = parse(req.headers.cookie || '');
    const token = cookies.session_token;

    if (!token) {
      return res.status(200).json({ authenticated: false });
    }

    const secretKey = new TextEncoder().encode(SESSION_SECRET);
    const { payload } = await jwtVerify(token, secretKey);

    return res.status(200).json({
      authenticated: true,
      user: {
        email: payload.email,
        username: payload.username || payload.email,
        name: payload.name || 'Member Circle',
        picture: payload.picture || 'mascot-cutout.png',
        role: payload.role || 'circle_member'
      }
    });
  } catch (error) {
    return res.status(200).json({ authenticated: false });
  }
}

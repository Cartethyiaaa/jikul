import { jwtVerify } from 'jose';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default_super_secret_circle_japanese_culinary_key_2026';

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard.html',
    '/admin/:path*',
    '/protected/:path*'
  ]
};

export default async function middleware(req) {
  const token = req.cookies.get('session_token')?.value;

  if (!token) {
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('auth', 'required');
    return Response.redirect(redirectUrl, 302);
  }

  try {
    const secretKey = new TextEncoder().encode(SESSION_SECRET);
    const { payload } = await jwtVerify(token, secretKey);

    if (!payload.email) {
      const redirectUrl = new URL('/', req.url);
      redirectUrl.searchParams.set('auth', 'denied');
      return Response.redirect(redirectUrl, 302);
    }

    return;
  } catch (err) {
    console.error('Middleware JWT verification error:', err.message);
    const redirectUrl = new URL('/', req.url);
    redirectUrl.searchParams.set('auth', 'invalid');
    return Response.redirect(redirectUrl, 302);
  }
}

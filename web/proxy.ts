import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];
const DEV_REDIRECT_HOSTS = new Set(['10.251.251.120']);

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === 'development' && DEV_REDIRECT_HOSTS.has(request.nextUrl.hostname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = 'localhost';
    return NextResponse.redirect(redirectUrl);
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  const token = request.cookies.get('__session')?.value || request.cookies.get('firebaseToken')?.value;

  if (!isPublic && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (isPublic && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|images|logo\\.png).*)'],
};

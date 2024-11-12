// scorelect-frontend/middleware.js

import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';

  // Check if the request is for /sitemap.xml
  if (pathname === '/sitemap.xml') {
    // Optionally, you can further check for Googlebot user-agent
    if (/Googlebot/.test(userAgent)) {
      // Allow the request to proceed without interruption
      return NextResponse.next();
    }
    // If you want to allow all user-agents to access sitemap.xml, comment out the above condition
    return NextResponse.next();
  }

  // For all other requests, proceed as normal
  return NextResponse.next();
}

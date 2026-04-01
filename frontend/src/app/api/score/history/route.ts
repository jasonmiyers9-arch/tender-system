import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([
    { date: '2026-03-20', score: 70 },
    { date: '2026-03-21', score: 72 },
    { date: '2026-03-22', score: 74 },
    { date: '2026-03-23', score: 76 },
  ]);
}

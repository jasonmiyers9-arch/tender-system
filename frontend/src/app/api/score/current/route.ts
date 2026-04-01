import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    score: 76,
    band: 'partially-ready',
    completedDocuments: 5,
    totalDocuments: 8,
    missingDocuments: ['B-BBEE certificate', 'Tax compliance proof'],
    expiringDocuments: ['Annual financial statement'],
    lastCalculated: new Date().toISOString(),
  });
}

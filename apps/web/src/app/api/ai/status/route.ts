import { NextResponse } from 'next/server';

export async function GET() {
  // Check if Anthropic API key is configured
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log('ANTHROPIC_API_KEY check:', apiKey ? `${apiKey.slice(0,10)}...` : 'NOT SET');
  const hasApiKey = !!apiKey;

  if (!hasApiKey) {
    return NextResponse.json({
      status: 'offline',
      reason: 'ANTHROPIC_API_KEY not configured'
    });
  }

  // Optionally verify the API key works
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }]
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      return NextResponse.json({
        status: 'online',
        provider: 'anthropic',
        model: 'claude-3-haiku'
      });
    }

    return NextResponse.json({
      status: 'offline',
      reason: 'API key invalid or quota exceeded'
    });
  } catch {
    return NextResponse.json({
      status: 'offline',
      reason: 'Could not reach Anthropic API'
    });
  }
}

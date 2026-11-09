// Invoked by the provided systemd timer. Never logs credentials or report contents.
const origin = process.env.KR_APP_ORIGIN;
const secret = process.env.KR_SCHEDULER_SECRET;
if (!origin || !secret || secret.length < 32) throw new Error('Configure KR_APP_ORIGIN and KR_SCHEDULER_SECRET');
const url = new URL('/api/financials/kr/scheduled', origin);
if (url.protocol !== 'https:' && !['127.0.0.1','localhost'].includes(url.hostname)) throw new Error('HTTPS required');
const response = await fetch(url, { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(55000) });
console.log(`KR scheduler HTTP ${response.status}`);
if (!response.ok) process.exitCode = 1;

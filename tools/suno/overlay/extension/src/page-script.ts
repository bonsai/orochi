/**
 * Page script — injected into the MAIN world of suno.com.
 * Only responsibility: provide JWT tokens from window.Clerk.
 */

import type { BridgeResponse } from './protocol';
import { CONTENT_TO_PAGE, PAGE_TO_CONTENT } from './protocol';

/** Read a cookie by name */
function readCookie(name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Clerk session JWT from cookies. Current suno.com no longer exposes
 * window.Clerk, but the __session cookie still holds the token that the
 * app sends as `Authorization: Bearer <token>`. Clerk may split the cookie
 * into chunks (`__session`, `__session_0`, ...).
 */
function cookieToken(): string | null {
  const single = readCookie('__session');
  if (single) return single;
  const parts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const p = readCookie('__session_' + i);
    if (!p) break;
    parts.push(p);
  }
  return parts.length ? parts.join('') : null;
}

/** Get a fresh JWT: legacy Clerk global first, then the __session cookie */
async function getToken(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const clerk = (window as any).Clerk;
    if (clerk?.session) {
      try {
        const token = await clerk.session.getToken();
        if (token) return token;
      } catch { /* fall through to cookie */ }
    }
    const cookie = cookieToken();
    if (cookie) return cookie;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('No Suno auth token — log in at suno.com (__session cookie not found)');
}

/**
 * Suno の生成 captcha は Cloudflare Turnstile（sitekey は本体バンドルに埋め込み）。
 * ページには常設 widget が無いため、同じ sitekey / オプションで自前 render して execute する。
 * 参考: suno.com の chunk 3sk525-8t_hsm.js
 *   turnstile.render(sel, { sitekey, execution:'execute', appearance:'interaction-only', ... })
 */
const TURNSTILE_SITE_KEY_GEN = '0x4AAAAAADI7xDNyj-3LcIbi';

/** Ensure window.turnstile is loaded (Suno loads it lazily). */
function loadTurnstile(): Promise<any> {
  const existing = (window as any).turnstile;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const deadline = Date.now() + 10_000;
    const tick = () => {
      const ts = (window as any).turnstile;
      if (ts) return resolve(ts);
      if (Date.now() > deadline) return resolve(null);
      setTimeout(tick, 250);
    };
    if (!document.getElementById('cf-turnstile-script')) {
      const s = document.createElement('script');
      s.id = 'cf-turnstile-script';
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = tick;
      document.head.appendChild(s);
    }
    tick();
  });
}

async function turnstileToken(): Promise<string | null> {
  const ts = await loadTurnstile();
  if (!ts) {
    console.warn('[Suno Bridge] Turnstile script not available');
    return null;
  }
  return new Promise<string | null>((resolve) => {
    const uid = 'orochi-ts-' + Math.random().toString(36).slice(2);
    const el = document.createElement('div');
    el.id = uid;
    // Turnstile needs a visible, laid-out container; display:none / off-screen breaks it.
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;width:300px;height:65px;z-index:2147483647;background:#fff;';
    document.body.appendChild(el);
    let done = false;
    let widgetId: string | undefined;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      try { if (widgetId) ts.remove(widgetId); } catch { /* ignore */ }
      el.remove();
      resolve(v);
    };
    try {
      widgetId = ts.render('#' + uid, {
        sitekey: TURNSTILE_SITE_KEY_GEN,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (token: string) => finish(token),
        'error-callback': (code: unknown) => { console.warn('[Suno Bridge] Turnstile error-callback:', code); finish(null); },
        'expired-callback': () => finish(null),
        'timeout-callback': () => { console.warn('[Suno Bridge] Turnstile timeout-callback'); finish(null); },
      });
      console.log('[Suno Bridge] Turnstile rendered, widgetId=', widgetId);
      const r = ts.execute(widgetId);
      if (r && typeof r.then === 'function') r.then((t: string) => finish(t || null)).catch((e: unknown) => { console.warn('[Suno Bridge] Turnstile execute rejected:', e); finish(null); });
    } catch (err) {
      console.error('[Suno Bridge] Turnstile render/execute failed:', err);
      finish(null);
    }
    setTimeout(() => finish(null), 60_000);
  });
}

/** Get a captcha token for generation (Turnstile first, hCaptcha legacy fallback) */
async function getCaptchaToken(): Promise<string | null> {
  // 1) Cloudflare Turnstile
  const existing = (window as any).turnstile?.getResponse?.();
  if (existing) {
    console.log('[Suno Bridge] Got existing Turnstile token');
    return existing;
  }
  const token = await turnstileToken();
  if (token) {
    console.log('[Suno Bridge] Got Turnstile token');
    return token;
  }
  console.log('[Suno Bridge] Turnstile token unavailable');

  // 2) hCaptcha (旧方式)
  const hcaptcha = (window as any).hcaptcha;
  if (!hcaptcha) return null;
  try {
    const resp = await hcaptcha.execute({ async: true });
    return resp.response || resp;
  } catch (err: any) {
    console.error('[Suno Bridge] hCaptcha execution failed:', err);
    return null;
  }
}

// Listen for messages from the content script
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== CONTENT_TO_PAGE) return;

  const { id, method } = event.data.payload;
  let response: BridgeResponse;

  if (method === 'get_token') {
    try {
      const token = await getToken();
      response = { id, result: { status: 200, data: { token } } };
    } catch (err: any) {
      response = { id, error: { code: -1, message: err.message } };
    }
  } else if (method === 'get_captcha') {
    try {
      const captchaToken = await getCaptchaToken();
      response = { id, result: { status: 200, data: { captchaToken } } };
    } catch (err: any) {
      response = { id, error: { code: -1, message: err.message } };
    }
  } else if (method === 'probe_captcha') {
    try {
      const ts = await loadTurnstile();
      if (!ts) {
        response = { id, result: { status: 200, data: { turnstile: false } } };
      } else {
        const token = await turnstileToken();
        response = { id, result: { status: 200, data: { turnstile: true, token: token ?? null } } };
      }
    } catch (err: any) {
      response = { id, error: { code: -1, message: err?.message ?? String(err) } };
    }
  } else if (method === 'get_status') {
    const clerk = (window as any).Clerk;
    const token = cookieToken();
    response = {
      id,
      result: {
        status: 200,
        data: {
          loggedIn: !!clerk?.session || !!token,
          hasCookieToken: !!token,
          userId: clerk?.user?.id,
          url: window.location.href,
        },
      },
    };
  } else {
    return;
  }

  window.postMessage({ source: PAGE_TO_CONTENT, payload: response }, '*');
});

// Signal ready
window.postMessage(
  { source: PAGE_TO_CONTENT, payload: { type: 'connected', data: { pageScript: true } } },
  '*'
);

console.log('[Suno Bridge] Page script loaded');

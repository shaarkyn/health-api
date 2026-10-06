// "Sign in with Google" and "Sign in with Apple" buttons, drawn the way Google's and Apple's
// branding guidelines ask: the official marks, the official wording, brand colours that switch
// with the theme (Google: white or #131314 with the G on white; Apple: black on light, white on
// dark), and both buttons the same size so neither is less prominent.
// The colours are fixed by Google and Apple, so they live here and not in the theme tokens.

const GOOGLE_G = '<svg class="sign-in-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>';
const APPLE_MARK = '<svg class="sign-in-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>';

// Czech wording; the app's English dictionary turns it into "Sign in with Google / Apple".
export function signInButtons({ apple = false } = {}) {
  return '<a class="sign-in-btn sign-in-google" href="/auth/google"><span class="sign-in-logo">' + GOOGLE_G + '</span><span>Přihlásit se přes Google</span></a>'
    + (apple ? '<a class="sign-in-btn sign-in-apple" href="/auth/apple">' + APPLE_MARK + '<span>Přihlásit se přes Apple</span></a>' : '');
}

const GOOGLE_LIGHT = '.sign-in-google{background:#fff;color:#1f1f1f;border-color:#747775}.sign-in-google .sign-in-logo{width:20px;height:20px;margin-left:0;background:none}';
const APPLE_LIGHT = '.sign-in-apple{background:#000;color:#fff;border-color:#000}';
const light = rules => rules.replace(/(^|\})\./g, '$1:root[data-theme="light"] .');
const systemLight = rules => '@media (prefers-color-scheme:light){' + rules.replace(/(^|\})\./g, '$1:root:not([data-theme="dark"]) .') + '}';

export const signInButtonsCss = `
.login-card{width:min(400px,100%);display:grid;gap:14px;padding:28px;text-align:center}
.login-card h2,.login-card p{margin:0}
.login-logo{display:block;width:48px;height:48px;margin:0 auto;border-radius:12px}
.login-links{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
.login-links a{color:var(--muted)}
.sign-in-buttons{display:grid;gap:10px}
.sign-in-btn{display:flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:0 16px;border:1px solid;border-radius:999px;text-decoration:none;white-space:nowrap;transition:filter .15s ease}
.sign-in-btn:hover{filter:brightness(.96)}
.sign-in-btn:focus-visible{outline:2px solid var(--primary);outline-offset:3px}
.sign-in-mark{display:block;width:18px;height:18px}
.sign-in-google{font:500 14px/20px "Google Sans",Roboto,Arial,sans-serif;letter-spacing:.25px;background:#131314;color:#e3e3e3;border-color:#8e918f}
.sign-in-google .sign-in-logo{display:grid;place-items:center;width:28px;height:28px;margin-left:-6px;border-radius:50%;background:#fff}
.sign-in-apple{font:500 15px/20px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;background:#fff;color:#000;border-color:#fff}
.sign-in-apple .sign-in-mark{width:17px;height:17px;margin-top:-3px}
${light(GOOGLE_LIGHT + APPLE_LIGHT)}
${systemLight(GOOGLE_LIGHT + APPLE_LIGHT)}
`;

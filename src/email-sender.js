// E-mails the app sends itself (sign-in codes, a new passkey notice) through
// Cloudflare Email Service. Off until the Worker has the EMAIL binding and the
// EMAIL_FROM secret, an address on a domain onboarded in Email Service → Email Sending.

export function emailSender(env) {
  const value = String(env?.EMAIL_FROM || "").trim();
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(value) ? value : "";
}

export function emailConfigured(env) {
  return Boolean(env?.EMAIL && typeof env.EMAIL.send === "function" && emailSender(env));
}

export async function sendEmail(env, { to, subject, text, html }) {
  const result = await env.EMAIL.send({ from: { email: emailSender(env), name: "Loadwise" }, to, subject, text, html });
  return result?.messageId || null;
}

const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function htmlEmail(lang, paragraphs, code = "") {
  const p = text => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${escape(text)}</p>`;
  const codeBlock = code ? `<p style="margin:0 0 16px;font-size:32px;line-height:1.2;letter-spacing:6px;font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace">${escape(code)}</p>` : "";
  const [first, ...rest] = paragraphs;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>`
    + `<body style="margin:0;padding:24px 16px;background:#f4f4f5;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">`
    + `<div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px">`
    + `<p style="margin:0 0 18px;font-size:17px;font-weight:700">Loadwise</p>${p(first)}${codeBlock}${rest.map(p).join("")}</div></body></html>`;
}

const CODE_TEXT = {
  cs: {
    subject: code => `${code} je tvůj kód pro přihlášení do Loadwise`,
    intro: "Tvůj kód pro přihlášení do Loadwise:",
    outro: "Platí 10 minut. Pokud o kód nežádáš ty, e-mail ignoruj. Bez kódu se k účtu nikdo nedostane."
  },
  en: {
    subject: code => `${code} is your Loadwise sign-in code`,
    intro: "Your code to sign in to Loadwise:",
    outro: "It is valid for 10 minutes. If you did not ask for it, ignore this email. Nobody can get into your account without the code."
  }
};

export function signInCodeEmail(lang, code) {
  const t = CODE_TEXT[lang === "en" ? "en" : "cs"];
  return { subject: t.subject(code), text: `${t.intro}\n\n${code}\n\n${t.outro}\n`, html: htmlEmail(lang === "en" ? "en" : "cs", [t.intro, t.outro], code) };
}

const PASSKEY_TEXT = {
  cs: {
    subject: "K tvému účtu Loadwise přibyl přístupový klíč",
    body: (name, when) => [`K tvému účtu Loadwise přibyl přístupový klíč (passkey) „${name}“, ${when}.`, "Pokud o tom nevíš, odeber ho v aplikaci v Nastavení → Účet a dej vědět správci aplikace."]
  },
  en: {
    subject: "A passkey was added to your Loadwise account",
    body: (name, when) => [`A passkey “${name}” was added to your Loadwise account on ${when}.`, "If this was not you, remove it in the app under Settings → Account and tell the app's administrator."]
  }
};

export function passkeyAddedEmail(lang, name, date = new Date()) {
  const en = lang === "en";
  const when = new Intl.DateTimeFormat(en ? "en-GB" : "cs-CZ", { timeZone: "Europe/Prague", dateStyle: "long", timeStyle: "short" }).format(date);
  const t = PASSKEY_TEXT[en ? "en" : "cs"], paragraphs = t.body(name, when);
  return { subject: t.subject, text: paragraphs.join("\n\n") + "\n", html: htmlEmail(en ? "en" : "cs", paragraphs) };
}

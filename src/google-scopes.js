// Google OAuth scopes. Connecting Google Health asks for HEALTH_SCOPES; the
// optional extras are asked for separately ("Rozšířit oprávnění Google"), so
// connecting never depends on them. Each user's granted scopes are stored with
// their connection (provider "google_scopes") and loaded as env.GOOGLE_SCOPES.

export const HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.nutrition.readonly",
  "https://www.googleapis.com/auth/googlehealth.nutrition.writeonly"
];

export const EXTRA_SCOPES = {
  // Writing weight to Google Health (manual entries, weight from Intervals.icu).
  weightWrite: "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.writeonly",
  // Birth date from the Google account (People API), for the age.
  birthday: "https://www.googleapis.com/auth/user.birthday.read"
};

// Base permissions by what they unlock, for the connection status and for
// skipping data whose permission the user did not give.
export const HEALTH_PERMISSIONS = {
  activity: HEALTH_SCOPES[0],
  metrics: HEALTH_SCOPES[1],
  sleep: HEALTH_SCOPES[2],
  nutritionRead: HEALTH_SCOPES[3],
  nutritionWrite: HEALTH_SCOPES[4]
};

export function grantedExtras(env) {
  const granted = new Set(env.GOOGLE_SCOPES || []);
  return Object.fromEntries(Object.entries(EXTRA_SCOPES).map(([name, scope]) => [name, granted.has(scope)]));
}

// Google's consent screen lets the user untick single permissions, so what was
// asked for is not always what was granted. Connections saved before the
// granted scopes were stored are taken as granting everything asked for.
function grantedSet(env) {
  return Array.isArray(env.GOOGLE_SCOPES) && env.GOOGLE_SCOPES.length ? new Set(env.GOOGLE_SCOPES) : null;
}
export function hasGoogleScope(env, scope) {
  const granted = grantedSet(env);
  return !granted || granted.has(scope);
}
// Base permissions the user did not give, by name (see HEALTH_PERMISSIONS).
export function missingHealthPermissions(env) {
  return Object.entries(HEALTH_PERMISSIONS).filter(([, scope]) => !hasGoogleScope(env, scope)).map(([name]) => name);
}

// Scopes for a Google Health access token: the granted base ones plus weight
// writing when granted. Asking a refresh for a scope the user did not grant
// fails the whole token. People API scopes get their own token (see
// birthdayScopes); Google Health has rejected tokens carrying other APIs'
// scopes before.
export function healthScopes(env) {
  const wanted = grantedExtras(env).weightWrite ? [...HEALTH_SCOPES, EXTRA_SCOPES.weightWrite] : HEALTH_SCOPES;
  return wanted.filter(scope => hasGoogleScope(env, scope));
}

export const birthdayScopes = [EXTRA_SCOPES.birthday];

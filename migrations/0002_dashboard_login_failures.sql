-- Failed dashboard logins per client IP, used to throttle key guessing.
CREATE TABLE IF NOT EXISTS dashboard_login_failures (
  ip TEXT NOT NULL,
  failed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_login_failures_ip_time
  ON dashboard_login_failures(ip, failed_at);

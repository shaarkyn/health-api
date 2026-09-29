-- Adaptive cycling workout library, capability progression and scheduling links.

CREATE TABLE IF NOT EXISTS workout_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_url TEXT,
  license_note TEXT,
  attribution TEXT,
  external_id TEXT,
  primary_system TEXT NOT NULL,
  secondary_system TEXT,
  duration_minutes INTEGER NOT NULL,
  work_minutes REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 1,
  intensity_factor REAL,
  target_load REAL,
  cadence TEXT,
  description TEXT,
  intervals_description TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  structure_json TEXT NOT NULL DEFAULT '[]',
  verified INTEGER NOT NULL DEFAULT 0,
  popularity REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workout_library_system_duration
  ON workout_library(primary_system, duration_minutes);

CREATE INDEX IF NOT EXISTS idx_workout_library_load
  ON workout_library(target_load, difficulty);

CREATE INDEX IF NOT EXISTS idx_workout_library_source
  ON workout_library(source_kind, source_name);

CREATE TABLE IF NOT EXISTS cycling_capabilities (
  system TEXT PRIMARY KEY,
  level REAL NOT NULL DEFAULT 3.0,
  confidence REAL NOT NULL DEFAULT 0.20,
  attempts INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0,
  last_workout_id TEXT,
  last_rpe REAL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workout_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id TEXT NOT NULL,
  scheduled_date TEXT,
  completed_percent REAL,
  rpe REAL,
  survey TEXT,
  notes TEXT,
  capability_before REAL,
  capability_after REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workout_feedback_workout
  ON workout_feedback(workout_id, created_at DESC);

CREATE TABLE IF NOT EXISTS workout_schedule_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  intervals_external_id TEXT NOT NULL UNIQUE,
  intervals_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workout_schedule_date
  ON workout_schedule_links(scheduled_date DESC);

PRAGMA optimize;

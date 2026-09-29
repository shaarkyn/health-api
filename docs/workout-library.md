# Adaptive Workout Library

Status: **feature branch / pre-deployment**

## User flow

1. Open **Workouty** in Petr Fitness Data.
2. Choose training system (e.g. VO2max), target duration, load, difficulty and target date.
3. Search results are ranked by suitability.
4. Review the power-over-time preview, source, structure, estimated load, difficulty, capability gap and ranking reasons.
5. Click **Přidat na vybraný den**.
6. Confirm the browser prompt.
7. The app sends a structured workout to Intervals.icu using a deterministic external ID and checks its own schedule record before a retry.
8. After the ride, enter completion and RPE under **Naplánované workouty** to update capability. Automatic activity matching only marks the session as completed; ride duration alone does not prove interval adherence.

## Ranking

Ranking is independent and intentionally does not reproduce TrainerRoad, JOIN or Xert proprietary scores.

Inputs include:

- exact / secondary energy-system match,
- duration fit and tolerance,
- requested training load,
- workout difficulty,
- athlete capability for that system,
- readiness (green / yellow / red),
- rolling seven-day hard-day count,
- training phase,
- verified source and public popularity when available.

The ideal challenge is near current capability. Green readiness can permit a small positive challenge; yellow readiness moves the ideal down; red readiness heavily penalizes hard sessions.

## Capability progression

Each system keeps a 1–10 capability level plus confidence:

- recovery
- endurance
- tempo
- sweet spot
- threshold
- VO2max
- anaerobic
- sprint

Completion and RPE update the level using a small bounded step. Automatic completion reconciliation does not change capability without verified interval execution or explicit athlete feedback. This is intentionally simpler and more transparent than proprietary ML scores.

## Sources and provenance

Every workout stores:

- source name,
- source kind,
- source URL,
- license/use note,
- attribution,
- original external ID when available.

Source kinds currently include:

- `original` — original Petr Fitness Data workouts,
- `public_reference` — independently normalized workouts based only on a publicly visible prescription,
- `trainerday_public_api` — public community workouts imported via TrainerDay's approved API.

### Included public-reference examples

- publicly described UAE Team Emirates-XRG torque bursts,
- publicly described UAE-style 40/20 over-unders,
- publicly described UAE steady torque,
- public JOIN threshold workout outlines,
- a public TrainingPeaks 4x4 sample,
- one public TrainerDay community VO2 workout used as a bootstrap/reference.

Proprietary workout libraries are **not scraped**.

## TrainerDay ingestion

Prepared adapter:

- endpoint: `https://api.trainerday.com/api/v1/workouts/find`
- API key header: `Authorization: Bearer <key>`
- filters: `dominantZone`, `fromMinutes`, `toMinutes`, `workoutName`, `pageIndex`
- server secret: `TRAINERDAY_PUBLIC_API_KEY`
- bounded import: max 20 pages/request to stay comfortably below the documented API rate limit.

The dashboard button imports four pages for the current filter by default. Larger backfills can call the same server adapter in batches.

## Intervals.icu scheduling

The app uses:

`POST /api/v1/athlete/0/events/bulk?upsert=true`

with Basic Auth (`API_KEY:<personal key>`), a deterministic `external_id`, category `WORKOUT`, sport `Ride`, and native Intervals.icu workout text in `description`.

Example external ID:

`pfd-library:pfd-vo2-5x4-90:2026-10-03`

The local schedule link prevents duplicate writes on normal retries. With a personal API key, Intervals.icu does not guarantee `upsert=true` matching by `external_id`; if its write succeeds but saving the local link fails, retry only after checking the Intervals calendar.

## Current seed size

The pre-deployment seed now contains **396 workouts**:
- 29 curated/original/public-reference workouts,
- 367 parametrically generated original PFD variants.

It covers recovery, endurance, tempo, sweet spot, threshold, VO2max, anaerobic and sprint work. The seven non-recovery systems include exact-duration variants through 240 minutes and up to 360 minutes. Long structured rides place the quality work between aerobic blocks and estimate load from their full power profile. Recovery rides remain short by design. TrainerDay public API ingestion expands the catalog further; it is no longer a dependency for having a useful library on day one.

## ChatGPT / Health & Strength MCP

The same library is exposed through MCP tools:
- `searchCyclingWorkouts`
- `getCyclingCapabilities`
- `scheduleCyclingWorkout`
- `recordCyclingWorkoutFeedback`

This allows the chat workflow and the dashboard to use the same ranking engine. Scheduling still requires the exact workout, exact date and an explicit `confirm=true` after user approval.

## Pre-deployment requirements

- configure `TRAINERDAY_PUBLIC_API_KEY` if TrainerDay ingestion is wanted,
- run the full Node test suite,
- apply D1 migration `0002_workout_library.sql`,
- smoke-test one search and one Intervals.icu calendar write on a non-critical date,
- confirm a completed scheduled workout is reconciled only once,
- keep the PR in draft until these checks pass.

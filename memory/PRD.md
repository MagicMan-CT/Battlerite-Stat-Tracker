# Battlerite Arena Tracker — PRD

## Original Problem
A website for competitive Battlerite. Log matches, players, rounds won, champions and roles. Track winrates, favourite champions, ELO leaderboard with round multiplier, head-to-head winrate matrix, and a matchmaking tool balancing by MMR + role synergy. Season support.

## User Choices (cumulative)
- JWT auth: single admin + optional viewer accounts. Public guest access via "Show Me The Stats!" button (no account).
- Full Battlerite champion roster (Melee / Ranged / Support).
- ELO K=24 scaled by team size so per-player delta sits in 15–25 range.
- 1v1, 2v2, 3v3 formats.
- Matchmaking modes: MMR, Role Synergy, Hybrid.
- 6-tier leaderboard (Bronze → Champion), Platinum included.
- Custom champion portraits (28 PNGs in /frontend/public/portraits/).
- Nav hover previews showing mini page summaries (not static tooltips).
- Full prefetch of all page data after sign-in / guest entry for instant navigation.
- Champion profile pages mirror player profiles with per-player breakdown.

## Architecture
- Backend: FastAPI + MongoDB (motor). ELO computed on match insert; per-player MMR = cumulative deltas per season.
- Auth: bcrypt + PyJWT, HttpOnly cookie (secure, samesite=none) + Bearer fallback.
- Frontend: React + Tailwind + shadcn/ui, dark HUD aesthetic (Chivo + JetBrains Mono).
- Routing: React Router with Protected wrapper. Guest users bypass /login via localStorage flag.
- Data cache: DataCacheContext prefetches seasons, players, champions, leaderboard, matches, matrix, champion_matrix, recap on sign-in; drives nav hover previews.

## Implemented (through Feb 2026)
### Core (previous iterations)
- Auth: login, logout, me, HttpOnly cookie, admin seeded from .env.
- Champions: 28 preloaded with roles.
- Seasons: CRUD + activate + auto-close on end_date + auto-spawn next season.
- Players: CRUD.
- Matches: create / update / delete with duplicate-player and duplicate-champion validation; ELO recomputation on edit.
- Stats: leaderboard (per season/format), 6-tier system, player profile (champions, roles, H2H, peak rank/MMR per season), PvP matrix (dual-axis highlight), champion matrix.
- Matchmaking: MMR / Synergy / Hybrid balancer.
- Recap: 7-day climbers, biggest upsets (winners on left), champion trends.
- Custom champion portraits + HoverCard with picks/winrate.

### This session (Feb 4 2026)
- **Public guest access**: Login screen replaces viewer-login/register with a single "Show Me The Stats!" button that grants read + matchmaking access. Backend `POST /api/matchmaking/balance` now public. Guest state persists in localStorage ("arena_guest_mode").
- **Champion Profile pages**: new route `/champions/:name` and endpoint `GET /api/stats/champion/{name}` returning {total_picks, winrate, players[], teammate_champions[], opponent_champions[], recent_matches[]}. Full per-player breakdown table with games / wins / losses / WR. Clickable links to related champions.
- **Nav hover previews**: `NavPreview` component wraps every top-nav link. Hover shows a popover with a mini visual preview specific to each page (top-3 ladder, recent match tiles, matrix thumbnail, champion portraits with WR, recap digest etc.). Driven by shared cache so no extra requests.
- **Full prefetch cache**: `DataCacheProvider` fetches seasons, players, champions, leaderboard, matches, PvP matrix, champion matrix, recap in parallel immediately after login or guest entry → sub-100ms navigation across pages.

## Backend Endpoints (adds / changes)
- `GET /api/stats/champion/{name}` — new. Champion profile stats.
- `POST /api/matchmaking/balance` — no longer requires authentication.

## Current Backlog (P1 / nice-to-have)
- React hydration warning in LogMatch / EditMatchDialog (console-only, non-blocking).
- Refactor long backend functions (`player_stats`, `recap`, `matchmaking`).
- MMR trajectory chart on champion profile (currently player-only).
- Match replay attachments / VOD links per match.
- Password-reset flow for admin.

## Tests
- /app/backend/tests/test_mmr_scaling.py
- /app/backend/tests/test_leaderboard_format.py
- /app/backend/tests/test_match_validation.py
- /app/backend/tests/test_viewer_role.py
- /app/backend/tests/test_champion_stats_and_guest.py (new, 7/7 passing)

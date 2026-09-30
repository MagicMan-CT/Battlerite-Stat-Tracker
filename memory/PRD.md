# Battlerite Arena Tracker — PRD

## Original Problem
A website for competitive Battlerite. Log matches, players, rounds won, characters, and roles. Track winrates, favourite champions, ELO leaderboard with round multiplier, head-to-head winrate matrix, and a matchmaking tool balancing by MMR + role synergy. Season support.

## User Choices
- JWT auth (single admin)
- Preloaded full Battlerite champion roster (Melee/Ranged/Support)
- Standard ELO, K=32, with round-differential multiplier
- 1v1, 2v2, 3v3 formats
- Matchmaking modes: MMR, Role Synergy, Hybrid
- Season support (create, activate, delete)

## Architecture
- Backend: FastAPI + MongoDB (motor). ELO computed on match insert; per-player MMR derived from cumulative deltas per season.
- Auth: bcrypt + PyJWT, httpOnly cookie + Bearer fallback.
- Frontend: React + Tailwind + shadcn/ui, dark HUD aesthetic (Chivo + JetBrains Mono).
- Routing: React Router with Protected wrapper.

## Implemented (Feb 2026)
- Auth: login, logout, me. Admin seeded from .env.
- Champions: 25 preloaded (Melee 9, Ranged 9, Support 7).
- Seasons: CRUD + activate.
- Players: CRUD.
- Matches: create with validation, list w/ filters, delete.
- Stats: leaderboard (per season, tiered), player profile (champs, roles, H2H), PvP matrix.
- Matchmaking: MMR / Synergy / Hybrid balancer for 2v2 & 3v3 with win probability.
- Seeded 28 demo matches across 2 seasons and 8 players.
- All ELO deltas sum to 0.00 (validated by testing agent).

## Backlog / Nice-to-haves
- Champion-vs-champion matrix
- Match edit + ELO recalc on delete
- Export/import CSV
- Player avatars + champion portrait images
- Charts (MMR over time via recharts)
- Public read-only share links per season

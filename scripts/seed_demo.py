#!/usr/bin/env python3
"""Seed demo data for Battlerite Arena Tracker."""
import requests
import random

API = "http://localhost:8001/api"

# Login
r = requests.post(f"{API}/auth/login", json={"email": "admin@arenaops.gg", "password": "admin123"})
token = r.json()["token"]
H = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Fetch existing
existing_players = requests.get(f"{API}/players").json()
if len(existing_players) >= 8:
    print(f"Already seeded ({len(existing_players)} players). Skipping.")
    exit(0)

# Players
names = ["Kaito", "Nova", "Ryker", "Zara", "Ember", "Storm", "Vex", "Onyx"]
players = []
for n in names:
    r = requests.post(f"{API}/players", json={"name": n}, headers=H)
    players.append(r.json())
print(f"Created {len(players)} players")

# Champions & seasons
champions = requests.get(f"{API}/champions").json()
seasons = requests.get(f"{API}/seasons").json()
active_season = next((s for s in seasons if s["active"]), seasons[0])

# Create Season 2 (inactive)
r = requests.post(f"{API}/seasons", json={"name": "Season 2 - Autumn Cup"}, headers=H)
season2 = r.json()
# Reactivate Season 1
requests.post(f"{API}/seasons/{active_season['id']}/activate", headers=H)

# Generate matches
random.seed(42)
formats_size = {"1v1": 1, "2v2": 2, "3v3": 3}

def make_match(season_id, fmt):
    size = formats_size[fmt]
    pool = random.sample(players, size * 2)
    team_a = pool[:size]
    team_b = pool[size:]
    ra = random.choice([5, 5, 5, 4])
    rb = random.choice([0, 1, 2, 3])
    if random.random() < 0.5:
        ra, rb = rb, ra
    match_players = []
    for p in team_a:
        c = random.choice(champions)
        match_players.append({"player_id": p["id"], "champion": c["name"], "role": c["role"], "team": "A"})
    for p in team_b:
        c = random.choice(champions)
        match_players.append({"player_id": p["id"], "champion": c["name"], "role": c["role"], "team": "B"})
    payload = {
        "season_id": season_id,
        "format": fmt,
        "team_a_rounds": ra,
        "team_b_rounds": rb,
        "players": match_players,
    }
    return requests.post(f"{API}/matches", json=payload, headers=H)

# Season 1: 20 matches
for i in range(20):
    fmt = random.choice(["1v1", "2v2", "3v3", "2v2", "3v3"])
    make_match(active_season["id"], fmt)

# Season 2: 8 matches
for i in range(8):
    fmt = random.choice(["2v2", "3v3"])
    make_match(season2["id"], fmt)

print("Seeding complete.")
print(f"Matches: {len(requests.get(f'{API}/matches').json())}")

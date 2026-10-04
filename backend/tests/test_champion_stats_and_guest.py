"""Tests for the new /api/stats/champion/{name} endpoint and public (guest) read access."""
import os
import uuid
import pytest
import requests

BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
API = f"{BACKEND_URL}/api"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@arenaops.gg")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    # Cookie uses secure/samesite=none, which won't ride over plain-HTTP localhost.
    # Fall back to Bearer token for subsequent requests.
    token = r.json().get("token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def anon_client():
    return requests.Session()


@pytest.fixture(scope="module")
def seeded_match(admin_client):
    """Creates 4 players + 1 2v2 match so champion stats have real data."""
    s = admin_client
    pname = lambda: f"CTEST_{uuid.uuid4().hex[:6]}"
    players = []
    for _ in range(4):
        r = s.post(f"{API}/players", json={"name": pname()})
        assert r.status_code == 200
        players.append(r.json()["id"])

    season = s.get(f"{API}/seasons").json()[0]
    payload = {
        "season_id": season["id"],
        "format": "2v2",
        "team_a_rounds": 5,
        "team_b_rounds": 3,
        "players": [
            {"player_id": players[0], "champion": "Ulric",  "role": "Support", "team": "A"},
            {"player_id": players[1], "champion": "Jumong", "role": "Ranged",  "team": "A"},
            {"player_id": players[2], "champion": "Bakko",  "role": "Melee",   "team": "B"},
            {"player_id": players[3], "champion": "Pearl",  "role": "Support", "team": "B"},
        ],
    }
    r = s.post(f"{API}/matches", json=payload)
    assert r.status_code == 200, r.text
    yield players
    # cleanup players
    for pid in players:
        s.delete(f"{API}/players/{pid}")


class TestChampionStats:
    def test_valid_champion_returns_profile(self, anon_client, seeded_match):
        r = anon_client.get(f"{API}/stats/champion/Ulric")
        assert r.status_code == 200
        d = r.json()
        assert d["champion"] == "Ulric"
        assert d["role"] == "Support"
        assert d["total_picks"] >= 1
        assert d["total_wins"] >= 1
        assert isinstance(d["players"], list) and len(d["players"]) >= 1
        # Ulric should have Jumong as teammate and Bakko / Pearl as opponents
        teammate_names = [c["champion"] for c in d["teammate_champions"]]
        opponent_names = [c["champion"] for c in d["opponent_champions"]]
        assert "Jumong" in teammate_names
        assert "Bakko" in opponent_names
        assert "Pearl" in opponent_names
        assert d["winrate"] > 0

    def test_unknown_champion_returns_404(self, anon_client):
        r = anon_client.get(f"{API}/stats/champion/NotAChampion")
        assert r.status_code == 404

    def test_zero_pick_champion_returns_empty_profile(self, anon_client):
        # pick a champion that nobody has ever used (unlikely to coincide with seeds)
        r = anon_client.get(f"{API}/stats/champion/Alysia")
        assert r.status_code == 200
        d = r.json()
        assert d["champion"] == "Alysia"
        assert d["total_picks"] >= 0
        assert isinstance(d["players"], list)


class TestGuestPublicAccess:
    """Guest mode = frontend sets a flag locally; backend reads are unauthenticated.
       Matchmaking must also be accessible without a session cookie."""

    def test_leaderboard_without_auth(self, anon_client):
        r = anon_client.get(f"{API}/stats/leaderboard")
        assert r.status_code == 200

    def test_matrix_without_auth(self, anon_client):
        r = anon_client.get(f"{API}/stats/matrix")
        assert r.status_code == 200

    def test_matchmaking_without_auth(self, anon_client, seeded_match):
        # Not enough players payload will still 400 but it must NOT be 401
        r = anon_client.post(
            f"{API}/matchmaking/balance",
            json={"player_ids": seeded_match, "format": "2v2"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "team_a" in d and "team_b" in d
        assert len(d["team_a"]) == 2 and len(d["team_b"]) == 2

    def test_create_match_still_requires_admin(self, anon_client, seeded_match):
        season = anon_client.get(f"{API}/seasons").json()[0]
        payload = {
            "season_id": season["id"],
            "format": "2v2",
            "team_a_rounds": 5,
            "team_b_rounds": 3,
            "players": [
                {"player_id": seeded_match[0], "champion": "Ulric",  "role": "Support", "team": "A"},
                {"player_id": seeded_match[1], "champion": "Jumong", "role": "Ranged",  "team": "A"},
                {"player_id": seeded_match[2], "champion": "Bakko",  "role": "Melee",   "team": "B"},
                {"player_id": seeded_match[3], "champion": "Pearl",  "role": "Support", "team": "B"},
            ],
        }
        r = anon_client.post(f"{API}/matches", json=payload)
        assert r.status_code == 401

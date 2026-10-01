"""Backend validation tests for duplicate player & duplicate champion rules in matches."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for local test runs that still work via internal routing
    BASE_URL = "http://localhost:8001"
API = f"{BASE_URL}/api"

import os

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@arenaops.gg")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "admin123")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("token")
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def season_id(client):
    r = client.get(f"{API}/seasons")
    assert r.status_code == 200
    seasons = r.json()
    active = next((x for x in seasons if x.get("active")), seasons[0] if seasons else None)
    assert active is not None
    return active["id"]


@pytest.fixture(scope="module")
def players(client):
    """Ensure at least 4 TEST_ players exist and return 4 player ids."""
    created = []
    for i in range(4):
        r = client.post(f"{API}/players", json={"name": f"TEST_DupVal_{uuid.uuid4().hex[:6]}"})
        assert r.status_code == 200, r.text
        created.append(r.json()["id"])
    yield created
    # cleanup
    for pid in created:
        client.delete(f"{API}/players/{pid}")


def _payload(season_id, players, team_a_pids, team_b_pids, champs_a, champs_b, a_rounds=5, b_rounds=3):
    plist = []
    for pid, champ in zip(team_a_pids, champs_a):
        plist.append({"player_id": pid, "champion": champ, "role": "Melee", "team": "A"})
    for pid, champ in zip(team_b_pids, champs_b):
        plist.append({"player_id": pid, "champion": champ, "role": "Melee", "team": "B"})
    return {
        "season_id": season_id, "format": "2v2",
        "team_a_rounds": a_rounds, "team_b_rounds": b_rounds,
        "players": plist, "notes": "TEST_dup",
    }


# -------- Create match --------
class TestCreateMatchValidation:
    def test_duplicate_player_same_team_rejected(self, client, season_id, players):
        p1, p2, p3, p4 = players
        payload = _payload(season_id, players, [p1, p1], [p3, p4], ["Bakko", "Croak"], ["Freya", "Jamila"])
        r = client.post(f"{API}/matches", json=payload)
        assert r.status_code == 400
        assert "once per match" in r.json().get("detail", "").lower()

    def test_duplicate_player_opposing_teams_rejected(self, client, season_id, players):
        p1, p2, p3, p4 = players
        payload = _payload(season_id, players, [p1, p2], [p1, p4], ["Bakko", "Croak"], ["Freya", "Jamila"])
        r = client.post(f"{API}/matches", json=payload)
        assert r.status_code == 400
        assert "once per match" in r.json().get("detail", "").lower()

    def test_duplicate_champion_team_a_rejected(self, client, season_id, players):
        p1, p2, p3, p4 = players
        payload = _payload(season_id, players, [p1, p2], [p3, p4], ["Bakko", "Bakko"], ["Freya", "Jamila"])
        r = client.post(f"{API}/matches", json=payload)
        assert r.status_code == 400
        assert "team a" in r.json().get("detail", "").lower()

    def test_duplicate_champion_team_b_rejected(self, client, season_id, players):
        p1, p2, p3, p4 = players
        payload = _payload(season_id, players, [p1, p2], [p3, p4], ["Bakko", "Croak"], ["Freya", "Freya"])
        r = client.post(f"{API}/matches", json=payload)
        assert r.status_code == 400
        assert "team b" in r.json().get("detail", "").lower()

    def test_mirror_champion_across_teams_allowed(self, client, season_id, players):
        p1, p2, p3, p4 = players
        payload = _payload(season_id, players, [p1, p2], [p3, p4], ["Bakko", "Croak"], ["Bakko", "Jamila"])
        r = client.post(f"{API}/matches", json=payload)
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        # cleanup
        client.delete(f"{API}/matches/{mid}")


# -------- Update match --------
class TestUpdateMatchValidation:
    @pytest.fixture
    def match_id(self, client, season_id, players):
        p1, p2, p3, p4 = players
        payload = _payload(season_id, players, [p1, p2], [p3, p4], ["Bakko", "Croak"], ["Freya", "Jamila"])
        r = client.post(f"{API}/matches", json=payload)
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        yield mid
        client.delete(f"{API}/matches/{mid}")

    def test_update_duplicate_player_rejected(self, client, season_id, players, match_id):
        p1, p2, p3, p4 = players
        payload = _payload(season_id, players, [p1, p1], [p3, p4], ["Bakko", "Croak"], ["Freya", "Jamila"])
        r = client.put(f"{API}/matches/{match_id}", json=payload)
        assert r.status_code == 400
        assert "once per match" in r.json().get("detail", "").lower()

    def test_update_duplicate_champion_team_a_rejected(self, client, season_id, players, match_id):
        p1, p2, p3, p4 = players
        payload = _payload(season_id, players, [p1, p2], [p3, p4], ["Bakko", "Bakko"], ["Freya", "Jamila"])
        r = client.put(f"{API}/matches/{match_id}", json=payload)
        assert r.status_code == 400
        assert "team a" in r.json().get("detail", "").lower()

    def test_update_duplicate_champion_team_b_rejected(self, client, season_id, players, match_id):
        p1, p2, p3, p4 = players
        payload = _payload(season_id, players, [p1, p2], [p3, p4], ["Bakko", "Croak"], ["Freya", "Freya"])
        r = client.put(f"{API}/matches/{match_id}", json=payload)
        assert r.status_code == 400
        assert "team b" in r.json().get("detail", "").lower()

    def test_update_mirror_champion_allowed(self, client, season_id, players, match_id):
        p1, p2, p3, p4 = players
        payload = _payload(season_id, players, [p1, p2], [p3, p4], ["Bakko", "Croak"], ["Bakko", "Jamila"])
        r = client.put(f"{API}/matches/{match_id}", json=payload)
        assert r.status_code == 200, r.text

# Viewer role & registration tests
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
ADMIN_EMAIL = "admin@arenaops.gg"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def viewer():
    email = f"TEST_viewer_{uuid.uuid4().hex[:8]}@test.com"
    password = "viewerpass123"
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": password, "name": "TEST Viewer"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["role"] == "viewer"
    assert "token" in data
    yield {"session": s, "email": email, "password": password, "token": data["token"], "id": data["id"]}
    # cleanup via admin
    admin = requests.Session()
    admin.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    # No admin endpoint to delete users; leave as-is (TEST_ prefix)


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "admin"
    return s


# ---------- Registration ----------
class TestRegister:
    def test_register_creates_viewer(self, viewer):
        assert viewer["token"]

    def test_register_sets_cookie(self):
        email = f"TEST_cookie_{uuid.uuid4().hex[:8]}@test.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "abc123"})
        assert r.status_code == 200
        assert "access_token" in r.cookies

    def test_register_duplicate_email_409(self, viewer):
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"email": viewer["email"], "password": "another123"})
        assert r.status_code == 409

    def test_register_short_password_400(self):
        email = f"TEST_short_{uuid.uuid4().hex[:8]}@test.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "abc"})
        assert r.status_code == 400

    def test_me_returns_viewer_role(self, viewer):
        r = viewer["session"].get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "viewer"


# ---------- Viewer forbidden on admin writes ----------
class TestViewerForbidden:
    def test_viewer_cannot_create_player(self, viewer):
        r = viewer["session"].post(f"{BASE_URL}/api/players", json={"name": "TEST_viewer_player"})
        assert r.status_code == 403
        assert "Admin" in r.json().get("detail", "")

    def test_viewer_cannot_delete_player(self, viewer):
        r = viewer["session"].delete(f"{BASE_URL}/api/players/nonexistent-id")
        assert r.status_code == 403

    def test_viewer_cannot_create_season(self, viewer):
        r = viewer["session"].post(f"{BASE_URL}/api/seasons", json={"name": "TEST_viewer_season"})
        assert r.status_code == 403

    def test_viewer_cannot_patch_season(self, viewer):
        r = viewer["session"].patch(f"{BASE_URL}/api/seasons/some-id", json={"name": "x"})
        assert r.status_code == 403

    def test_viewer_cannot_activate_season(self, viewer):
        r = viewer["session"].post(f"{BASE_URL}/api/seasons/some-id/activate")
        assert r.status_code == 403

    def test_viewer_cannot_delete_season(self, viewer):
        r = viewer["session"].delete(f"{BASE_URL}/api/seasons/some-id")
        assert r.status_code == 403

    def test_viewer_cannot_create_match(self, viewer):
        payload = {
            "season_id": "x", "format": "2v2",
            "team_a_rounds": 3, "team_b_rounds": 0,
            "players": [],
        }
        r = viewer["session"].post(f"{BASE_URL}/api/matches", json=payload)
        assert r.status_code == 403

    def test_viewer_cannot_update_match(self, viewer):
        payload = {
            "season_id": "x", "format": "2v2",
            "team_a_rounds": 3, "team_b_rounds": 0,
            "players": [],
        }
        r = viewer["session"].put(f"{BASE_URL}/api/matches/x", json=payload)
        assert r.status_code == 403

    def test_viewer_cannot_delete_match(self, viewer):
        r = viewer["session"].delete(f"{BASE_URL}/api/matches/x")
        assert r.status_code == 403


# ---------- Viewer allowed on public & matchmaking ----------
class TestViewerAllowed:
    def test_viewer_can_list_players(self, viewer):
        assert viewer["session"].get(f"{BASE_URL}/api/players").status_code == 200

    def test_viewer_can_list_seasons(self, viewer):
        assert viewer["session"].get(f"{BASE_URL}/api/seasons").status_code == 200

    def test_viewer_can_list_matches(self, viewer):
        assert viewer["session"].get(f"{BASE_URL}/api/matches").status_code == 200

    def test_viewer_can_leaderboard(self, viewer):
        assert viewer["session"].get(f"{BASE_URL}/api/stats/leaderboard").status_code == 200

    def test_viewer_can_matrix(self, viewer):
        assert viewer["session"].get(f"{BASE_URL}/api/stats/matrix").status_code == 200

    def test_viewer_can_recap(self, viewer):
        assert viewer["session"].get(f"{BASE_URL}/api/stats/recap").status_code == 200

    def test_viewer_can_use_matchmaking(self, viewer, admin):
        # Need at least 4 players — reuse existing or create via admin
        players = admin.get(f"{BASE_URL}/api/players").json()
        created_ids = []
        while len(players) < 4:
            r = admin.post(f"{BASE_URL}/api/players",
                           json={"name": f"TEST_mm_{uuid.uuid4().hex[:6]}"})
            assert r.status_code == 200
            created_ids.append(r.json()["id"])
            players = admin.get(f"{BASE_URL}/api/players").json()
        pids = [p["id"] for p in players[:4]]
        r = viewer["session"].post(f"{BASE_URL}/api/matchmaking/balance",
                                   json={"player_ids": pids, "format": "2v2", "mode": "hybrid"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "team_a" in data and "team_b" in data
        assert "balance_score" in data
        # cleanup
        for pid in created_ids:
            admin.delete(f"{BASE_URL}/api/players/{pid}")


# ---------- Admin regression ----------
class TestAdminRegression:
    def test_admin_can_create_and_delete_player(self, admin):
        name = f"TEST_admin_{uuid.uuid4().hex[:6]}"
        r = admin.post(f"{BASE_URL}/api/players", json={"name": name})
        assert r.status_code == 200
        pid = r.json()["id"]
        assert r.json()["name"] == name
        # verify persistence
        plist = admin.get(f"{BASE_URL}/api/players").json()
        assert any(p["id"] == pid for p in plist)
        # delete
        assert admin.delete(f"{BASE_URL}/api/players/{pid}").status_code == 200

    def test_admin_can_create_and_delete_season(self, admin):
        name = f"TEST_season_{uuid.uuid4().hex[:6]}"
        r = admin.post(f"{BASE_URL}/api/seasons", json={"name": name})
        assert r.status_code == 200
        sid = r.json()["id"]
        # patch
        r2 = admin.patch(f"{BASE_URL}/api/seasons/{sid}", json={"name": name + "_u"})
        assert r2.status_code == 200
        assert r2.json()["name"] == name + "_u"
        # delete
        assert admin.delete(f"{BASE_URL}/api/seasons/{sid}").status_code == 200

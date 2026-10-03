"""Tests for raised K_FACTOR=24 and team_size scaling of ELO deltas.

Verifies: per-player |delta| in [15,25] for 5-3 equal-MMR 1v1/2v2/3v3,
zero-sum invariant, 5-0 blowout bound, imbalanced-rating distribution,
leaderboard + admin recompute + player stats smoke tests.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@arenaops.gg")
ADMIN_PASS = os.environ.get("TEST_ADMIN_PASSWORD", "admin123")


# --- fixtures ---------------------------------------------------------------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def ctx(admin_session):
    s = admin_session
    created = {"seasons": [], "players": [], "matches": []}

    # Isolated season
    r = s.post(f"{API}/seasons", json={"name": f"TEST_MMR_{uuid.uuid4().hex[:6]}"})
    assert r.status_code in (200, 201), r.text
    created["seasons"].append(r.json())

    yield s, created

    # Cleanup
    for m in created["matches"]:
        s.delete(f"{API}/matches/{m['id']}")
    for p in created["players"]:
        s.delete(f"{API}/players/{p['id']}")
    for sea in created["seasons"]:
        s.delete(f"{API}/seasons/{sea['id']}")


def _new_players(session, created, n, prefix):
    players = []
    for i in range(n):
        r = session.post(f"{API}/players", json={"name": f"TEST_{prefix}_{uuid.uuid4().hex[:6]}_{i}"})
        assert r.status_code in (200, 201), r.text
        p = r.json()
        players.append(p)
        created["players"].append(p)
    return players


def _mk_match(session, created, season_id, team_a_ids, team_b_ids, a_rounds, b_rounds, fmt):
    champs = ["Bakko", "Croak", "Jumong", "Varesh", "Rook", "Pearl"]
    roles = ["Melee", "Melee", "Ranged", "Support", "Melee", "Ranged"]
    payload = {
        "season_id": season_id,
        "format": fmt,
        "team_a_rounds": a_rounds,
        "team_b_rounds": b_rounds,
        "players": (
            [{"player_id": pid, "champion": champs[i % 6], "role": roles[i % 6], "team": "A"}
             for i, pid in enumerate(team_a_ids)] +
            [{"player_id": pid, "champion": champs[(i + 3) % 6], "role": roles[(i + 3) % 6], "team": "B"}
             for i, pid in enumerate(team_b_ids)]
        ),
    }
    r = session.post(f"{API}/matches", json=payload)
    assert r.status_code in (200, 201), r.text
    m = r.json()
    created["matches"].append(m)
    return m


# --- tests ------------------------------------------------------------------
class TestMMRScaling:
    def test_1v1_5_3_equal_mmr(self, ctx):
        s, created = ctx
        season_id = created["seasons"][0]["id"]
        [a, b] = _new_players(s, created, 2, "1V1_53")
        m = _mk_match(s, created, season_id, [a["id"]], [b["id"]], 5, 3, "1v1")
        deltas = {p["player_id"]: p["elo_delta"] for p in m["players"]}
        assert abs(sum(deltas.values())) < 0.01, f"Zero-sum violated: {deltas}"
        for pid, d in deltas.items():
            assert 15 <= abs(d) <= 25, f"1v1 5-3 player delta out of range: {d}"
        # Expected ~16.8
        assert abs(abs(deltas[a["id"]]) - 16.8) < 0.5

    def test_2v2_5_3_equal_mmr(self, ctx):
        s, created = ctx
        season_id = created["seasons"][0]["id"]
        ps = _new_players(s, created, 4, "2V2_53")
        m = _mk_match(s, created, season_id,
                      [ps[0]["id"], ps[1]["id"]], [ps[2]["id"], ps[3]["id"]],
                      5, 3, "2v2")
        deltas = {p["player_id"]: p["elo_delta"] for p in m["players"]}
        assert abs(sum(deltas.values())) < 0.01, f"Zero-sum violated: {deltas}"
        for pid, d in deltas.items():
            assert 15 <= abs(d) <= 25, f"2v2 5-3 per-player delta out of range: {d}"
        # Teammates equal
        assert abs(deltas[ps[0]["id"]] - deltas[ps[1]["id"]]) < 0.01
        assert abs(deltas[ps[2]["id"]] - deltas[ps[3]["id"]]) < 0.01

    def test_3v3_5_3_equal_mmr(self, ctx):
        s, created = ctx
        season_id = created["seasons"][0]["id"]
        ps = _new_players(s, created, 6, "3V3_53")
        m = _mk_match(s, created, season_id,
                      [p["id"] for p in ps[:3]], [p["id"] for p in ps[3:]],
                      5, 3, "3v3")
        deltas = {p["player_id"]: p["elo_delta"] for p in m["players"]}
        assert abs(sum(deltas.values())) < 0.01, f"Zero-sum violated: {deltas}"
        for pid, d in deltas.items():
            assert 15 <= abs(d) <= 25, f"3v3 5-3 per-player delta out of range: {d}"

    def test_1v1_5_0_blowout(self, ctx):
        s, created = ctx
        season_id = created["seasons"][0]["id"]
        [a, b] = _new_players(s, created, 2, "1V1_50")
        m = _mk_match(s, created, season_id, [a["id"]], [b["id"]], 5, 0, "1v1")
        deltas = {p["player_id"]: p["elo_delta"] for p in m["players"]}
        assert abs(sum(deltas.values())) < 0.01
        # Blowout: ~24, allow up to ceiling
        for d in deltas.values():
            assert 20 <= abs(d) <= 25.01, f"5-0 blowout delta out of expected range: {d}"

    def test_imbalanced_2v2_underdog_gains_more(self, ctx):
        s, created = ctx
        season_id = created["seasons"][0]["id"]
        # Create HI, LO, MIDA, MIDB; pump HI with 1v1 wins vs MIDB
        ps = _new_players(s, created, 4, "IMBAL")
        HI, LO, MIDA, MIDB = ps[0]["id"], ps[1]["id"], ps[2]["id"], ps[3]["id"]
        for _ in range(4):
            _mk_match(s, created, season_id, [HI], [MIDB], 5, 0, "1v1")

        m = _mk_match(s, created, season_id, [HI, LO], [MIDA, MIDB], 5, 3, "2v2")
        d = {p["player_id"]: p["elo_delta"] for p in m["players"]}
        assert abs(sum(d.values())) < 0.01
        assert d[HI] > 0 and d[LO] > 0, "Winners must have positive deltas"
        assert d[MIDA] < 0 and d[MIDB] < 0, "Losers must have negative deltas"
        # Underdog LO (lower MMR winner) gains more than HI
        assert d[LO] > d[HI], f"Underdog LO={d[LO]} should gain more than HI={d[HI]}"

    def test_leaderboard_smoke(self, admin_session):
        r = admin_session.get(f"{API}/stats/leaderboard")
        assert r.status_code == 200, r.text
        data = r.json()
        rows = data if isinstance(data, list) else data.get("players") or data.get("leaderboard") or []
        assert isinstance(rows, list)
        # Should contain mmr numeric values
        for row in rows[:5]:
            mmr = row.get("mmr")
            assert isinstance(mmr, (int, float)), f"mmr not numeric: {row}"

    def test_admin_recompute_all(self, admin_session):
        r = admin_session.post(f"{API}/admin/recompute-all")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert isinstance(body.get("seasons"), int) and body["seasons"] >= 1

    def test_player_stats_peak_mmr(self, admin_session, ctx):
        s, created = ctx
        # Use HI who should have highest peak from the imbalanced test
        # Fallback: pick first player from leaderboard
        r = admin_session.get(f"{API}/stats/leaderboard")
        assert r.status_code == 200
        data = r.json()
        rows = data if isinstance(data, list) else data.get("players") or data.get("leaderboard") or []
        assert rows, "Leaderboard empty"
        pid = rows[0].get("player_id") or rows[0].get("id")
        assert pid, f"No player id in row: {rows[0]}"
        r = admin_session.get(f"{API}/stats/player/{pid}")
        assert r.status_code == 200, r.text
        stats = r.json()
        assert "peak_mmr_all_time" in stats
        assert isinstance(stats["peak_mmr_all_time"], (int, float))
        assert stats["peak_mmr_all_time"] >= 1000  # should reflect gains

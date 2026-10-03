"""Tests for per-player ELO deltas, admin recompute, and all-time peak with season name."""
import os
import time
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
def anon_session():
    return requests.Session()


@pytest.fixture(scope="module")
def test_data(admin_session):
    """Create isolated 2 seasons + 4 players and clean up after."""
    s = admin_session
    created = {"seasons": [], "players": [], "matches": []}

    # 2 seasons
    for name in ("TEST_ELO_S1", "TEST_ELO_S2"):
        r = s.post(f"{API}/seasons", json={"name": name})
        assert r.status_code in (200, 201), r.text
        created["seasons"].append(r.json())

    # 4 players
    for name in ("TEST_HI", "TEST_LO", "TEST_MIDA", "TEST_MIDB"):
        r = s.post(f"{API}/players", json={"name": name})
        assert r.status_code in (200, 201), r.text
        created["players"].append(r.json())

    yield created

    # Cleanup
    for m in created["matches"]:
        s.delete(f"{API}/matches/{m['id']}")
    for p in created["players"]:
        s.delete(f"{API}/players/{p['id']}")
    for sea in created["seasons"]:
        s.delete(f"{API}/seasons/{sea['id']}")


def _mk_match(session, season_id, team_a, team_b, a_rounds, b_rounds, fmt="2v2"):
    """team_a/team_b lists of (player_id, champion, role)."""
    payload = {
        "season_id": season_id,
        "format": fmt,
        "team_a_rounds": a_rounds,
        "team_b_rounds": b_rounds,
        "players": (
            [{"player_id": p, "champion": c, "role": r, "team": "A"} for p, c, r in team_a] +
            [{"player_id": p, "champion": c, "role": r, "team": "B"} for p, c, r in team_b]
        ),
    }
    r = session.post(f"{API}/matches", json=payload)
    return r


# --- combined suite (single class so xdist loadscope keeps shared fixture on one worker) ----
class TestEloAndPeak:
    def test_imbalanced_team_different_deltas(self, admin_session, test_data):
        """Team A: HI (will be pumped first) + LO vs Team B: MIDA + MIDB.
        After pumping HI's MMR, same team members should get DIFFERENT deltas."""
        s = admin_session
        season = test_data["seasons"][0]
        HI, LO, MIDA, MIDB = [p["id"] for p in test_data["players"]]

        # Pump HI's MMR with 3 unrelated wins vs weaker opponents (just to make MMRs diverge).
        # We'll leverage 1v1 matches HI vs MIDB to raise HI's MMR.
        for _ in range(3):
            r = _mk_match(
                s, season["id"],
                [(HI, "Bakko", "Melee")], [(MIDB, "Jumong", "Ranged")],
                3, 0, fmt="1v1",
            )
            assert r.status_code in (200, 201), r.text
            test_data["matches"].append(r.json())

        # Now log a 2v2 with HI+LO vs MIDA+MIDB, HI's team wins 3-1
        r = _mk_match(
            s, season["id"],
            [(HI, "Bakko", "Melee"), (LO, "Croak", "Melee")],
            [(MIDA, "Jumong", "Ranged"), (MIDB, "Varesh", "Support")],
            3, 1, fmt="2v2",
        )
        assert r.status_code in (200, 201), r.text
        match = r.json()
        test_data["matches"].append(match)

        deltas = {p["player_id"]: p["elo_delta"] for p in match["players"]}
        # Zero sum (within tolerance)
        total = sum(deltas.values())
        assert abs(total) < 0.5, f"Zero-sum violated: total={total}, deltas={deltas}"

        # Team A has 2 players with distinct MMRs; deltas should differ
        assert deltas[HI] != deltas[LO], f"Team-A deltas identical: {deltas[HI]} vs {deltas[LO]}"
        # Winning side -> both positive
        assert deltas[HI] > 0 and deltas[LO] > 0
        # Losing side -> both negative
        assert deltas[MIDA] < 0 and deltas[MIDB] < 0
        # Underdog (LO) on winning team should gain more than favorite (HI)
        assert deltas[LO] > deltas[HI], f"Underdog LO should gain more: LO={deltas[LO]} HI={deltas[HI]}"

    def test_equal_mmr_team_equal_deltas(self, admin_session, test_data):
        """Fresh players with equal starting MMR -> teammates get equal deltas."""
        s = admin_session
        season = test_data["seasons"][1]  # fresh season 2
        # Use 4 fresh players so MMRs are equal
        fresh = []
        for name in ("TEST_EQ_A", "TEST_EQ_B", "TEST_EQ_C", "TEST_EQ_D"):
            r = s.post(f"{API}/players", json={"name": name})
            assert r.status_code in (200, 201), r.text
            fresh.append(r.json())
            test_data["players"].append(r.json())
        a, b, c, d = [p["id"] for p in fresh]

        r = _mk_match(
            s, season["id"],
            [(a, "Bakko", "Melee"), (b, "Croak", "Melee")],
            [(c, "Jumong", "Ranged"), (d, "Varesh", "Support")],
            3, 1, fmt="2v2",
        )
        assert r.status_code in (200, 201), r.text
        match = r.json()
        test_data["matches"].append(match)
        deltas = {p["player_id"]: p["elo_delta"] for p in match["players"]}
        assert abs(sum(deltas.values())) < 0.5
        assert abs(deltas[a] - deltas[b]) < 0.01, f"Equal-MMR teammates differ: {deltas}"
        assert abs(deltas[c] - deltas[d]) < 0.01, f"Equal-MMR teammates differ: {deltas}"


# --- admin recompute --------------------------------------------------------
    def test_recompute_requires_admin(self, anon_session):
        r = anon_session.post(f"{API}/admin/recompute-all")
        assert r.status_code in (401, 403)

    def test_recompute_as_admin(self, admin_session):
        r = admin_session.post(f"{API}/admin/recompute-all")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert isinstance(body.get("seasons"), int) and body["seasons"] >= 1


# --- player stats peak season ----------------------------------------------
    def test_peak_season_name_populated(self, admin_session, test_data):
        """After matches in two seasons where S1 produces higher peak than S2,
        peak_season_name should equal S1 name."""
        s = admin_session
        s1, s2 = test_data["seasons"]
        # Use the HI player — he already won several 1v1s in S1 (peak high)
        HI = test_data["players"][0]["id"]

        # Add a loss for HI in S2 to make S2 peak lower
        # Create a dedicated opponent to not interfere
        r = s.post(f"{API}/players", json={"name": "TEST_PEAK_OPP"})
        assert r.status_code in (200, 201)
        opp = r.json()
        test_data["players"].append(opp)

        r = _mk_match(
            s, s2["id"],
            [(HI, "Bakko", "Melee")], [(opp["id"], "Jumong", "Ranged")],
            0, 3, fmt="1v1",
        )
        assert r.status_code in (200, 201), r.text
        test_data["matches"].append(r.json())

        # Get stats (no season filter so default view uses all data, but peak_all_time is cross-season)
        r = s.get(f"{API}/stats/player/{HI}")
        assert r.status_code == 200, r.text
        stats = r.json()
        for key in ("peak_mmr_all_time", "peak_season_id", "peak_season_name", "peak_mmr"):
            assert key in stats, f"missing key {key}"
        assert isinstance(stats["peak_mmr_all_time"], (int, float))
        assert stats["peak_season_name"] == s1["name"], (
            f"Expected peak_season_name={s1['name']} got {stats['peak_season_name']}"
        )
        assert stats["peak_season_id"] == s1["id"]
        # all-time peak >= current-view peak
        assert stats["peak_mmr_all_time"] >= stats["peak_mmr"] - 0.01

        # Filter by S2 - all-time peak must still reference S1 and be >= S2 peak
        r = s.get(f"{API}/stats/player/{HI}", params={"season_id": s2["id"]})
        assert r.status_code == 200
        s2stats = r.json()
        assert s2stats["peak_season_name"] == s1["name"]
        assert s2stats["peak_mmr_all_time"] >= s2stats["peak_mmr"] - 0.01

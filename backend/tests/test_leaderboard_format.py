"""Per-format leaderboard tests - creates isolated seed data."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', "https://match-logger-pro-2.preview.emergentagent.com").rstrip('/')


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@arenaops.gg", "password": "admin123"})
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def seeded_season(api_client):
    """Create a new season + players + mixed format matches."""
    tag = uuid.uuid4().hex[:6]
    season = api_client.post(f"{BASE_URL}/api/seasons",
                             json={"name": f"TEST_LB_{tag}"}).json()
    sid = season["id"]
    # Create 6 players
    players = []
    for i in range(6):
        p = api_client.post(f"{BASE_URL}/api/players",
                            json={"name": f"TEST_P{i}_{tag}"}).json()
        players.append(p)

    def mk(fmt, a_ids, b_ids, ra, rb):
        plist = []
        for pid in a_ids:
            plist.append({"player_id": pid, "champion": "Bakko", "role": "Melee", "team": "A"})
        for pid in b_ids:
            plist.append({"player_id": pid, "champion": "Jumong", "role": "Ranged", "team": "B"})
        r = api_client.post(f"{BASE_URL}/api/matches", json={
            "season_id": sid, "format": fmt,
            "team_a_rounds": ra, "team_b_rounds": rb, "players": plist,
        })
        assert r.status_code == 200, r.text

    # 1v1 matches: 2
    mk("1v1", [players[0]["id"]], [players[1]["id"]], 5, 2)
    mk("1v1", [players[0]["id"]], [players[2]["id"]], 3, 5)
    # 2v2: 3
    mk("2v2", [players[0]["id"], players[1]["id"]], [players[2]["id"], players[3]["id"]], 5, 1)
    mk("2v2", [players[0]["id"], players[2]["id"]], [players[1]["id"], players[3]["id"]], 2, 5)
    mk("2v2", [players[4]["id"], players[5]["id"]], [players[0]["id"], players[1]["id"]], 5, 4)
    # 3v3: 2
    mk("3v3", [players[0]["id"], players[1]["id"], players[2]["id"]],
       [players[3]["id"], players[4]["id"], players[5]["id"]], 5, 3)
    mk("3v3", [players[0]["id"], players[3]["id"], players[4]["id"]],
       [players[1]["id"], players[2]["id"], players[5]["id"]], 2, 5)

    yield {"season_id": sid, "players": players,
           "counts": {"1v1": 2, "2v2": 3, "3v3": 2}}

    # Cleanup
    api_client.delete(f"{BASE_URL}/api/seasons/{sid}")
    for p in players:
        api_client.delete(f"{BASE_URL}/api/players/{p['id']}")


def test_leaderboard_no_format(api_client, seeded_season):
    r = api_client.get(f"{BASE_URL}/api/stats/leaderboard",
                       params={"season_id": seeded_season["season_id"]})
    assert r.status_code == 200
    rows = r.json()
    # P0 is in all 7 matches
    p0 = next(r for r in rows if r["player_id"] == seeded_season["players"][0]["id"])
    assert p0["wins"] + p0["losses"] == 7


@pytest.mark.parametrize("fmt", ["1v1", "2v2", "3v3"])
def test_leaderboard_filtered_format(api_client, seeded_season, fmt):
    sid = seeded_season["season_id"]
    r = api_client.get(f"{BASE_URL}/api/stats/leaderboard",
                       params={"season_id": sid, "format": fmt})
    assert r.status_code == 200
    rows = r.json()
    # Fetch matches of that format, compute per-player participation
    matches = api_client.get(f"{BASE_URL}/api/matches", params={"season_id": sid}).json()
    fmt_matches = [m for m in matches if m["format"] == fmt]
    assert len(fmt_matches) == seeded_season["counts"][fmt]
    expected = {}
    for m in fmt_matches:
        for p in m["players"]:
            expected[p["player_id"]] = expected.get(p["player_id"], 0) + 1
    seeded_pids = {p["id"] for p in seeded_season["players"]}
    for row in rows:
        if row["player_id"] not in seeded_pids:
            continue
        exp = expected.get(row["player_id"], 0)
        assert row["wins"] + row["losses"] == exp, (
            f"{row['name']} {fmt}: wins+losses={row['wins']+row['losses']} expected {exp}"
        )


def test_leaderboard_filter_reduces_counts(api_client, seeded_season):
    sid = seeded_season["season_id"]
    seeded_pids = {p["id"] for p in seeded_season["players"]}
    all_rows = api_client.get(f"{BASE_URL}/api/stats/leaderboard",
                              params={"season_id": sid}).json()
    all_total = sum(r["matches"] for r in all_rows if r["player_id"] in seeded_pids)
    for fmt in ("1v1", "2v2", "3v3"):
        rows = api_client.get(f"{BASE_URL}/api/stats/leaderboard",
                              params={"season_id": sid, "format": fmt}).json()
        total = sum(r["matches"] for r in rows if r["player_id"] in seeded_pids)
        assert total < all_total, f"{fmt} total {total} should be < all {all_total}"


def test_csv_filtered_filename(api_client, seeded_season):
    r = api_client.get(f"{BASE_URL}/api/exports/leaderboard.csv",
                       params={"season_id": seeded_season["season_id"], "format": "1v1"})
    assert r.status_code == 200
    cd = r.headers.get("Content-Disposition", "")
    assert "leaderboard_1v1.csv" in cd, f"CD header: {cd}"
    assert "text/csv" in r.headers.get("Content-Type", "")


def test_csv_no_format_filename(api_client, seeded_season):
    r = api_client.get(f"{BASE_URL}/api/exports/leaderboard.csv",
                       params={"season_id": seeded_season["season_id"]})
    assert r.status_code == 200
    cd = r.headers.get("Content-Disposition", "")
    assert "leaderboard.csv" in cd and "leaderboard_" not in cd, f"CD header: {cd}"


def test_csv_filter_fewer_rows_than_all(api_client, seeded_season):
    sid = seeded_season["season_id"]
    r_all = api_client.get(f"{BASE_URL}/api/exports/leaderboard.csv",
                           params={"season_id": sid})
    r_1v1 = api_client.get(f"{BASE_URL}/api/exports/leaderboard.csv",
                           params={"season_id": sid, "format": "1v1"})
    # Content should differ (different stats)
    assert r_all.text != r_1v1.text

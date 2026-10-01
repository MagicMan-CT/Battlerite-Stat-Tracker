from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal
from itertools import combinations, permutations

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# --------- Mongo ---------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# --------- App ---------
app = FastAPI(title="Battlerite Arena Tracker")
api_router = APIRouter(prefix="/api")

# --------- Constants ---------
JWT_ALGORITHM = "HS256"
K_FACTOR = 32
BASE_MMR = 1200

CHAMPIONS = [
    # Melee
    {"name": "Bakko", "role": "Melee"},
    {"name": "Croak", "role": "Melee"},
    {"name": "Freya", "role": "Melee"},
    {"name": "Jamila", "role": "Melee"},
    {"name": "Raigon", "role": "Melee"},
    {"name": "Rook", "role": "Melee"},
    {"name": "Ruh Kaan", "role": "Melee"},
    {"name": "Shifu", "role": "Melee"},
    {"name": "Thorn", "role": "Melee"},
    # Ranged
    {"name": "Alysia", "role": "Ranged"},
    {"name": "Ashka", "role": "Ranged"},
    {"name": "Destiny", "role": "Ranged"},
    {"name": "Ezmo", "role": "Ranged"},
    {"name": "Iva", "role": "Ranged"},
    {"name": "Jade", "role": "Ranged"},
    {"name": "Jumong", "role": "Ranged"},
    {"name": "Shen Rao", "role": "Ranged"},
    {"name": "Taya", "role": "Ranged"},
    {"name": "Varesh", "role": "Ranged"},
    # Support
    {"name": "Blossom", "role": "Support"},
    {"name": "Lucie", "role": "Support"},
    {"name": "Oldur", "role": "Support"},
    {"name": "Pearl", "role": "Support"},
    {"name": "Pestilus", "role": "Support"},
    {"name": "Poloma", "role": "Support"},
    {"name": "Sirius", "role": "Support"},
    {"name": "Ulric", "role": "Support"},
    {"name": "Zander", "role": "Support"},
]


# --------- Auth Helpers ---------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# --------- Models ---------
class LoginInput(BaseModel):
    email: EmailStr
    password: str

class SeasonCreate(BaseModel):
    name: str
    end_date: Optional[str] = None  # ISO date string

class SeasonUpdate(BaseModel):
    name: Optional[str] = None
    end_date: Optional[str] = None

class PlayerCreate(BaseModel):
    name: str

class MatchPlayerInput(BaseModel):
    player_id: str
    champion: str
    role: str  # Melee/Ranged/Support
    team: Literal["A", "B"]

class MatchCreate(BaseModel):
    season_id: str
    format: Literal["1v1", "2v2", "3v3"]
    team_a_rounds: int
    team_b_rounds: int
    players: List[MatchPlayerInput]
    notes: Optional[str] = ""
    played_at: Optional[str] = None


# --------- ELO ---------
def expected_score(rating_a: float, rating_b: float) -> float:
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400.0))

def compute_elo_delta(team_a_mmr: float, team_b_mmr: float,
                     team_a_rounds: int, team_b_rounds: int) -> float:
    """Returns the ELO change for team A. Team B gets the negative."""
    if team_a_rounds == team_b_rounds:
        return 0.0
    actual_a = 1.0 if team_a_rounds > team_b_rounds else 0.0
    exp_a = expected_score(team_a_mmr, team_b_mmr)
    round_diff = abs(team_a_rounds - team_b_rounds)
    max_rounds = max(team_a_rounds, team_b_rounds)
    multiplier = 1.0 + (round_diff / max_rounds if max_rounds else 0)
    delta = K_FACTOR * (actual_a - exp_a) * multiplier
    return delta


# --------- Startup ---------
@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.players.create_index("id", unique=True)
    await db.seasons.create_index("id", unique=True)
    await db.matches.create_index("id", unique=True)

    # Seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )

    # Seed champions
    count = await db.champions.count_documents({})
    if count == 0:
        await db.champions.insert_many([{**c} for c in CHAMPIONS])
    else:
        # Sync roster: upsert every champion + fix roles on existing docs
        for c in CHAMPIONS:
            await db.champions.update_one({"name": c["name"]}, {"$set": c}, upsert=True)
        # Migrate historical matches when a champion's role has changed
        current_roles = {c["name"]: c["role"] for c in CHAMPIONS}
        matches_cursor = db.matches.find({})
        async for m in matches_cursor:
            changed = False
            new_players = []
            for p in m["players"]:
                target = current_roles.get(p["champion"])
                if target and p.get("role") != target:
                    p = {**p, "role": target}
                    changed = True
                new_players.append(p)
            if changed:
                await db.matches.update_one({"id": m["id"]}, {"$set": {"players": new_players}})

    # Seed default season
    if await db.seasons.count_documents({}) == 0:
        await db.seasons.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Season 1",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


@app.on_event("shutdown")
async def shutdown():
    client.close()


# --------- Auth endpoints ---------
@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=True, samesite="none", max_age=7 * 24 * 3600, path="/",
    )
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "token": token}


@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# --------- Champions ---------
@api_router.get("/champions")
async def list_champions():
    docs = await db.champions.find({}, {"_id": 0}).to_list(1000)
    return sorted(docs, key=lambda x: (x["role"], x["name"]))


import re

async def check_and_close_expired_seasons():
    """Auto-close active seasons whose end_date has passed. Spawn next season."""
    now = datetime.now(timezone.utc)
    active = await db.seasons.find({"active": True, "end_date": {"$ne": None}}).to_list(100)
    for s in active:
        try:
            end = datetime.fromisoformat(s["end_date"])
        except Exception:
            continue
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        if end <= now:
            await db.seasons.update_one({"id": s["id"]}, {"$set": {
                "active": False, "closed_at": now.isoformat(),
            }})
            # Determine next season number from existing names
            all_names = [x["name"] for x in await db.seasons.find({}, {"_id": 0}).to_list(1000)]
            nums = [int(m.group(1)) for n in all_names for m in [re.match(r"^\s*Season\s+(\d+)", n or "", re.IGNORECASE)] if m]
            next_num = (max(nums) if nums else 0) + 1
            await db.seasons.insert_one({
                "id": str(uuid.uuid4()),
                "name": f"Season {next_num}",
                "active": True,
                "end_date": None,
                "created_at": now.isoformat(),
                "auto_created_from": s["id"],
            })


# --------- Seasons ---------
@api_router.get("/seasons")
async def list_seasons():
    await check_and_close_expired_seasons()
    docs = await db.seasons.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs

@api_router.post("/seasons")
async def create_season(data: SeasonCreate, user: dict = Depends(get_current_user)):
    # Deactivate others
    await db.seasons.update_many({}, {"$set": {"active": False}})
    doc = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "active": True,
        "end_date": data.end_date,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.seasons.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.patch("/seasons/{sid}")
async def update_season(sid: str, data: SeasonUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    result = await db.seasons.update_one({"id": sid}, {"$set": upd})
    if result.matched_count == 0:
        raise HTTPException(404, "Season not found")
    doc = await db.seasons.find_one({"id": sid}, {"_id": 0})
    return doc

@api_router.post("/seasons/{sid}/activate")
async def activate_season(sid: str, user: dict = Depends(get_current_user)):
    await db.seasons.update_many({}, {"$set": {"active": False}})
    result = await db.seasons.update_one({"id": sid}, {"$set": {"active": True}})
    if result.matched_count == 0:
        raise HTTPException(404, "Season not found")
    return {"ok": True}

@api_router.delete("/seasons/{sid}")
async def delete_season(sid: str, user: dict = Depends(get_current_user)):
    await db.seasons.delete_one({"id": sid})
    await db.matches.delete_many({"season_id": sid})
    return {"ok": True}


# --------- Players ---------
@api_router.get("/players")
async def list_players():
    docs = await db.players.find({}, {"_id": 0}).to_list(1000)
    return sorted(docs, key=lambda x: x["name"].lower())

@api_router.post("/players")
async def create_player(data: PlayerCreate, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.players.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.delete("/players/{pid}")
async def delete_player(pid: str, user: dict = Depends(get_current_user)):
    await db.players.delete_one({"id": pid})
    return {"ok": True}


# --------- Matches ---------
async def recompute_season_elo(season_id: str):
    """Recompute elo_delta for every match in a season in chronological order."""
    matches = await db.matches.find({"season_id": season_id}).sort("played_at", 1).to_list(10000)
    player_mmr = {}
    for m in matches:
        team_a = [p for p in m["players"] if p["team"] == "A"]
        team_b = [p for p in m["players"] if p["team"] == "B"]
        if not team_a or not team_b:
            continue
        ta_mmr = sum(player_mmr.get(p["player_id"], BASE_MMR) for p in team_a) / len(team_a)
        tb_mmr = sum(player_mmr.get(p["player_id"], BASE_MMR) for p in team_b) / len(team_b)
        delta_a = compute_elo_delta(ta_mmr, tb_mmr, m["team_a_rounds"], m["team_b_rounds"])
        new_players = []
        for p in m["players"]:
            d = delta_a if p["team"] == "A" else -delta_a
            new_players.append({**p, "elo_delta": round(d, 2)})
            player_mmr[p["player_id"]] = player_mmr.get(p["player_id"], BASE_MMR) + d
        await db.matches.update_one({"id": m["id"]}, {"$set": {
            "players": new_players,
            "team_a_mmr_before": round(ta_mmr, 2),
            "team_b_mmr_before": round(tb_mmr, 2),
            "winner_team": "A" if m["team_a_rounds"] > m["team_b_rounds"] else "B",
        }})


async def get_player_mmr(player_id: str, season_id: str) -> float:
    """Compute current MMR for a player in a season based on matches."""
    matches = await db.matches.find({"season_id": season_id}).sort("played_at", 1).to_list(10000)
    mmr = BASE_MMR
    for m in matches:
        for mp in m["players"]:
            if mp["player_id"] == player_id:
                mmr += mp.get("elo_delta", 0)
                break
    return mmr


async def _team_mmr(player_ids: List[str], season_id: str) -> float:
    if not player_ids:
        return BASE_MMR
    total = 0.0
    for pid in player_ids:
        total += await get_player_mmr(pid, season_id)
    return total / len(player_ids)


@api_router.post("/matches")
async def create_match(data: MatchCreate, user: dict = Depends(get_current_user)):
    await check_and_close_expired_seasons()
    # Validate
    team_a = [p for p in data.players if p.team == "A"]
    team_b = [p for p in data.players if p.team == "B"]
    expected = {"1v1": 1, "2v2": 2, "3v3": 3}[data.format]
    if len(team_a) != expected or len(team_b) != expected:
        raise HTTPException(400, f"Expected {expected} players per team for {data.format}")
    if data.team_a_rounds == data.team_b_rounds:
        raise HTTPException(400, "Rounds cannot be tied")
    # No duplicate players across the whole match
    pids = [p.player_id for p in data.players]
    if len(set(pids)) != len(pids):
        raise HTTPException(400, "A player can only appear once per match")
    # No duplicate champions within the same team
    for team_label, team in [("A", team_a), ("B", team_b)]:
        champs = [p.champion for p in team]
        if len(set(champs)) != len(champs):
            raise HTTPException(400, f"Team {team_label} cannot pick the same champion twice")

    season = await db.seasons.find_one({"id": data.season_id})
    if not season:
        raise HTTPException(404, "Season not found")

    # Compute team MMRs before this match
    team_a_ids = [p.player_id for p in team_a]
    team_b_ids = [p.player_id for p in team_b]
    team_a_mmr = await _team_mmr(team_a_ids, data.season_id)
    team_b_mmr = await _team_mmr(team_b_ids, data.season_id)

    delta_a = compute_elo_delta(team_a_mmr, team_b_mmr, data.team_a_rounds, data.team_b_rounds)
    delta_b = -delta_a

    players_with_delta = []
    for p in data.players:
        d = delta_a if p.team == "A" else delta_b
        players_with_delta.append({
            "player_id": p.player_id,
            "champion": p.champion,
            "role": p.role,
            "team": p.team,
            "elo_delta": round(d, 2),
        })

    doc = {
        "id": str(uuid.uuid4()),
        "season_id": data.season_id,
        "format": data.format,
        "team_a_rounds": data.team_a_rounds,
        "team_b_rounds": data.team_b_rounds,
        "winner_team": "A" if data.team_a_rounds > data.team_b_rounds else "B",
        "players": players_with_delta,
        "notes": data.notes or "",
        "played_at": data.played_at or datetime.now(timezone.utc).isoformat(),
        "team_a_mmr_before": round(team_a_mmr, 2),
        "team_b_mmr_before": round(team_b_mmr, 2),
    }
    await db.matches.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/matches")
async def list_matches(season_id: Optional[str] = None, player_id: Optional[str] = None):
    q = {}
    if season_id:
        q["season_id"] = season_id
    if player_id:
        q["players.player_id"] = player_id
    docs = await db.matches.find(q, {"_id": 0}).sort("played_at", -1).to_list(10000)
    return docs


@api_router.put("/matches/{mid}")
async def update_match(mid: str, data: MatchCreate, user: dict = Depends(get_current_user)):
    existing = await db.matches.find_one({"id": mid})
    if not existing:
        raise HTTPException(404, "Match not found")
    team_a = [p for p in data.players if p.team == "A"]
    team_b = [p for p in data.players if p.team == "B"]
    expected = {"1v1": 1, "2v2": 2, "3v3": 3}[data.format]
    if len(team_a) != expected or len(team_b) != expected:
        raise HTTPException(400, f"Expected {expected} players per team for {data.format}")
    if data.team_a_rounds == data.team_b_rounds:
        raise HTTPException(400, "Rounds cannot be tied")
    pids = [p.player_id for p in data.players]
    if len(set(pids)) != len(pids):
        raise HTTPException(400, "A player can only appear once per match")
    for team_label, team in [("A", team_a), ("B", team_b)]:
        champs = [p.champion for p in team]
        if len(set(champs)) != len(champs):
            raise HTTPException(400, f"Team {team_label} cannot pick the same champion twice")

    await db.matches.update_one({"id": mid}, {"$set": {
        "season_id": data.season_id,
        "format": data.format,
        "team_a_rounds": data.team_a_rounds,
        "team_b_rounds": data.team_b_rounds,
        "notes": data.notes or "",
        "players": [{
            "player_id": p.player_id, "champion": p.champion,
            "role": p.role, "team": p.team, "elo_delta": 0,
        } for p in data.players],
    }})
    # Recompute affected season(s)
    await recompute_season_elo(data.season_id)
    if existing["season_id"] != data.season_id:
        await recompute_season_elo(existing["season_id"])
    updated = await db.matches.find_one({"id": mid}, {"_id": 0})
    return updated


@api_router.delete("/matches/{mid}")
async def delete_match(mid: str, user: dict = Depends(get_current_user)):
    existing = await db.matches.find_one({"id": mid})
    if not existing:
        return {"ok": True}
    season_id = existing["season_id"]
    await db.matches.delete_one({"id": mid})
    await recompute_season_elo(season_id)
    return {"ok": True}


# --------- Stats ---------
@api_router.get("/stats/leaderboard")
async def leaderboard(season_id: Optional[str] = None, format: Optional[str] = None):
    if not season_id:
        s = await db.seasons.find_one({"active": True})
        if not s:
            return []
        season_id = s["id"]

    players = await db.players.find({}, {"_id": 0}).to_list(1000)
    q = {"season_id": season_id}
    if format and format in ("1v1", "2v2", "3v3"):
        q["format"] = format
    matches = await db.matches.find(q, {"_id": 0}).sort("played_at", 1).to_list(10000)

    stats = {}
    for p in players:
        stats[p["id"]] = {
            "player_id": p["id"], "name": p["name"],
            "mmr": BASE_MMR, "peak_mmr": BASE_MMR,
            "matches": 0, "wins": 0, "losses": 0,
            "rounds_won": 0, "rounds_lost": 0,
            "streak": 0,  # >0 = win streak, <0 = loss streak (current)
            "_recent": [],  # list of bools newest first for streak calc
        }

    # matches are in chronological order (played_at asc)
    for m in matches:
        for mp in m["players"]:
            if mp["player_id"] not in stats:
                continue
            s = stats[mp["player_id"]]
            s["mmr"] += mp.get("elo_delta", 0)
            s["peak_mmr"] = max(s["peak_mmr"], s["mmr"])
            s["matches"] += 1
            is_a = mp["team"] == "A"
            won = (is_a and m["team_a_rounds"] > m["team_b_rounds"]) or \
                  (not is_a and m["team_b_rounds"] > m["team_a_rounds"])
            if won:
                s["wins"] += 1
            else:
                s["losses"] += 1
            if is_a:
                s["rounds_won"] += m["team_a_rounds"]
                s["rounds_lost"] += m["team_b_rounds"]
            else:
                s["rounds_won"] += m["team_b_rounds"]
                s["rounds_lost"] += m["team_a_rounds"]
            s["_recent"].append(won)

    result = []
    for s in stats.values():
        # Compute current streak from most recent backwards
        streak = 0
        recent = list(reversed(s["_recent"]))
        if recent:
            first = recent[0]
            for r in recent:
                if r == first:
                    streak += 1
                else:
                    break
            s["streak"] = streak if first else -streak
        s.pop("_recent", None)
        s["mmr"] = round(s["mmr"], 2)
        s["peak_mmr"] = round(s["peak_mmr"], 2)
        s["winrate"] = round((s["wins"] / s["matches"] * 100) if s["matches"] > 0 else 0, 1)
        result.append(s)
    result.sort(key=lambda x: (-x["mmr"], -x["wins"]))
    for i, r in enumerate(result):
        r["rank"] = i + 1
    return result


@api_router.get("/stats/player/{pid}")
async def player_stats(pid: str, season_id: Optional[str] = None):
    player = await db.players.find_one({"id": pid}, {"_id": 0})
    if not player:
        raise HTTPException(404, "Player not found")

    q = {"players.player_id": pid}
    if season_id:
        q["season_id"] = season_id
    matches = await db.matches.find(q, {"_id": 0}).sort("played_at", -1).to_list(10000)

    champ_stats = {}  # champion -> wins/losses/matches
    role_stats = {"Melee": 0, "Ranged": 0, "Support": 0}
    role_wins = {"Melee": 0, "Ranged": 0, "Support": 0}
    teammates = {}  # pid -> {name, wins, losses, matches}
    opponents = {}
    total_wins = 0
    total_matches = len(matches)
    mmr = BASE_MMR
    peak = BASE_MMR
    mmr_history = []

    all_players = {p["id"]: p["name"] for p in await db.players.find({}, {"_id": 0}).to_list(1000)}

    # Iterate old->new for mmr history
    for m in reversed(matches):
        my = next((p for p in m["players"] if p["player_id"] == pid), None)
        if not my:
            continue
        won = (my["team"] == "A" and m["team_a_rounds"] > m["team_b_rounds"]) or \
              (my["team"] == "B" and m["team_b_rounds"] > m["team_a_rounds"])
        if won:
            total_wins += 1

        # Champion
        c = my["champion"]
        if c not in champ_stats:
            champ_stats[c] = {"champion": c, "role": my["role"], "matches": 0, "wins": 0}
        champ_stats[c]["matches"] += 1
        if won:
            champ_stats[c]["wins"] += 1

        # Role
        role_stats[my["role"]] += 1
        if won:
            role_wins[my["role"]] += 1

        # Teammates and opponents
        for p in m["players"]:
            if p["player_id"] == pid:
                continue
            name = all_players.get(p["player_id"], "Unknown")
            target = teammates if p["team"] == my["team"] else opponents
            if p["player_id"] not in target:
                target[p["player_id"]] = {"player_id": p["player_id"], "name": name, "matches": 0, "wins": 0}
            target[p["player_id"]]["matches"] += 1
            if won:
                target[p["player_id"]]["wins"] += 1

        mmr += my.get("elo_delta", 0)
        peak = max(peak, mmr)
        mmr_history.append({"match_id": m["id"], "mmr": round(mmr, 2), "played_at": m["played_at"]})

    fav_champs = sorted(champ_stats.values(), key=lambda x: -x["matches"])
    for c in fav_champs:
        c["winrate"] = round(c["wins"] / c["matches"] * 100, 1) if c["matches"] else 0

    def compute_rate(d):
        return round(d["wins"] / d["matches"] * 100, 1) if d["matches"] else 0

    teammate_list = list(teammates.values())
    for t in teammate_list:
        t["winrate"] = compute_rate(t)
    opponent_list = list(opponents.values())
    for o in opponent_list:
        o["winrate"] = compute_rate(o)

    # Compute current streak from most recent matches backwards
    outcomes = []  # newest first
    for m in matches:  # matches sorted DESC by played_at
        my = next((p for p in m["players"] if p["player_id"] == pid), None)
        if not my:
            continue
        won = (my["team"] == "A" and m["team_a_rounds"] > m["team_b_rounds"]) or \
              (my["team"] == "B" and m["team_b_rounds"] > m["team_a_rounds"])
        outcomes.append(won)
    streak = 0
    if outcomes:
        first = outcomes[0]
        for r in outcomes:
            if r == first:
                streak += 1
            else:
                break
        streak = streak if first else -streak

    return {
        "player": player,
        "total_matches": total_matches,
        "total_wins": total_wins,
        "total_losses": total_matches - total_wins,
        "winrate": round(total_wins / total_matches * 100, 1) if total_matches else 0,
        "mmr": round(mmr, 2),
        "peak_mmr": round(peak, 2),
        "streak": streak,
        "champions": fav_champs,
        "roles": [
            {"role": r, "matches": role_stats[r], "wins": role_wins[r],
             "winrate": round(role_wins[r] / role_stats[r] * 100, 1) if role_stats[r] else 0}
            for r in ["Melee", "Ranged", "Support"]
        ],
        "teammates": sorted(teammate_list, key=lambda x: -x["matches"]),
        "opponents": sorted(opponent_list, key=lambda x: -x["matches"]),
        "mmr_history": mmr_history,
        "recent_matches": matches[:10],
    }


@api_router.get("/stats/matrix")
async def matrix(season_id: Optional[str] = None):
    """Player vs Player matrix. Returns pairs w/ head-to-head record (as opponents)."""
    players = await db.players.find({}, {"_id": 0}).to_list(1000)
    q = {}
    if season_id:
        q["season_id"] = season_id
    matches = await db.matches.find(q, {"_id": 0}).to_list(10000)

    # matrix[a][b] = {matches, a_wins}
    m = {}
    for p in players:
        m[p["id"]] = {}
        for q_ in players:
            if p["id"] == q_["id"]:
                continue
            m[p["id"]][q_["id"]] = {"matches": 0, "wins": 0}

    for match in matches:
        team_a_ids = [p["player_id"] for p in match["players"] if p["team"] == "A"]
        team_b_ids = [p["player_id"] for p in match["players"] if p["team"] == "B"]
        a_won = match["team_a_rounds"] > match["team_b_rounds"]
        for aid in team_a_ids:
            for bid in team_b_ids:
                if aid in m and bid in m[aid]:
                    m[aid][bid]["matches"] += 1
                    if a_won:
                        m[aid][bid]["wins"] += 1
                if bid in m and aid in m[bid]:
                    m[bid][aid]["matches"] += 1
                    if not a_won:
                        m[bid][aid]["wins"] += 1

    return {"players": players, "matrix": m}


@api_router.get("/stats/champion-matrix")
async def champion_matrix(season_id: Optional[str] = None):
    """Champion vs Champion winrate when facing each other across teams."""
    q = {}
    if season_id:
        q["season_id"] = season_id
    matches = await db.matches.find(q, {"_id": 0}).to_list(10000)

    # Start from the full roster so unplayed champions still appear
    roster = await db.champions.find({}, {"_id": 0}).to_list(1000)
    role_by_name = {c["name"]: c["role"] for c in roster}
    champions_used = set(role_by_name.keys())

    m = {}
    for match in matches:
        team_a = [p for p in match["players"] if p["team"] == "A"]
        team_b = [p for p in match["players"] if p["team"] == "B"]
        a_won = match["team_a_rounds"] > match["team_b_rounds"]
        for pa in team_a:
            for pb in team_b:
                ca, cb = pa["champion"], pb["champion"]
                champions_used.add(ca); champions_used.add(cb)
                m.setdefault(ca, {}).setdefault(cb, {"matches": 0, "wins": 0})
                m[ca][cb]["matches"] += 1
                if a_won:
                    m[ca][cb]["wins"] += 1
                m.setdefault(cb, {}).setdefault(ca, {"matches": 0, "wins": 0})
                m[cb][ca]["matches"] += 1
                if not a_won:
                    m[cb][ca]["wins"] += 1

    # Champion pick/win totals — seed with full roster so 0-pick champs are listed
    totals = {c["name"]: {"champion": c["name"], "role": c["role"], "picks": 0, "wins": 0} for c in roster}
    for match in matches:
        a_won = match["team_a_rounds"] > match["team_b_rounds"]
        for p in match["players"]:
            c = p["champion"]
            totals.setdefault(c, {"champion": c, "role": role_by_name.get(c, p["role"]), "picks": 0, "wins": 0})
            totals[c]["picks"] += 1
            won = (p["team"] == "A" and a_won) or (p["team"] == "B" and not a_won)
            if won:
                totals[c]["wins"] += 1

    for c in totals.values():
        c["winrate"] = round(c["wins"] / c["picks"] * 100, 1) if c["picks"] else 0

    return {
        "champions": sorted(list(champions_used)),
        "matrix": m,
        "totals": sorted(totals.values(), key=lambda x: (-x["picks"], x["champion"])),
    }


@api_router.get("/stats/recap")
async def recap(days: int = 7, season_id: Optional[str] = None):
    """Weekly recap: top climbers, biggest upsets, champion trends."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = {"played_at": {"$gte": cutoff}}
    if season_id:
        q["season_id"] = season_id
    matches = await db.matches.find(q, {"_id": 0}).sort("played_at", 1).to_list(10000)

    all_players = {p["id"]: p["name"] for p in await db.players.find({}, {"_id": 0}).to_list(1000)}

    # Top climbers
    climbers = {}  # pid -> {name, delta, matches, wins}
    for m in matches:
        won_a = m["team_a_rounds"] > m["team_b_rounds"]
        for p in m["players"]:
            if p["player_id"] not in climbers:
                climbers[p["player_id"]] = {
                    "player_id": p["player_id"],
                    "name": all_players.get(p["player_id"], "Unknown"),
                    "delta": 0.0, "matches": 0, "wins": 0,
                }
            c = climbers[p["player_id"]]
            c["delta"] += p.get("elo_delta", 0)
            c["matches"] += 1
            won = (p["team"] == "A" and won_a) or (p["team"] == "B" and not won_a)
            if won:
                c["wins"] += 1
    for c in climbers.values():
        c["delta"] = round(c["delta"], 2)
        c["winrate"] = round(c["wins"] / c["matches"] * 100, 1) if c["matches"] else 0

    climbers_list = sorted(climbers.values(), key=lambda x: -x["delta"])

    # Biggest upsets: matches where team with lower mmr_before won by biggest round margin
    upsets = []
    for m in matches:
        mmr_a = m.get("team_a_mmr_before", BASE_MMR)
        mmr_b = m.get("team_b_mmr_before", BASE_MMR)
        won_a = m["team_a_rounds"] > m["team_b_rounds"]
        winner_mmr = mmr_a if won_a else mmr_b
        loser_mmr = mmr_b if won_a else mmr_a
        if winner_mmr >= loser_mmr:
            continue
        upset_delta = loser_mmr - winner_mmr
        round_margin = abs(m["team_a_rounds"] - m["team_b_rounds"])
        winner_players = [all_players.get(p["player_id"], "?") for p in m["players"] if (p["team"] == "A") == won_a]
        loser_players = [all_players.get(p["player_id"], "?") for p in m["players"] if (p["team"] == "A") != won_a]
        upsets.append({
            "match_id": m["id"],
            "played_at": m["played_at"],
            "format": m["format"],
            "score": f"{m['team_a_rounds']}-{m['team_b_rounds']}",
            "winners": winner_players,
            "losers": loser_players,
            "mmr_gap": round(upset_delta, 2),
            "round_margin": round_margin,
            "upset_score": round(upset_delta + round_margin * 20, 2),
        })
    upsets.sort(key=lambda x: -x["upset_score"])

    # Champion trends
    champ_trend = {}
    for m in matches:
        won_a = m["team_a_rounds"] > m["team_b_rounds"]
        for p in m["players"]:
            c = p["champion"]
            if c not in champ_trend:
                champ_trend[c] = {"champion": c, "role": p["role"], "picks": 0, "wins": 0}
            champ_trend[c]["picks"] += 1
            won = (p["team"] == "A" and won_a) or (p["team"] == "B" and not won_a)
            if won:
                champ_trend[c]["wins"] += 1
    for c in champ_trend.values():
        c["winrate"] = round(c["wins"] / c["picks"] * 100, 1) if c["picks"] else 0

    trending = sorted(champ_trend.values(), key=lambda x: (-x["picks"], -x["winrate"]))

    return {
        "period_days": days,
        "total_matches": len(matches),
        "top_climbers": climbers_list[:10],
        "biggest_upsets": upsets[:5],
        "champion_trends": trending[:12],
    }


# --------- Matchmaking ---------
class MatchmakingRequest(BaseModel):
    player_ids: List[str]
    format: Literal["2v2", "3v3"]
    mode: Literal["mmr", "synergy", "hybrid"] = "hybrid"
    season_id: Optional[str] = None

def role_synergy_score(roles: List[str]) -> float:
    """Higher is better. Reward role coverage."""
    unique = len(set(roles))
    total = len(roles)
    # Reward diversity; penalize dupes
    return (unique / total) * 100


@api_router.post("/matchmaking/balance")
async def matchmaking(data: MatchmakingRequest, user: dict = Depends(get_current_user)):
    team_size = {"2v2": 2, "3v3": 3}[data.format]
    if len(data.player_ids) != team_size * 2:
        raise HTTPException(400, f"Need exactly {team_size * 2} players for {data.format}")

    season_id = data.season_id
    if not season_id:
        s = await db.seasons.find_one({"active": True})
        if s:
            season_id = s["id"]

    # Get player details + MMR
    players = {}
    for pid in data.player_ids:
        p = await db.players.find_one({"id": pid}, {"_id": 0})
        if not p:
            raise HTTPException(404, f"Player {pid} not found")
        p["mmr"] = await get_player_mmr(pid, season_id) if season_id else BASE_MMR
        # Determine dominant role from stats
        matches = await db.matches.find({"players.player_id": pid}, {"_id": 0}).to_list(1000)
        role_counts = {"Melee": 0, "Ranged": 0, "Support": 0}
        for m in matches:
            for mp in m["players"]:
                if mp["player_id"] == pid:
                    role_counts[mp["role"]] = role_counts.get(mp["role"], 0) + 1
        p["preferred_role"] = max(role_counts, key=role_counts.get) if any(role_counts.values()) else "Melee"
        players[pid] = p

    ids = list(players.keys())
    best = None

    for combo in combinations(ids, team_size):
        team_a = list(combo)
        team_b = [i for i in ids if i not in combo]
        # Avoid duplicate splits
        if sorted(team_a) > sorted(team_b):
            continue
        mmr_a = sum(players[i]["mmr"] for i in team_a) / team_size
        mmr_b = sum(players[i]["mmr"] for i in team_b) / team_size
        mmr_diff = abs(mmr_a - mmr_b)
        mmr_score = max(0.0, 100.0 - mmr_diff / 4.0)  # 400 diff => 0

        syn_a = role_synergy_score([players[i]["preferred_role"] for i in team_a])
        syn_b = role_synergy_score([players[i]["preferred_role"] for i in team_b])
        syn_score = (syn_a + syn_b) / 2

        if data.mode == "mmr":
            total = mmr_score
        elif data.mode == "synergy":
            total = syn_score
        else:
            total = 0.6 * mmr_score + 0.4 * syn_score

        entry = {
            "team_a": [players[i] for i in team_a],
            "team_b": [players[i] for i in team_b],
            "team_a_mmr": round(mmr_a, 2),
            "team_b_mmr": round(mmr_b, 2),
            "mmr_diff": round(mmr_diff, 2),
            "team_a_synergy": round(syn_a, 1),
            "team_b_synergy": round(syn_b, 1),
            "balance_score": round(total, 2),
            "win_probability_a": round(expected_score(mmr_a, mmr_b) * 100, 1),
        }
        if best is None or entry["balance_score"] > best["balance_score"]:
            best = entry

    return best


# --------- Include Router ---------
app.include_router(api_router)

# --------- CSV Exports ---------
import csv, io
from fastapi.responses import StreamingResponse

def _csv_response(rows: list, headers: list, filename: str):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    for r in rows:
        w.writerow(r)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})

@app.get("/api/exports/matches.csv")
async def export_matches_csv(season_id: Optional[str] = None):
    q = {}
    if season_id:
        q["season_id"] = season_id
    matches = await db.matches.find(q, {"_id": 0}).sort("played_at", -1).to_list(10000)
    players = {p["id"]: p["name"] for p in await db.players.find({}, {"_id": 0}).to_list(1000)}
    seasons = {s["id"]: s["name"] for s in await db.seasons.find({}, {"_id": 0}).to_list(1000)}
    rows = []
    for m in matches:
        for p in m["players"]:
            rows.append([
                m["played_at"], seasons.get(m["season_id"], ""), m["format"],
                f"{m['team_a_rounds']}-{m['team_b_rounds']}", m.get("winner_team", ""),
                p["team"], players.get(p["player_id"], ""),
                p["champion"], p["role"], p.get("elo_delta", 0),
                m.get("notes", ""),
            ])
    return _csv_response(rows,
        ["played_at", "season", "format", "score", "winner_team", "team", "player", "champion", "role", "elo_delta", "notes"],
        "matches.csv")

@app.get("/api/exports/leaderboard.csv")
async def export_leaderboard_csv(season_id: Optional[str] = None, format: Optional[str] = None):
    lb = await leaderboard(season_id=season_id, format=format)
    rows = [[r["rank"], r["name"], round(r["mmr"], 2), round(r["peak_mmr"], 2),
             r["wins"], r["losses"], r["winrate"], r["rounds_won"], r["rounds_lost"]] for r in lb]
    return _csv_response(rows,
        ["rank", "player", "mmr", "peak_mmr", "wins", "losses", "winrate", "rounds_won", "rounds_lost"],
        f"leaderboard{('_' + format) if format else ''}.csv")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

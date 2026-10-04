import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "@/api";
import { useAuth } from "@/AuthContext";

const DataCacheContext = createContext(null);

// How long cached data stays "fresh" before background revalidation (ms)
const STALE_AFTER = 60_000;

async function safeGet(path, params) {
  try {
    const { data } = await api.get(path, { params });
    return data;
  } catch (err) {
    console.warn(`[cache] fetch failed for ${path}:`, err?.message);
    return null;
  }
}

export function DataCacheProvider({ children }) {
  const { user } = useAuth();
  const [cache, setCache] = useState({});
  const [ready, setReady] = useState(false);
  const timestamps = useRef({});

  const setKey = useCallback((key, value) => {
    timestamps.current[key] = Date.now();
    setCache((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isStale = useCallback((key) => {
    const t = timestamps.current[key];
    return !t || Date.now() - t > STALE_AFTER;
  }, []);

  const refresh = useCallback(async (keys = null) => {
    const activeSeason = (cache.seasons || []).find((s) => s.active) || (cache.seasons || [])[0];
    const sid = activeSeason?.id;

    const tasks = [];
    const want = (k) => !keys || keys.includes(k);

    if (want("seasons")) tasks.push(safeGet("/seasons").then((d) => d && setKey("seasons", d)));
    if (want("players")) tasks.push(safeGet("/players").then((d) => d && setKey("players", d)));
    if (want("champions")) tasks.push(safeGet("/champions").then((d) => d && setKey("champions", d)));
    if (want("leaderboard") && sid) tasks.push(safeGet("/stats/leaderboard", { season_id: sid }).then((d) => d && setKey("leaderboard", d)));
    if (want("matches") && sid) tasks.push(safeGet("/matches", { season_id: sid }).then((d) => d && setKey("matches", d)));
    if (want("matrix") && sid) tasks.push(safeGet("/stats/matrix", { season_id: sid }).then((d) => d && setKey("matrix", d)));
    if (want("champion_matrix") && sid) tasks.push(safeGet("/stats/champion-matrix", { season_id: sid }).then((d) => d && setKey("champion_matrix", d)));
    if (want("recap") && sid) tasks.push(safeGet("/stats/recap", { days: 7, season_id: sid }).then((d) => d && setKey("recap", d)));

    await Promise.all(tasks);
  }, [cache.seasons, setKey]);

  // Initial prefetch on user login/guest-mode
  useEffect(() => {
    if (!user) {
      setCache({});
      timestamps.current = {};
      setReady(false);
      return;
    }
    (async () => {
      // 1) Seasons first (needed for season_id)
      const seasons = await safeGet("/seasons");
      if (seasons) setKey("seasons", seasons);
      const activeSeason = (seasons || []).find((s) => s.active) || (seasons || [])[0];
      const sid = activeSeason?.id;

      // 2) Fire everything else in parallel
      const results = await Promise.all([
        safeGet("/players"),
        safeGet("/champions"),
        sid ? safeGet("/stats/leaderboard", { season_id: sid }) : Promise.resolve(null),
        sid ? safeGet("/matches", { season_id: sid }) : Promise.resolve(null),
        sid ? safeGet("/stats/matrix", { season_id: sid }) : Promise.resolve(null),
        sid ? safeGet("/stats/champion-matrix", { season_id: sid }) : Promise.resolve(null),
        sid ? safeGet("/stats/recap", { days: 7, season_id: sid }) : Promise.resolve(null),
      ]);
      const [players, champions, leaderboard, matches, matrix, champion_matrix, recap] = results;
      if (players) setKey("players", players);
      if (champions) setKey("champions", champions);
      if (leaderboard) setKey("leaderboard", leaderboard);
      if (matches) setKey("matches", matches);
      if (matrix) setKey("matrix", matrix);
      if (champion_matrix) setKey("champion_matrix", champion_matrix);
      if (recap) setKey("recap", recap);
      setReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const value = { cache, ready, refresh, setKey, isStale };
  return <DataCacheContext.Provider value={value}>{children}</DataCacheContext.Provider>;
}

export const useDataCache = () => useContext(DataCacheContext);

import api from "@/api";

// Lightweight module-level cache so every ChampionPortrait on a page shares one fetch.
let cache = null;
let pending = null;

export function invalidateChampionStats() {
  cache = null;
  pending = null;
}

export async function getChampionStats() {
  if (cache) return cache;
  if (!pending) {
    pending = api.get("/stats/champion-matrix").then((r) => {
      const map = {};
      for (const t of r.data.totals || []) map[t.champion] = t;
      cache = map;
      return cache;
    }).catch(() => {
      pending = null;
      return {};
    });
  }
  return pending;
}

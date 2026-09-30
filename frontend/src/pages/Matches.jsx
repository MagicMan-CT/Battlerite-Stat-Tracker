import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api";
import { toast } from "sonner";
import { Trash2, Filter } from "lucide-react";
import { useAuth } from "@/AuthContext";

const roleClass = (r) => r === "Melee" ? "role-bg-melee" : r === "Ranged" ? "role-bg-ranged" : "role-bg-support";

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [players, setPlayers] = useState([]);
  const [seasonFilter, setSeasonFilter] = useState("");
  const [playerFilter, setPlayerFilter] = useState("");
  const { user } = useAuth();

  const load = async () => {
    const params = {};
    if (seasonFilter) params.season_id = seasonFilter;
    if (playerFilter) params.player_id = playerFilter;
    const m = await api.get("/matches", { params });
    setMatches(m.data);
  };

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([api.get("/seasons"), api.get("/players")]);
      setSeasons(s.data);
      setPlayers(p.data);
    })();
  }, []);

  useEffect(() => { load(); }, [seasonFilter, playerFilter]);

  const playerName = (id) => players.find((p) => p.id === id)?.name || "—";

  const del = async (id) => {
    if (!confirm("Delete this match? ELO will not be recalculated for prior matches.")) return;
    await api.delete(`/matches/${id}`);
    toast.success("Match deleted");
    load();
  };

  return (
    <div className="space-y-6" data-testid="matches-page">
      <div>
        <div className="text-xs font-mono-hud uppercase tracking-[0.3em] text-cyan-400/70 mb-2">// History Feed</div>
        <h1 className="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight">Match History</h1>
      </div>

      <div className="hud-card p-4 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-cyan-400" />
        <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} className="bg-[#121828] border border-[#1B2438] rounded px-3 py-2 text-sm" data-testid="matches-filter-season">
          <option value="">All seasons</option>
          {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)} className="bg-[#121828] border border-[#1B2438] rounded px-3 py-2 text-sm" data-testid="matches-filter-player">
          <option value="">All players</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {matches.length === 0 ? (
        <div className="hud-card p-12 text-center text-slate-500 font-mono-hud">No matches found.</div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => {
            const teamA = m.players.filter((p) => p.team === "A");
            const teamB = m.players.filter((p) => p.team === "B");
            const aWon = m.winner_team === "A";
            return (
              <div key={m.id} className="hud-card p-5" data-testid={`match-row-${m.id}`}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-mono-hud uppercase tracking-[0.15em] px-2 py-1 bg-[#0C101B] border border-[#1B2438] rounded">{m.format}</span>
                    <span className="text-[10px] font-mono-hud uppercase text-slate-500">{new Date(m.played_at).toLocaleString()}</span>
                    {m.notes && <span className="text-xs text-slate-400 italic">"{m.notes}"</span>}
                  </div>
                  {user && (
                    <button onClick={() => del(m.id)} className="text-slate-500 hover:text-[#FF2E55] text-xs flex items-center gap-1" data-testid={`match-delete-${m.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                  <div className={`p-3 rounded border ${aWon ? "border-[#00E676]/40 bg-[#00E676]/5" : "border-[#1B2438] bg-[#121828]/40"}`}>
                    {teamA.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 py-1">
                        <Link to={`/players/${p.player_id}`} className="text-sm font-medium hover:text-cyan-400 truncate">{playerName(p.player_id)}</Link>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-mono-hud text-slate-400">{p.champion}</span>
                          <span className={`text-[9px] font-mono-hud uppercase px-1.5 py-0.5 rounded border ${roleClass(p.role)}`}>{p.role.slice(0,3)}</span>
                          <span className={`text-[10px] font-mono-hud ${p.elo_delta >= 0 ? "text-[#00E676]" : "text-[#FF2E55]"}`}>{p.elo_delta >= 0 ? "+" : ""}{p.elo_delta}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <div className="font-mono-hud text-3xl md:text-4xl font-black">
                      <span className={aWon ? "text-[#00E676]" : "text-slate-400"}>{m.team_a_rounds}</span>
                      <span className="text-slate-600 mx-2">:</span>
                      <span className={!aWon ? "text-[#00E676]" : "text-slate-400"}>{m.team_b_rounds}</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded border ${!aWon ? "border-[#00E676]/40 bg-[#00E676]/5" : "border-[#1B2438] bg-[#121828]/40"}`}>
                    {teamB.map((p, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 py-1">
                        <Link to={`/players/${p.player_id}`} className="text-sm font-medium hover:text-cyan-400 truncate">{playerName(p.player_id)}</Link>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs font-mono-hud text-slate-400">{p.champion}</span>
                          <span className={`text-[9px] font-mono-hud uppercase px-1.5 py-0.5 rounded border ${roleClass(p.role)}`}>{p.role.slice(0,3)}</span>
                          <span className={`text-[10px] font-mono-hud ${p.elo_delta >= 0 ? "text-[#00E676]" : "text-[#FF2E55]"}`}>{p.elo_delta >= 0 ? "+" : ""}{p.elo_delta}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

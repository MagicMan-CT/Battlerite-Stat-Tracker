import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api";
import { Trophy, Swords, Users, Activity, Flame } from "lucide-react";

function Stat({ label, value, icon: Icon, accent = "cyan" }) {
  const color = { cyan: "text-cyan-400", amber: "text-[#FFB800]", crimson: "text-[#FF2E55]", emerald: "text-[#00E676]" }[accent];
  return (
    <div className="hud-card hud-corner p-5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs font-mono-hud uppercase tracking-[0.2em] text-slate-400">{label}</div>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className={`font-heading text-3xl md:text-4xl font-black ${color} font-mono-hud tracking-tight`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    (async () => {
      const s = await api.get("/seasons");
      setSeasons(s.data);
      const active = s.data.find((x) => x.active) || s.data[0];
      setActiveSeason(active);
      const [lb, mm, pp] = await Promise.all([
        api.get("/stats/leaderboard", { params: { season_id: active?.id } }),
        api.get("/matches", { params: { season_id: active?.id } }),
        api.get("/players"),
      ]);
      setLeaderboard(lb.data);
      setMatches(mm.data);
      setPlayers(pp.data);
    })();
  }, []);

  const totalMatches = matches.length;
  const totalRounds = matches.reduce((s, m) => s + m.team_a_rounds + m.team_b_rounds, 0);
  const topPlayer = leaderboard[0];

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <div className="text-xs font-mono-hud uppercase tracking-[0.3em] text-cyan-400/70 mb-2">// Command Center</div>
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight">Arena Telemetry</h1>
        <p className="text-slate-400 mt-2">Live competitive intel — {activeSeason ? activeSeason.name : "no active season"}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Matches" value={totalMatches} icon={Swords} accent="cyan" />
        <Stat label="Rounds Played" value={totalRounds} icon={Activity} accent="amber" />
        <Stat label="Active Players" value={players.length} icon={Users} accent="emerald" />
        <Stat label="Top ELO" value={topPlayer ? Math.round(topPlayer.mmr) : "—"} icon={Trophy} accent="crimson" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="hud-card p-6 lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-bold uppercase tracking-wide text-slate-100 flex items-center gap-2"><Swords className="w-4 h-4 text-cyan-400" /> Recent Matches</h2>
            <Link to="/matches" className="text-xs font-mono-hud uppercase text-cyan-400 hover:text-cyan-300">View all →</Link>
          </div>
          {matches.length === 0 ? (
            <div className="text-slate-500 text-sm py-6 text-center font-mono-hud">No matches logged yet. <Link to="/log" className="text-cyan-400 hover:underline">Log one</Link>.</div>
          ) : (
            <div className="space-y-2">
              {matches.slice(0, 6).map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-[#121828]/60 border border-[#1B2438] rounded hover:border-cyan-400/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono-hud uppercase tracking-[0.15em] px-2 py-1 bg-[#0C101B] border border-[#1B2438] rounded">{m.format}</span>
                    <span className="font-mono-hud text-sm">
                      <span className={m.winner_team === "A" ? "text-[#00E676]" : "text-slate-400"}>{m.team_a_rounds}</span>
                      <span className="text-slate-600 mx-2">:</span>
                      <span className={m.winner_team === "B" ? "text-[#00E676]" : "text-slate-400"}>{m.team_b_rounds}</span>
                    </span>
                  </div>
                  <span className="text-xs font-mono-hud text-slate-500">{new Date(m.played_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hud-card p-6 lg:col-span-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-bold uppercase tracking-wide text-slate-100 flex items-center gap-2"><Trophy className="w-4 h-4 text-[#FFB800]" /> Top 5 Ladder</h2>
            <Link to="/leaderboard" className="text-xs font-mono-hud uppercase text-cyan-400 hover:text-cyan-300">Full →</Link>
          </div>
          {leaderboard.length === 0 ? (
            <div className="text-slate-500 text-sm py-6 text-center font-mono-hud">No ranked players yet.</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((p) => (
                <Link key={p.player_id} to={`/players/${p.player_id}`} className="flex items-center gap-3 p-2.5 bg-[#121828]/60 border border-[#1B2438] rounded hover:border-cyan-400/40 transition-colors">
                  <span className="font-mono-hud font-extrabold text-lg text-[#FFB800] w-8">#{p.rank}</span>
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="font-mono-hud text-cyan-400 font-bold">{Math.round(p.mmr)}</span>
                  <span className="text-xs font-mono-hud text-slate-500">{p.winrate}%</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

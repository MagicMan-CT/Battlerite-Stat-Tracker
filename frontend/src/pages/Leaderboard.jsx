import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api";
import { Trophy, TrendingUp, Download } from "lucide-react";
import StreakBadge from "@/components/StreakBadge";

const tier = (mmr) => {
  if (mmr >= 1600) return { name: "Grandmaster", color: "text-[#FF2E55]", border: "border-[#FF2E55]" };
  if (mmr >= 1450) return { name: "Champion", color: "text-[#FFB800]", border: "border-[#FFB800]" };
  if (mmr >= 1300) return { name: "Diamond", color: "text-cyan-400", border: "border-cyan-400" };
  if (mmr >= 1150) return { name: "Gold", color: "text-yellow-400", border: "border-yellow-400" };
  return { name: "Silver", color: "text-slate-400", border: "border-slate-400" };
};

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState("");

  useEffect(() => {
    (async () => {
      const s = await api.get("/seasons");
      setSeasons(s.data);
      const active = s.data.find((x) => x.active) || s.data[0];
      setSeasonId(active?.id || "");
    })();
  }, []);

  useEffect(() => {
    if (!seasonId) return;
    api.get("/stats/leaderboard", { params: { season_id: seasonId } }).then((r) => setRows(r.data));
  }, [seasonId]);

  return (
    <div className="space-y-6" data-testid="leaderboard-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-mono-hud uppercase tracking-[0.3em] text-cyan-400/70 mb-2">// Rank Ladder</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight">Leaderboard</h1>
        </div>
        <div className="flex gap-2 items-end">
          <a
            href={`${process.env.REACT_APP_BACKEND_URL}/api/exports/leaderboard.csv${seasonId ? `?season_id=${seasonId}` : ""}`}
            className="btn-glow bg-cyan-400 hover:bg-cyan-300 text-black font-mono-hud font-bold uppercase tracking-wider text-xs px-4 py-2 rounded flex items-center gap-2"
            data-testid="leaderboard-export-csv"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={3} /> CSV
          </a>
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className="bg-[#121828] border border-[#1B2438] rounded px-3 py-2 text-sm" data-testid="leaderboard-season">
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="hud-card p-12 text-center text-slate-500 font-mono-hud">No ranked data.</div>
      ) : (
        <div className="hud-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#121828] border-b border-[#1B2438]">
              <tr className="text-left">
                <th className="px-4 py-3 font-mono-hud text-xs uppercase tracking-[0.15em] text-cyan-400/80">Rank</th>
                <th className="px-4 py-3 font-mono-hud text-xs uppercase tracking-[0.15em] text-cyan-400/80">Player</th>
                <th className="px-4 py-3 font-mono-hud text-xs uppercase tracking-[0.15em] text-cyan-400/80">Tier</th>
                <th className="px-4 py-3 font-mono-hud text-xs uppercase tracking-[0.15em] text-cyan-400/80 text-right">MMR</th>
                <th className="px-4 py-3 font-mono-hud text-xs uppercase tracking-[0.15em] text-cyan-400/80 text-right hidden md:table-cell">Peak</th>
                <th className="px-4 py-3 font-mono-hud text-xs uppercase tracking-[0.15em] text-cyan-400/80 text-right">W-L</th>
                <th className="px-4 py-3 font-mono-hud text-xs uppercase tracking-[0.15em] text-cyan-400/80 text-right">WR%</th>
                <th className="px-4 py-3 font-mono-hud text-xs uppercase tracking-[0.15em] text-cyan-400/80 text-right hidden md:table-cell">Rounds ±</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const t = tier(r.mmr);
                return (
                  <tr key={r.player_id} className="border-b border-[#1B2438]/60 hover:bg-[#121828]/60 transition-colors" data-testid={`leaderboard-row-${r.player_id}`}>
                    <td className="px-4 py-3 font-mono-hud font-black text-[#FFB800]">#{r.rank}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><Link to={`/players/${r.player_id}`} className="hover:text-cyan-400 font-medium">{r.name}</Link><StreakBadge streak={r.streak} /></div></td>
                    <td className="px-4 py-3"><span className={`text-[10px] font-mono-hud uppercase tracking-wider px-2 py-1 border rounded ${t.color} ${t.border}`}>{t.name}</span></td>
                    <td className="px-4 py-3 text-right font-mono-hud font-bold text-cyan-400">{Math.round(r.mmr)}</td>
                    <td className="px-4 py-3 text-right font-mono-hud text-slate-400 hidden md:table-cell">{Math.round(r.peak_mmr)}</td>
                    <td className="px-4 py-3 text-right font-mono-hud text-slate-300">{r.wins}-{r.losses}</td>
                    <td className="px-4 py-3 text-right font-mono-hud text-[#00E676]">{r.winrate}%</td>
                    <td className="px-4 py-3 text-right font-mono-hud text-slate-400 hidden md:table-cell">{r.rounds_won - r.rounds_lost >= 0 ? "+" : ""}{r.rounds_won - r.rounds_lost}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

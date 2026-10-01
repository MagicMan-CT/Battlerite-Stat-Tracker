import { useEffect, useState } from "react";
import api from "@/api";
import ChampionPortrait from "@/components/ChampionPortrait";
import { Trophy, Flame, Zap, Printer, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";

export default function Recap() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(7);
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState("");

  useEffect(() => {
    api.get("/seasons").then((r) => setSeasons(r.data));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = { days };
    if (seasonId) params.season_id = seasonId;
    api.get("/stats/recap", { params }).then((r) => setData(r.data));
  }, [days, seasonId]);

  return (
    <div className="space-y-6" data-testid="recap-page">
      <div className="flex items-end justify-between flex-wrap gap-4 print:hidden">
        <div>
          <div className="text-xs font-mono-hud uppercase tracking-[0.3em] text-cyan-400/70 mb-2">// Command Report</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight flex items-center gap-3"><Trophy className="w-8 h-8 text-[#FFB800]" /> H2H Recap</h1>
          <p className="text-slate-400 text-sm mt-2">Rolling {days}-day competitive snapshot.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <label className="block text-[10px] font-mono-hud uppercase tracking-wider text-slate-400 mb-1">Period</label>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="bg-[#121828] border border-[#1B2438] rounded px-3 py-2 text-sm" data-testid="recap-days">
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className="bg-[#121828] border border-[#1B2438] rounded px-3 py-2 text-sm" data-testid="recap-season">
            <option value="">All seasons</option>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={() => window.print()} className="btn-glow bg-cyan-400 hover:bg-cyan-300 text-black font-mono-hud font-bold uppercase tracking-wider px-4 py-2 rounded flex items-center gap-2" data-testid="recap-print">
            <Printer className="w-4 h-4" strokeWidth={3} /> Print
          </button>
        </div>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-3xl font-black uppercase text-black">Arena.OPS · {days}-Day Recap</h1>
      </div>

      {!data ? (
        <div className="text-slate-500 text-sm font-mono-hud">Loading recap…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1 print:gap-4">
          <div className="hud-card p-5 print:border print:border-black">
            <h2 className="font-heading text-xl font-black uppercase mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#00E676]" /> Top Climbers</h2>
            {data.top_climbers.length === 0 ? (
              <div className="text-slate-500 text-sm">No matches in period.</div>
            ) : (
              <div className="space-y-2">
                {data.top_climbers.map((c, i) => (
                  <div key={c.player_id} className="flex items-center gap-3 p-2 bg-[#121828]/60 border border-[#1B2438] rounded" data-testid={`recap-climber-${c.player_id}`}>
                    <span className="font-mono-hud font-black text-[#FFB800] w-6">#{i + 1}</span>
                    <Link to={`/players/${c.player_id}`} className="flex-1 font-medium hover:text-cyan-400">{c.name}</Link>
                    <span className="text-xs font-mono-hud text-slate-400">{c.wins}-{c.matches - c.wins}</span>
                    <span className={`font-mono-hud font-bold text-sm ${c.delta >= 0 ? "text-[#00E676]" : "text-[#FF2E55]"}`}>{c.delta >= 0 ? "+" : ""}{c.delta}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hud-card p-5 print:border print:border-black">
            <h2 className="font-heading text-xl font-black uppercase mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-[#FFB800]" /> Biggest Upsets</h2>
            {data.biggest_upsets.length === 0 ? (
              <div className="text-slate-500 text-sm">No notable upsets in period.</div>
            ) : (
              <div className="space-y-3">
                {data.biggest_upsets.map((u) => (
                  <div key={u.match_id} className="p-3 bg-[#121828]/60 border border-[#1B2438] rounded" data-testid={`recap-upset-${u.match_id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono-hud uppercase tracking-wider text-slate-500">{u.format} · {new Date(u.played_at).toLocaleDateString()}</span>
                      <span className="font-mono-hud text-xs text-[#FFB800] font-bold">−{u.mmr_gap} MMR gap</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-[10px] font-mono-hud uppercase text-[#00E676]">Winners</div>
                        <div className="text-sm font-medium">{u.winners.join(" · ")}</div>
                      </div>
                      <div className="font-mono-hud text-lg font-black text-[#00E676] px-2">{u.score}</div>
                      <div className="flex-1 text-right">
                        <div className="text-[10px] font-mono-hud uppercase text-[#FF2E55]">Fell</div>
                        <div className="text-sm text-slate-400">{u.losers.join(" · ")}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hud-card p-5 lg:col-span-2 print:border print:border-black">
            <h2 className="font-heading text-xl font-black uppercase mb-4 flex items-center gap-2"><Flame className="w-5 h-5 text-[#FF4655]" /> Champion Trends</h2>
            {data.champion_trends.length === 0 ? (
              <div className="text-slate-500 text-sm">No champion picks in period.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {data.champion_trends.map((c) => (
                  <div key={c.champion} className="flex items-center gap-2 p-2 bg-[#121828]/60 border border-[#1B2438] rounded" data-testid={`recap-trend-${c.champion}`}>
                    <ChampionPortrait name={c.champion} role={c.role} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{c.champion}</div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono-hud">
                        <span className="text-slate-500">{c.picks}p</span>
                        <span className={c.winrate >= 50 ? "text-[#00E676]" : "text-[#FF2E55]"}>{c.winrate}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hud-card p-4 lg:col-span-2 text-center font-mono-hud text-xs text-slate-500 print:text-black">
            {data.total_matches} matches analyzed · Generated {new Date().toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

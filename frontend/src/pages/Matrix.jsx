import { useEffect, useState } from "react";
import api from "@/api";
import { Grid3x3 } from "lucide-react";

export default function Matrix() {
  const [data, setData] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState("");
  const [highlight, setHighlight] = useState(null);

  useEffect(() => {
    (async () => {
      const s = await api.get("/seasons");
      setSeasons(s.data);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = {};
    if (seasonId) params.season_id = seasonId;
    api.get("/stats/matrix", { params }).then((r) => setData(r.data));
  }, [seasonId]);

  const cellColor = (wr, matches) => {
    if (matches === 0) return "bg-[#121828] text-slate-600";
    if (wr >= 60) return "bg-[#00E676]/20 text-[#00E676]";
    if (wr >= 50) return "bg-cyan-400/10 text-cyan-400";
    if (wr >= 40) return "bg-[#FFB800]/10 text-[#FFB800]";
    return "bg-[#FF2E55]/20 text-[#FF2E55]";
  };

  return (
    <div className="space-y-6" data-testid="matrix-page">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-mono-hud uppercase tracking-[0.3em] text-cyan-400/70 mb-2">// Head-to-Head</div>
          <h1 className="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight flex items-center gap-3"><Grid3x3 className="w-8 h-8 text-cyan-400" /> PvP Matrix</h1>
          <p className="text-slate-400 text-sm mt-2">Row player's winrate when facing each column opponent.</p>
        </div>
        <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className="bg-[#121828] border border-[#1B2438] rounded px-3 py-2 text-sm" data-testid="matrix-season">
          <option value="">All seasons</option>
          {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {!data || data.players.length === 0 ? (
        <div className="hud-card p-12 text-center text-slate-500 font-mono-hud">No player data.</div>
      ) : (
        <div className="hud-card p-4 overflow-x-auto">
          {highlight && (
            <div className="mb-3 flex items-center gap-2 text-xs font-mono-hud">
              <span className="text-slate-400 uppercase tracking-wider">Highlighted:</span>
              <span className="text-cyan-400 font-bold">{data.players.find((p) => p.id === highlight)?.name}</span>
              <button onClick={() => setHighlight(null)} className="text-slate-500 hover:text-[#FF2E55] underline" data-testid="matrix-clear-highlight">clear</button>
            </div>
          )}
          <table className="min-w-full text-xs font-mono-hud">
            <thead>
              <tr>
                <th className="p-2 text-left text-cyan-400/80 uppercase tracking-wider sticky left-0 bg-[#0C101B] z-10">vs →</th>
                {data.players.map((p) => (
                  <th
                    key={p.id}
                    onClick={() => setHighlight(highlight === p.id ? null : p.id)}
                    className={`p-2 text-center uppercase tracking-wider min-w-[80px] cursor-pointer select-none transition-colors ${highlight === p.id ? "bg-cyan-400/15 text-cyan-300" : "text-cyan-400/80 hover:bg-[#121828]"}`}
                    data-testid={`matrix-col-header-${p.id}`}
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.players.map((row) => (
                <tr key={row.id} className={highlight === row.id ? "bg-cyan-400/10" : ""}>
                  <td
                    onClick={() => setHighlight(highlight === row.id ? null : row.id)}
                    className={`p-2 font-bold sticky left-0 z-10 border-r border-[#1B2438] cursor-pointer select-none transition-colors ${highlight === row.id ? "bg-cyan-400/15 text-cyan-300" : "bg-[#0C101B] text-slate-100 hover:bg-[#121828]"}`}
                    data-testid={`matrix-row-header-${row.id}`}
                  >
                    {row.name}
                  </td>
                  {data.players.map((col) => {
                    if (row.id === col.id) return <td key={col.id} className="p-2 text-center text-slate-700">—</td>;
                    const cell = data.matrix[row.id]?.[col.id] || { matches: 0, wins: 0 };
                    const wr = cell.matches ? Math.round((cell.wins / cell.matches) * 100) : 0;
                    const dim = highlight && highlight !== row.id && highlight !== col.id ? "opacity-30" : "";
                    return (
                      <td key={col.id} className={`p-2 text-center ${cellColor(wr, cell.matches)} ${dim}`} data-testid={`matrix-cell-${row.id}-${col.id}`}>
                        {cell.matches === 0 ? (
                          <span className="text-slate-600">—</span>
                        ) : (
                          <>
                            <div className="font-bold">{wr}%</div>
                            <div className="text-[9px] opacity-70">{cell.wins}-{cell.matches - cell.wins}</div>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

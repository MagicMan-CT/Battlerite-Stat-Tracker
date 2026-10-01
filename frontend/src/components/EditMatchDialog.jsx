import { useEffect, useState } from "react";
import api from "@/api";
import { toast } from "sonner";
import { X, Save } from "lucide-react";

const roleClass = (r) => r === "Melee" ? "role-bg-melee" : r === "Ranged" ? "role-bg-ranged" : "role-bg-support";

export default function EditMatchDialog({ match, onClose, onSaved }) {
  const [seasons, setSeasons] = useState([]);
  const [players, setPlayers] = useState([]);
  const [champions, setChampions] = useState([]);
  const [format, setFormat] = useState(match.format);
  const [seasonId, setSeasonId] = useState(match.season_id);
  const [teamARounds, setTeamARounds] = useState(match.team_a_rounds);
  const [teamBRounds, setTeamBRounds] = useState(match.team_b_rounds);
  const [teamA, setTeamA] = useState(match.players.filter((p) => p.team === "A").map((p) => ({ player_id: p.player_id, champion: p.champion })));
  const [teamB, setTeamB] = useState(match.players.filter((p) => p.team === "B").map((p) => ({ player_id: p.player_id, champion: p.champion })));
  const [notes, setNotes] = useState(match.notes || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, p, c] = await Promise.all([api.get("/seasons"), api.get("/players"), api.get("/champions")]);
      setSeasons(s.data); setPlayers(p.data); setChampions(c.data);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getChampRole = (name) => champions.find((c) => c.name === name)?.role || "";

  const applyFormat = (fmt) => {
    setFormat(fmt);
    const size = { "1v1": 1, "2v2": 2, "3v3": 3 }[fmt];
    setTeamA((cur) => Array.from({ length: size }, (_, i) => cur[i] || { player_id: "", champion: "" }));
    setTeamB((cur) => Array.from({ length: size }, (_, i) => cur[i] || { player_id: "", champion: "" }));
  };

  const setSlot = (side, idx, key, val) => {
    const setter = side === "A" ? setTeamA : setTeamB;
    setter((cur) => cur.map((s, i) => i === idx ? { ...s, [key]: val } : s));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (teamARounds === teamBRounds) { toast.error("Rounds cannot be tied"); return; }
    const all = [...teamA.map((s) => ({ ...s, team: "A" })), ...teamB.map((s) => ({ ...s, team: "B" }))];
    for (const s of all) if (!s.player_id || !s.champion) { toast.error("Fill all slots"); return; }
    setSubmitting(true);
    try {
      await api.put(`/matches/${match.id}`, {
        season_id: seasonId, format, notes,
        team_a_rounds: Number(teamARounds), team_b_rounds: Number(teamBRounds),
        players: all.map((s) => ({ player_id: s.player_id, champion: s.champion, role: getChampRole(s.champion), team: s.team })),
      });
      toast.success("Match updated · ELO recomputed");
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally { setSubmitting(false); }
  };

  const renderTeam = (side, roster, color) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`font-heading text-base font-black uppercase ${color}`}>Team {side}</h4>
        <input type="number" min="0" max="20"
          value={side === "A" ? teamARounds : teamBRounds}
          onChange={(e) => (side === "A" ? setTeamARounds : setTeamBRounds)(Number(e.target.value))}
          className="w-16 bg-[#121828] border border-[#1B2438] rounded px-2 py-1 font-mono-hud text-lg font-bold text-center"
          data-testid={`edit-rounds-${side.toLowerCase()}`} />
      </div>
      <div className="space-y-2">
        {roster.map((slot, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <select value={slot.player_id} onChange={(e) => setSlot(side, i, "player_id", e.target.value)}
              className="bg-[#121828] border border-[#1B2438] rounded px-2 py-1.5 text-sm" data-testid={`edit-player-${side}-${i}`}>
              <option value="">Player…</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={slot.champion} onChange={(e) => setSlot(side, i, "champion", e.target.value)}
              className="bg-[#121828] border border-[#1B2438] rounded px-2 py-1.5 text-sm" data-testid={`edit-champion-${side}-${i}`}>
              <option value="">Champion…</option>
              {champions.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.role})</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose} data-testid="edit-match-dialog">
      <div className="hud-card hud-corner w-full max-w-3xl my-8 p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-white p-1" data-testid="edit-close"><X className="w-5 h-5" /></button>
        <h2 className="font-heading text-2xl font-black uppercase tracking-tight mb-4">Edit Match</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80 mb-1.5">Season</label>
              <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className="w-full bg-[#121828] border border-[#1B2438] rounded px-2 py-1.5 text-sm" data-testid="edit-season">
                {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80 mb-1.5">Format</label>
              <div className="flex gap-1">
                {["1v1", "2v2", "3v3"].map((f) => (
                  <button type="button" key={f} onClick={() => applyFormat(f)}
                    className={`flex-1 px-2 py-1.5 font-mono-hud text-xs uppercase rounded border ${format === f ? "bg-cyan-400 text-black border-cyan-400 font-bold" : "bg-[#121828] border-[#1B2438] text-slate-300"}`}
                    data-testid={`edit-format-${f}`}>{f}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80 mb-1.5">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-[#121828] border border-[#1B2438] rounded px-2 py-1.5 text-sm" data-testid="edit-notes" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {renderTeam("A", teamA, "text-cyan-400")}
            {renderTeam("B", teamB, "text-[#FF2E55]")}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#1B2438]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-mono-hud uppercase border border-[#1B2438] rounded hover:border-slate-400">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-glow bg-cyan-400 hover:bg-cyan-300 text-black font-mono-hud font-bold uppercase tracking-wider px-4 py-2 rounded flex items-center gap-2 disabled:opacity-60" data-testid="edit-submit">
              <Save className="w-4 h-4" strokeWidth={3} /> {submitting ? "Saving…" : "Save & Recompute"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

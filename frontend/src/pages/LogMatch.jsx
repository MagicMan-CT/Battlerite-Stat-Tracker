import { useEffect, useState } from "react";
import api from "@/api";
import { toast } from "sonner";
import { PlusCircle, Swords, Trash2 } from "lucide-react";

const roleClass = (r) => r === "Melee" ? "role-bg-melee" : r === "Ranged" ? "role-bg-ranged" : "role-bg-support";

export default function LogMatch() {
  const [seasons, setSeasons] = useState([]);
  const [players, setPlayers] = useState([]);
  const [champions, setChampions] = useState([]);
  const [format, setFormat] = useState("2v2");
  const [seasonId, setSeasonId] = useState("");
  const [teamARounds, setTeamARounds] = useState(5);
  const [teamBRounds, setTeamBRounds] = useState(3);
  const [teamA, setTeamA] = useState([{ player_id: "", champion: "" }, { player_id: "", champion: "" }]);
  const [teamB, setTeamB] = useState([{ player_id: "", champion: "" }, { player_id: "", champion: "" }]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, p, c] = await Promise.all([
        api.get("/seasons"), api.get("/players"), api.get("/champions"),
      ]);
      setSeasons(s.data);
      const active = s.data.find((x) => x.active) || s.data[0];
      setSeasonId(active?.id || "");
      setPlayers(p.data);
      setChampions(c.data);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFormat = (fmt) => {
    setFormat(fmt);
    const size = { "1v1": 1, "2v2": 2, "3v3": 3 }[fmt];
    setTeamA(Array.from({ length: size }, () => ({ player_id: "", champion: "" })));
    setTeamB(Array.from({ length: size }, () => ({ player_id: "", champion: "" })));
  };

  const getChampRole = (name) => champions.find((c) => c.name === name)?.role || "";

  const setSlot = (team, idx, key, val) => {
    const setter = team === "A" ? setTeamA : setTeamB;
    const arr = team === "A" ? [...teamA] : [...teamB];
    arr[idx] = { ...arr[idx], [key]: val };
    setter(arr);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (teamARounds === teamBRounds) { toast.error("Rounds cannot be tied"); return; }
    const allSlots = [...teamA.map((s, i) => ({ ...s, team: "A" })), ...teamB.map((s, i) => ({ ...s, team: "B" }))];
    for (const s of allSlots) {
      if (!s.player_id || !s.champion) { toast.error("Fill all player/champion slots"); return; }
    }
    setSubmitting(true);
    try {
      const payload = {
        season_id: seasonId,
        format,
        team_a_rounds: Number(teamARounds),
        team_b_rounds: Number(teamBRounds),
        notes,
        players: allSlots.map((s) => ({
          player_id: s.player_id,
          champion: s.champion,
          role: getChampRole(s.champion),
          team: s.team,
        })),
      };
      await api.post("/matches", payload);
      toast.success("Match logged");
      // Reset
      applyFormat(format);
      setTeamARounds(5); setTeamBRounds(3); setNotes("");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to log match");
    } finally {
      setSubmitting(false);
    }
  };

  const renderTeam = (label, roster, side, color) => (
    <div className={`hud-card p-5 ${side === "A" ? "" : ""}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-heading text-lg font-black uppercase tracking-wide ${color}`}>Team {label}</h3>
        <input
          type="number" min="0" max="20"
          value={side === "A" ? teamARounds : teamBRounds}
          onChange={(e) => (side === "A" ? setTeamARounds : setTeamBRounds)(Number(e.target.value))}
          className="w-20 bg-[#121828] border border-[#1B2438] focus:border-cyan-400 focus:outline-none rounded px-2 py-1.5 font-mono-hud text-2xl font-bold text-center"
          data-testid={`rounds-team-${side.toLowerCase()}`}
        />
      </div>
      <div className="space-y-3">
        {roster.map((slot, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={slot.player_id}
              onChange={(e) => setSlot(side, i, "player_id", e.target.value)}
              className="bg-[#121828] border border-[#1B2438] focus:border-cyan-400 focus:outline-none rounded px-2 py-2 text-sm"
              data-testid={`slot-player-${side}-${i}`}
            >
              <option value="">Select player…</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={slot.champion}
              onChange={(e) => setSlot(side, i, "champion", e.target.value)}
              className="bg-[#121828] border border-[#1B2438] focus:border-cyan-400 focus:outline-none rounded px-2 py-2 text-sm"
              data-testid={`slot-champion-${side}-${i}`}
            >
              <option value="">Champion…</option>
              {champions.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.role})</option>)}
            </select>
            {slot.champion && (
              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono-hud uppercase tracking-wider border rounded col-span-full sm:col-span-1 justify-self-start ${roleClass(getChampRole(slot.champion))}`}>
                {getChampRole(slot.champion)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="log-match-page">
      <div>
        <div className="text-xs font-mono-hud uppercase tracking-[0.3em] text-cyan-400/70 mb-2">// Match Recorder</div>
        <h1 className="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight">Log Match</h1>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <div className="hud-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80 mb-1.5">Season</label>
            <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className="w-full bg-[#121828] border border-[#1B2438] focus:border-cyan-400 focus:outline-none rounded px-3 py-2.5 text-sm" data-testid="log-season">
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}{s.active ? " (active)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80 mb-1.5">Format</label>
            <div className="flex gap-2">
              {["1v1", "2v2", "3v3"].map((fmt) => (
                <button type="button" key={fmt} onClick={() => applyFormat(fmt)}
                  className={`flex-1 px-3 py-2 font-mono-hud text-sm uppercase tracking-wider rounded border transition-colors ${format === fmt ? "bg-cyan-400 text-black border-cyan-400 font-bold" : "bg-[#121828] border-[#1B2438] text-slate-300 hover:border-cyan-400/40"}`}
                  data-testid={`format-${fmt}`}
                >{fmt}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80 mb-1.5">Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-[#121828] border border-[#1B2438] focus:border-cyan-400 focus:outline-none rounded px-3 py-2.5 text-sm" data-testid="log-notes" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderTeam("A", teamA, "A", "text-cyan-400")}
          {renderTeam("B", teamB, "B", "text-[#FF2E55]")}
        </div>

        <button type="submit" disabled={submitting} className="btn-glow bg-cyan-400 hover:bg-cyan-300 text-black font-mono-hud font-bold uppercase tracking-wider px-6 py-3 rounded flex items-center gap-2 disabled:opacity-60" data-testid="log-submit">
          <PlusCircle className="w-4 h-4" strokeWidth={3} />
          {submitting ? "Recording..." : "Record Match"}
        </button>
      </form>
    </div>
  );
}

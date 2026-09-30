import { useEffect, useState } from "react";
import api from "@/api";
import { toast } from "sonner";
import { UserPlus, Trash2, Users } from "lucide-react";

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");

  const load = async () => {
    const p = await api.get("/players");
    setPlayers(p.data);
  };
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post("/players", { name: name.trim() });
      setName("");
      toast.success("Player added");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const del = async (id) => {
    if (!confirm("Delete this player? Existing matches will keep the reference but stats may be affected.")) return;
    await api.delete(`/players/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-6" data-testid="players-page">
      <div>
        <div className="text-xs font-mono-hud uppercase tracking-[0.3em] text-cyan-400/70 mb-2">// Roster</div>
        <h1 className="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight">Players</h1>
      </div>

      <form onSubmit={add} className="hud-card p-5 flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80 mb-1.5">Player Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ezreal" className="w-full bg-[#121828] border border-[#1B2438] focus:border-cyan-400 focus:outline-none rounded px-3 py-2.5 text-sm" data-testid="player-name-input" />
        </div>
        <button type="submit" className="btn-glow bg-cyan-400 hover:bg-cyan-300 text-black font-mono-hud font-bold uppercase tracking-wider px-5 py-2.5 rounded flex items-center gap-2" data-testid="player-add-btn">
          <UserPlus className="w-4 h-4" strokeWidth={3} /> Add
        </button>
      </form>

      {players.length === 0 ? (
        <div className="hud-card p-12 text-center text-slate-500 font-mono-hud flex flex-col items-center gap-3">
          <Users className="w-8 h-8" />
          No players yet. Add one to start logging matches.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {players.map((p) => (
            <div key={p.id} className="hud-card p-4 flex items-center justify-between" data-testid={`player-card-${p.id}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#121828] border border-[#1B2438] rounded flex items-center justify-center font-mono-hud font-black text-cyan-400">
                  {p.name[0]?.toUpperCase()}
                </div>
                <a href={`/players/${p.id}`} className="font-medium hover:text-cyan-400">{p.name}</a>
              </div>
              <button onClick={() => del(p.id)} className="text-slate-500 hover:text-[#FF2E55]" data-testid={`player-delete-${p.id}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

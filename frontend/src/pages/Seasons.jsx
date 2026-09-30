import { useEffect, useState } from "react";
import api from "@/api";
import { toast } from "sonner";
import { Calendar, Plus, CheckCircle, Trash2, Pencil } from "lucide-react";
import SeasonCountdown from "@/components/SeasonCountdown";

export default function Seasons() {
  const [seasons, setSeasons] = useState([]);
  const [name, setName] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editEnd, setEditEnd] = useState("");

  const load = async () => {
    const s = await api.get("/seasons");
    setSeasons(s.data);
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const payload = { name: name.trim() };
      if (endDate) payload.end_date = new Date(endDate).toISOString();
      await api.post("/seasons", payload);
      setName(""); setEndDate("");
      toast.success("Season created and activated");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const saveEndDate = async (id) => {
    try {
      await api.patch(`/seasons/${id}`, { end_date: editEnd ? new Date(editEnd).toISOString() : null });
      toast.success("End date updated");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const activate = async (id) => {
    await api.post(`/seasons/${id}/activate`);
    toast.success("Season activated");
    load();
  };

  const del = async (id) => {
    if (!confirm("Delete this season and all its matches?")) return;
    await api.delete(`/seasons/${id}`);
    toast.success("Season deleted");
    load();
  };

  return (
    <div className="space-y-6" data-testid="seasons-page">
      <div>
        <div className="text-xs font-mono-hud uppercase tracking-[0.3em] text-cyan-400/70 mb-2">// Competitive Cycles</div>
        <h1 className="font-heading text-4xl sm:text-5xl font-black uppercase tracking-tight flex items-center gap-3"><Calendar className="w-8 h-8 text-cyan-400" /> Seasons</h1>
      </div>

      <form onSubmit={create} className="hud-card p-5 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <div>
          <label className="block text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80 mb-1.5">Season Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Season 2 - Autumn Cup" className="w-full bg-[#121828] border border-[#1B2438] focus:border-cyan-400 focus:outline-none rounded px-3 py-2.5 text-sm" data-testid="season-name-input" />
        </div>
        <div>
          <label className="block text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80 mb-1.5">End Date (optional)</label>
          <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-[#121828] border border-[#1B2438] focus:border-cyan-400 focus:outline-none rounded px-3 py-2.5 text-sm text-slate-200" data-testid="season-end-input" />
        </div>
        <button type="submit" className="btn-glow bg-cyan-400 hover:bg-cyan-300 text-black font-mono-hud font-bold uppercase tracking-wider px-5 py-2.5 rounded flex items-center gap-2" data-testid="season-add-btn">
          <Plus className="w-4 h-4" strokeWidth={3} /> Create
        </button>
      </form>

      {seasons.find((s) => s.active && s.end_date) && (
        <SeasonCountdown endDate={seasons.find((s) => s.active).end_date} seasonName={seasons.find((s) => s.active).name} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {seasons.map((s) => (
          <div key={s.id} className={`hud-card p-4 flex items-center justify-between border-2 ${s.active ? "border-cyan-400/50" : "border-[#1B2438]"}`} data-testid={`season-card-${s.id}`}>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading text-lg font-bold uppercase">{s.name}</span>
                {s.active && <span className="text-[10px] font-mono-hud uppercase tracking-wider px-2 py-0.5 bg-cyan-400/10 border border-cyan-400 text-cyan-400 rounded">ACTIVE</span>}
                {s.end_date && <SeasonCountdown endDate={s.end_date} seasonName={s.name} compact />}
              </div>
              <div className="text-xs font-mono-hud text-slate-500 mt-1">Created {new Date(s.created_at).toLocaleDateString()}{s.end_date ? ` · Ends ${new Date(s.end_date).toLocaleDateString()}` : ""}</div>
              {editingId === s.id && (
                <div className="flex gap-2 mt-2">
                  <input type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="bg-[#121828] border border-[#1B2438] rounded px-2 py-1 text-xs" data-testid={`season-edit-end-${s.id}`} />
                  <button onClick={() => saveEndDate(s.id)} className="text-xs font-mono-hud text-cyan-400 border border-cyan-400 px-2 py-1 rounded" data-testid={`season-save-end-${s.id}`}>Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-slate-500">Cancel</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditingId(s.id); setEditEnd(s.end_date ? new Date(s.end_date).toISOString().slice(0, 16) : ""); }} className="text-slate-500 hover:text-cyan-400 p-1.5" data-testid={`season-edit-${s.id}`}>
                <Pencil className="w-4 h-4" />
              </button>
              {!s.active && (
                <button onClick={() => activate(s.id)} className="text-xs font-mono-hud uppercase tracking-wider px-3 py-1.5 border border-[#1B2438] hover:border-cyan-400 hover:text-cyan-400 rounded flex items-center gap-1" data-testid={`season-activate-${s.id}`}>
                  <CheckCircle className="w-3.5 h-3.5" /> Activate
                </button>
              )}
              <button onClick={() => del(s.id)} className="text-slate-500 hover:text-[#FF2E55] p-1.5" data-testid={`season-delete-${s.id}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

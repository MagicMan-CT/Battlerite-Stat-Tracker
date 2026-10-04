import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import { Swords, Zap, Eye } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, enterGuestMode } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Access granted");
      nav("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const guest = () => {
    enterGuestMode();
    toast.success("Welcome — exploring as guest");
    nav("/");
  };

  return (
    <div className="min-h-screen bg-[#06080E] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(0,240,255,0.15), transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,184,0,0.1), transparent 50%)" }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#00F0FF 1px, transparent 1px), linear-gradient(90deg, #00F0FF 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      <div className="hud-card hud-corner w-full max-w-md p-8 relative z-10 scanlines">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center" style={{ clipPath: "polygon(15% 0, 100% 0, 85% 100%, 0 100%)" }}>
            <Swords className="w-6 h-6 text-black" strokeWidth={3} />
          </div>
          <div>
            <div className="font-heading text-2xl font-black uppercase tracking-tight leading-none">Arena<span className="text-cyan-400">.OPS</span></div>
            <div className="text-[10px] font-mono-hud text-slate-500 uppercase tracking-[0.2em] leading-none mt-1">Access Terminal</div>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight mb-1">Authenticate</h1>
          <p className="text-slate-400 text-sm">Admin credentials unlock match logging &amp; roster edits.</p>
        </div>

        <form onSubmit={submit} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#121828] border border-[#1B2438] focus:border-cyan-400 focus:outline-none rounded px-3 py-2.5 font-mono-hud text-sm text-slate-100"
              data-testid="login-email"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#121828] border border-[#1B2438] focus:border-cyan-400 focus:outline-none rounded px-3 py-2.5 font-mono-hud text-sm text-slate-100"
              data-testid="login-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-glow w-full flex items-center justify-center gap-2 bg-cyan-400 hover:bg-cyan-300 text-black font-mono-hud font-bold uppercase tracking-wider text-sm py-3 rounded disabled:opacity-60"
            data-testid="login-submit"
          >
            <Zap className="w-4 h-4" strokeWidth={3} />
            {loading ? "Authenticating..." : "Initiate Session"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-[#1B2438]" />
          <span className="text-[10px] font-mono-hud uppercase tracking-[0.25em] text-slate-500">or</span>
          <div className="h-px flex-1 bg-[#1B2438]" />
        </div>

        <button
          type="button"
          onClick={guest}
          className="group w-full flex items-center justify-center gap-2 bg-[#121828] hover:bg-[#1B2438] border border-cyan-400/30 hover:border-cyan-400 text-cyan-400 font-mono-hud font-bold uppercase tracking-wider text-sm py-3 rounded transition-colors"
          data-testid="guest-show-stats"
        >
          <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
          Show Me The Stats!
        </button>
        <p className="text-[10px] font-mono-hud text-slate-500 text-center mt-2 uppercase tracking-[0.15em]">Read-only · no account needed</p>
      </div>
    </div>
  );
}

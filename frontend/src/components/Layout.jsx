import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext";
import { Swords, Trophy, Users, Grid3x3, Sliders, Calendar, LayoutDashboard, PlusCircle, LogOut, Flame, FileBarChart2 } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/matches", label: "Matches", icon: Swords, testid: "nav-matches" },
  { to: "/log", label: "Log Match", icon: PlusCircle, testid: "nav-log" },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy, testid: "nav-leaderboard" },
  { to: "/players", label: "Players", icon: Users, testid: "nav-players" },
  { to: "/matrix", label: "PvP Matrix", icon: Grid3x3, testid: "nav-matrix" },
  { to: "/champions", label: "Champions", icon: Flame, testid: "nav-champions" },
  { to: "/matchmaking", label: "Matchmaking", icon: Sliders, testid: "nav-matchmaking" },
  { to: "/recap", label: "Recap", icon: FileBarChart2, testid: "nav-recap" },
  { to: "/seasons", label: "Seasons", icon: Calendar, testid: "nav-seasons" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-[#06080E] text-slate-100 flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#06080E]/80 border-b border-[#1B2438]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center" style={{ clipPath: "polygon(15% 0, 100% 0, 85% 100%, 0 100%)" }}>
              <Swords className="w-4 h-4 text-black" strokeWidth={3} />
            </div>
            <div>
              <div className="font-heading text-lg font-black uppercase tracking-tight leading-none">Arena<span className="text-cyan-400">.OPS</span></div>
              <div className="text-[10px] font-mono-hud text-slate-500 uppercase tracking-[0.2em] leading-none mt-0.5">Battlerite Tracker</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline font-mono-hud text-xs text-slate-400" data-testid="nav-user-email">{user?.email}</span>
            <button
              onClick={async () => { await logout(); nav("/login"); }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono-hud uppercase tracking-wider text-slate-300 border border-[#1B2438] hover:border-crimson-500 hover:text-[#FF2E55] rounded transition-colors"
              data-testid="nav-logout"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
        <nav className="border-t border-[#1B2438]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                data-testid={l.testid}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-xs font-mono-hud uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? "text-cyan-400 border-cyan-400"
                      : "text-slate-400 border-transparent hover:text-slate-100"
                  }`
                }
              >
                <l.icon className="w-3.5 h-3.5" />
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

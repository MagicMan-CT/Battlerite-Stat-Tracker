import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useDataCache } from "@/DataCacheContext";
import ChampionPortrait from "@/components/ChampionPortrait";

const roleRing = (r) => r === "Melee" ? "ring-[#FF4655]/60" : r === "Ranged" ? "ring-cyan-400/60" : "ring-[#00E676]/60";

/**
 * Little visual tiles that preview what's on a given page.
 * They read from the shared DataCacheContext so no extra network calls happen.
 */
function MiniStat({ label, value, color = "text-cyan-400" }) {
  return (
    <div className="bg-[#121828]/80 border border-[#1B2438] rounded p-2 flex-1 min-w-0">
      <div className="text-[8px] font-mono-hud uppercase tracking-wider text-slate-500 truncate">{label}</div>
      <div className={`font-mono-hud text-base font-black ${color} truncate`}>{value ?? "—"}</div>
    </div>
  );
}

function DashboardPreview({ cache }) {
  const lb = cache.leaderboard || [];
  const matches = cache.matches || [];
  const totalRounds = matches.reduce((s, m) => s + m.team_a_rounds + m.team_b_rounds, 0);
  const top = lb[0];
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <MiniStat label="Matches" value={matches.length} />
        <MiniStat label="Rounds" value={totalRounds} color="text-[#FFB800]" />
        <MiniStat label="Top MMR" value={top ? Math.round(top.mmr) : "—"} color="text-[#FF2E55]" />
      </div>
      <div className="text-[9px] font-mono-hud text-slate-500 uppercase tracking-wider text-center">Command Center · live telemetry</div>
    </div>
  );
}

function MatchesPreview({ cache }) {
  const matches = (cache.matches || []).slice(0, 3);
  if (matches.length === 0) return <div className="text-xs text-slate-500 font-mono-hud">No matches logged yet.</div>;
  return (
    <div className="space-y-1.5">
      {matches.map((m) => (
        <div key={m.id} className="flex items-center justify-between bg-[#121828]/60 border border-[#1B2438] rounded px-2 py-1.5">
          <span className="text-[9px] font-mono-hud uppercase tracking-wider px-1.5 py-0.5 bg-[#0C101B] border border-[#1B2438] rounded">{m.format}</span>
          <span className="font-mono-hud text-xs">
            <span className={m.winner_team === "A" ? "text-[#00E676]" : "text-slate-400"}>{m.team_a_rounds}</span>
            <span className="text-slate-600 mx-1.5">:</span>
            <span className={m.winner_team === "B" ? "text-[#00E676]" : "text-slate-400"}>{m.team_b_rounds}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function LeaderboardPreview({ cache }) {
  const lb = (cache.leaderboard || []).slice(0, 3);
  if (lb.length === 0) return <div className="text-xs text-slate-500 font-mono-hud">No ranked players yet.</div>;
  return (
    <div className="space-y-1.5">
      {lb.map((p) => (
        <div key={p.player_id} className="flex items-center gap-2 bg-[#121828]/60 border border-[#1B2438] rounded px-2 py-1.5">
          <span className="font-mono-hud font-black text-xs text-[#FFB800] w-5">#{p.rank}</span>
          <span className="flex-1 text-xs font-medium truncate">{p.name}</span>
          <span className="font-mono-hud text-xs text-cyan-400 font-bold">{Math.round(p.mmr)}</span>
        </div>
      ))}
    </div>
  );
}

function PlayersPreview({ cache }) {
  const players = (cache.players || []).slice(0, 5);
  if (players.length === 0) return <div className="text-xs text-slate-500 font-mono-hud">No players yet.</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {players.map((p) => (
        <span key={p.id} className="text-[10px] font-mono-hud bg-[#121828] border border-[#1B2438] rounded px-2 py-1">{p.name}</span>
      ))}
      {(cache.players || []).length > 5 && (
        <span className="text-[10px] font-mono-hud text-slate-500 px-1 self-center">+{cache.players.length - 5}</span>
      )}
    </div>
  );
}

function LogMatchPreview() {
  return (
    <div className="space-y-2">
      <div className="flex gap-1 items-center">
        <div className="flex-1 h-2 rounded bg-[#00E676]/60" />
        <span className="text-[9px] font-mono-hud text-slate-400">vs</span>
        <div className="flex-1 h-2 rounded bg-[#FF2E55]/60" />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[1, 2, 3].map((i) => <div key={`a-${i}`} className="h-6 rounded bg-[#121828] border border-cyan-400/20" />)}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[1, 2, 3].map((i) => <div key={`b-${i}`} className="h-6 rounded bg-[#121828] border border-[#FF2E55]/20" />)}
      </div>
      <div className="text-[9px] font-mono-hud text-slate-500 uppercase tracking-wider text-center">Log team scores, champs, roles</div>
    </div>
  );
}

function MatrixPreview({ cache }) {
  const players = (cache.matrix?.players || []).slice(0, 4);
  if (players.length < 2) return <div className="text-xs text-slate-500 font-mono-hud">Not enough data yet.</div>;
  return (
    <div className="space-y-1">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${players.length + 1}, minmax(0, 1fr))` }}>
        <div />
        {players.map((p) => <div key={p.id} className="text-[8px] font-mono-hud text-cyan-400/80 truncate text-center">{p.name.slice(0, 4)}</div>)}
        {players.map((row) => (
          <div key={`row-${row.id}`} className="contents">
            <div className="text-[8px] font-mono-hud text-slate-400 truncate">{row.name.slice(0, 4)}</div>
            {players.map((col) => {
              if (row.id === col.id) return <div key={`${row.id}-${col.id}`} className="h-4 bg-[#1B2438]/40 rounded-sm" />;
              const cell = cache.matrix?.matrix?.[row.id]?.[col.id] || { matches: 0, wins: 0 };
              const wr = cell.matches ? Math.round((cell.wins / cell.matches) * 100) : 0;
              const bg = cell.matches === 0 ? "bg-[#121828]" : wr >= 50 ? "bg-[#00E676]/30" : "bg-[#FF2E55]/30";
              return <div key={`${row.id}-${col.id}`} className={`h-4 rounded-sm ${bg}`} />;
            })}
          </div>
        ))}
      </div>
      <div className="text-[9px] font-mono-hud text-slate-500 uppercase tracking-wider text-center">H2H rivalry grid</div>
    </div>
  );
}

function ChampionsPreview({ cache }) {
  const totals = (cache.champion_matrix?.totals || []).filter((c) => c.picks > 0).slice(0, 6);
  if (totals.length === 0) {
    const roster = (cache.champions || []).slice(0, 6);
    return (
      <div className="flex gap-1.5 flex-wrap">
        {roster.map((c) => <ChampionPortrait key={c.name} name={c.name} role={c.role} size={28} disableHover />)}
      </div>
    );
  }
  return (
    <div className="flex gap-1.5 flex-wrap">
      {totals.map((c) => (
        <div key={c.champion} className="flex flex-col items-center gap-0.5">
          <ChampionPortrait name={c.champion} role={c.role} size={28} disableHover />
          <span className={`text-[9px] font-mono-hud font-bold ${c.winrate >= 50 ? "text-[#00E676]" : "text-[#FF2E55]"}`}>{c.winrate}%</span>
        </div>
      ))}
    </div>
  );
}

function MatchmakingPreview() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[9px] font-mono-hud uppercase tracking-wider">
        <span className="text-cyan-400">Team A</span>
        <span className="text-slate-500">⚖ Balance</span>
        <span className="text-[#FF2E55]">Team B</span>
      </div>
      <div className="flex gap-1.5">
        <div className="flex-1 flex gap-1">{[1, 2, 3].map((i) => <div key={i} className="flex-1 h-5 rounded bg-cyan-400/20 border border-cyan-400/40" />)}</div>
        <div className="flex-1 flex gap-1">{[1, 2, 3].map((i) => <div key={i} className="flex-1 h-5 rounded bg-[#FF2E55]/20 border border-[#FF2E55]/40" />)}</div>
      </div>
      <div className="text-[9px] font-mono-hud text-slate-500 uppercase tracking-wider text-center">Auto-balance by MMR &amp; role</div>
    </div>
  );
}

function RecapPreview({ cache }) {
  const r = cache.recap;
  if (!r || r.total_matches === 0) return <div className="text-xs text-slate-500 font-mono-hud">No activity in the last 7 days.</div>;
  const climber = r.top_climbers?.[0];
  const upset = r.biggest_upsets?.[0];
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <MiniStat label="Matches 7d" value={r.total_matches} />
        <MiniStat label="Top Climber" value={climber ? `+${Math.round(climber.delta)}` : "—"} color="text-[#00E676]" />
      </div>
      {upset && (
        <div className="text-[10px] font-mono-hud text-slate-400 bg-[#121828]/60 border border-[#1B2438] rounded px-2 py-1.5">
          <span className="text-[#FFB800]">Upset:</span> {upset.winners.slice(0, 2).join(", ")} <span className="text-slate-500">({upset.score})</span>
        </div>
      )}
    </div>
  );
}

function SeasonsPreview({ cache }) {
  const seasons = (cache.seasons || []).slice(0, 3);
  if (seasons.length === 0) return <div className="text-xs text-slate-500 font-mono-hud">No seasons.</div>;
  return (
    <div className="space-y-1.5">
      {seasons.map((s) => (
        <div key={s.id} className="flex items-center justify-between bg-[#121828]/60 border border-[#1B2438] rounded px-2 py-1.5">
          <span className="text-xs font-medium">{s.name}</span>
          {s.active && <span className="text-[9px] font-mono-hud uppercase tracking-wider text-[#00E676] border border-[#00E676]/40 bg-[#00E676]/10 px-1.5 py-0.5 rounded">Active</span>}
        </div>
      ))}
    </div>
  );
}

const PREVIEWS = {
  "/": DashboardPreview,
  "/matches": MatchesPreview,
  "/log": LogMatchPreview,
  "/leaderboard": LeaderboardPreview,
  "/players": PlayersPreview,
  "/matrix": MatrixPreview,
  "/champions": ChampionsPreview,
  "/matchmaking": MatchmakingPreview,
  "/recap": RecapPreview,
  "/seasons": SeasonsPreview,
};

const DESCRIPTIONS = {
  "/": "Live arena stats",
  "/matches": "Full match history",
  "/log": "Record a new match",
  "/leaderboard": "ELO ranking by tier",
  "/players": "Roster & profiles",
  "/matrix": "Player vs player grid",
  "/champions": "Champion winrates",
  "/matchmaking": "Balanced lobby creator",
  "/recap": "Last 7-day digest",
  "/seasons": "Season management",
};

export default function NavPreview({ to, label, children }) {
  const Preview = PREVIEWS[to];
  const { cache } = useDataCache() || { cache: {} };

  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-64 bg-[#0C101B] border-[#1B2438] text-slate-100 p-3"
        data-testid={`nav-preview-${to.replace(/\W+/g, "")}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="font-heading text-sm font-black uppercase tracking-tight text-cyan-400">{label}</div>
          <div className="text-[9px] font-mono-hud uppercase tracking-[0.15em] text-slate-500">peek</div>
        </div>
        <div className="text-[10px] font-mono-hud text-slate-400 mb-3">{DESCRIPTIONS[to]}</div>
        {Preview ? <Preview cache={cache} /> : null}
      </HoverCardContent>
    </HoverCard>
  );
}

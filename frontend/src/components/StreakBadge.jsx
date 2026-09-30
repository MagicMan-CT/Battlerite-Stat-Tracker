import { Flame, Snowflake } from "lucide-react";

export default function StreakBadge({ streak, minShow = 3, size = "sm" }) {
  if (!streak || Math.abs(streak) < minShow) return null;
  const isWin = streak > 0;
  const count = Math.abs(streak);
  const cls = size === "lg" ? "text-sm px-2 py-1" : "text-[10px] px-1.5 py-0.5";
  const iconSize = size === "lg" ? "w-3.5 h-3.5" : "w-3 h-3";
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono-hud font-bold uppercase tracking-wider border rounded ${cls} ${
        isWin
          ? "text-[#FFB800] border-[#FFB800]/50 bg-[#FFB800]/10"
          : "text-cyan-400 border-cyan-400/40 bg-cyan-400/10"
      }`}
      title={isWin ? `${count} win streak` : `${count} loss streak`}
      data-testid={`streak-badge-${isWin ? "win" : "loss"}-${count}`}
    >
      {isWin ? <Flame className={iconSize} strokeWidth={2.5} /> : <Snowflake className={iconSize} strokeWidth={2.5} />}
      {count}
    </span>
  );
}

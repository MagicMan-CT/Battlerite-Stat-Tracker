import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function timeLeft(end) {
  const diff = new Date(end).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { days, hours, mins, secs };
}

export default function SeasonCountdown({ endDate, seasonName, compact = false }) {
  const [t, setT] = useState(() => (endDate ? timeLeft(endDate) : null));

  useEffect(() => {
    if (!endDate) return;
    const id = setInterval(() => setT(timeLeft(endDate)), 1000);
    return () => clearInterval(id);
  }, [endDate]);

  if (!endDate) return null;

  const expired = t === null;
  const urgent = t && t.days < 3;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-mono-hud ${expired ? "text-[#FF2E55]" : urgent ? "text-[#FFB800]" : "text-cyan-400"}`} data-testid="season-countdown-compact">
        <Clock className="w-3 h-3" />
        {expired ? "ENDED" : `${t.days}d ${String(t.hours).padStart(2, "0")}h ${String(t.mins).padStart(2, "0")}m`}
      </span>
    );
  }

  return (
    <div className={`hud-card hud-corner p-5 relative overflow-hidden ${urgent && !expired ? "border-[#FFB800]/50" : ""}`} data-testid="season-countdown">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs font-mono-hud uppercase tracking-[0.2em] text-cyan-400/80">Season ends in</div>
          <div className="text-sm font-medium text-slate-300 mt-0.5">{seasonName}</div>
        </div>
        <Clock className={`w-5 h-5 ${expired ? "text-[#FF2E55]" : urgent ? "text-[#FFB800]" : "text-cyan-400"}`} />
      </div>
      {expired ? (
        <div className="font-heading text-3xl font-black text-[#FF2E55] uppercase tracking-tight">Season Ended</div>
      ) : (
        <div className="flex gap-3 items-baseline">
          {[
            { v: t.days, l: "days" },
            { v: t.hours, l: "hrs" },
            { v: t.mins, l: "min" },
            { v: t.secs, l: "sec" },
          ].map((x) => (
            <div key={x.l} className="text-center">
              <div className={`font-mono-hud text-3xl md:text-4xl font-black tabular-nums ${urgent ? "text-[#FFB800]" : "text-cyan-400"}`}>
                {String(x.v).padStart(2, "0")}
              </div>
              <div className="text-[10px] font-mono-hud uppercase tracking-[0.2em] text-slate-500">{x.l}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

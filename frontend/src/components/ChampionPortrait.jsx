// Stylized champion emblem - hex/octagon clipped monogram with role color.
// No external art dependency; guaranteed to render.
const ROLE_COLORS = {
  Melee:   { from: "#FF4655", to: "#7A1A24", text: "#FFD9DD" },
  Ranged:  { from: "#00F0FF", to: "#003D45", text: "#001519" },
  Support: { from: "#00E676", to: "#0A4021", text: "#001B0C" },
};

function hashHue(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export default function ChampionPortrait({ name, role, size = 32, className = "" }) {
  if (!name) return null;
  const c = ROLE_COLORS[role] || ROLE_COLORS.Melee;
  const initial = name[0]?.toUpperCase() || "?";
  const second = name[1]?.toLowerCase() || "";
  const hue = (hashHue(name) % 30) - 15; // small hue offset for variety
  return (
    <div
      className={`inline-flex items-center justify-center relative flex-shrink-0 ${className}`}
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)`,
        clipPath: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)",
        filter: `hue-rotate(${hue}deg) saturate(1.1)`,
      }}
      title={`${name} (${role})`}
    >
      <span
        className="font-heading font-black leading-none select-none"
        style={{
          color: c.text,
          fontSize: size * 0.48,
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          letterSpacing: "-0.02em",
        }}
      >
        {initial}{second}
      </span>
    </div>
  );
}

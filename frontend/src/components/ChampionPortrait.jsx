import { useState } from "react";

// Role fallback colors used if the portrait image isn't available
const ROLE_COLORS = {
  Melee:   { from: "#FF4655", to: "#7A1A24", text: "#FFD9DD" },
  Ranged:  { from: "#00F0FF", to: "#003D45", text: "#001519" },
  Support: { from: "#00E676", to: "#0A4021", text: "#001B0C" },
};

const ROLE_RING = {
  Melee: "ring-[#FF4655]/60",
  Ranged: "ring-cyan-400/60",
  Support: "ring-[#00E676]/60",
};

const slugify = (name) => name.toLowerCase().replace(/\s+/g, "-");

export default function ChampionPortrait({ name, role, size = 32, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!name) return null;

  const src = `/portraits/${slugify(name)}.png`;
  const ring = ROLE_RING[role] || ROLE_RING.Melee;

  if (!failed) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={`inline-block flex-shrink-0 rounded ring-2 ring-inset ${ring} object-cover bg-[#121828] ${className}`}
        style={{ width: size, height: size }}
        title={`${name} (${role})`}
        loading="lazy"
        data-testid={`champion-portrait-${slugify(name)}`}
      />
    );
  }

  // Fallback: stylized hex emblem when the portrait image is missing
  const c = ROLE_COLORS[role] || ROLE_COLORS.Melee;
  const initial = name[0]?.toUpperCase() || "?";
  const second = name[1]?.toLowerCase() || "";
  return (
    <div
      className={`inline-flex items-center justify-center relative flex-shrink-0 ${className}`}
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)`,
        clipPath: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)",
      }}
      title={`${name} (${role})`}
      data-testid={`champion-portrait-${slugify(name)}`}
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

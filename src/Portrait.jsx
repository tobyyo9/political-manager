// A little illustrated person for every character, drawn from their id so it never changes.
// Generic and invented: it suggests a person, not anyone's real likeness.
const SKIN = ["#f6d7c3", "#eac0a0", "#d9a37f", "#c18660", "#9c6845", "#7a4e33", "#5a3825"];
const HAIR = ["#1f1a17", "#3b2a20", "#5b3a24", "#8a5a33", "#b98a4f", "#d8c08a", "#9a9a9a", "#d9d9d9", "#6b2f1c"];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function look(id, g = "M", born = 1970, p = "D") {
  const h = hash(id), pick = (n, sh) => (h >>> sh) % n;
  const age = 2027 - (born || 1970);
  const grey = age > 66 ? 7 : age > 56 ? (pick(2, 3) ? 6 : null) : null;
  return {
    skin: SKIN[pick(SKIN.length, 0)],
    hair: HAIR[grey ?? pick(6, 5)],
    style: g === "F" ? ["bob", "long", "bun", "curly", "pixie"][pick(5, 9)] : age > 62 && pick(3, 12) === 0 ? "bald" : ["short", "side", "crop", "wave"][pick(4, 9)],
    glasses: pick(4, 14) === 0 || (age > 60 && pick(3, 16) === 0),
    beard: g !== "F" && pick(7, 18) === 0,
    suit: p === "D" ? ["#24406f", "#2f3e57", "#1f2f4a", "#374a68"][pick(4, 20)] : ["#3a3a42", "#2b2b30", "#4a3b3b", "#2e3440"][pick(4, 20)],
    tie: p === "D" ? ["#3d7bd9", "#5b9cff", "#8fb0e0"][pick(3, 22)] : ["#c8443a", "#e0574a", "#9e2f24"][pick(3, 22)],
    pin: p,
    g, lines: age > 60,
  };
}

export default function Portrait({ id, g, born, p, size = 44, ring, className = "", fix }) {
  const L = { ...look(id, g, born, p), ...(fix ? { ...fix, skin: fix.skin !== undefined ? SKIN[fix.skin] : undefined } : {}) };
  if (!L.skin) L.skin = look(id, g, born, p).skin;
  const H = L.hair;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`portrait ${className}`} role="img" aria-hidden="true" style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}>
      <rect width="64" height="64" rx="12" fill={p === "D" ? "#dfe8f6" : p === "R" ? "#f6e1de" : "#ece7da"} />
      {/* back hair */}
      {L.style === "long" && <path d="M16 30 Q14 52 22 56 L42 56 Q50 52 48 30 Z" fill={H} />}
      {L.style === "bob" && <path d="M17 28 Q15 46 22 47 L42 47 Q49 46 47 28 Z" fill={H} />}
      {/* body */}
      <path d="M8 64 Q10 47 32 45 Q54 47 56 64 Z" fill={L.suit} />
      <path d="M26 46 L32 56 L38 46 Z" fill="#f5f5f2" />
      {L.g !== "F" && <path d="M31 48 L33 48 L34.5 60 L32 63 L29.5 60 Z" fill={L.tie} />}
      {L.g === "F" && <circle cx="32" cy="50" r="1.6" fill="#d8c08a" />}
      <circle cx="44" cy="54" r="1.6" fill={L.pin === "D" ? "#5b9cff" : "#e0574a"} />
      {/* neck and head */}
      <rect x="28" y="38" width="8" height="8" rx="2" fill={L.skin} />
      <ellipse cx="32" cy="29" rx="12" ry="13.5" fill={L.skin} />
      <ellipse cx="20" cy="30" rx="2" ry="3" fill={L.skin} /><ellipse cx="44" cy="30" rx="2" ry="3" fill={L.skin} />
      {/* front hair */}
      {L.style === "short" && <path d="M20 26 Q20 13 32 13 Q44 13 44 26 Q40 19 32 19 Q24 19 20 26 Z" fill={H} />}
      {L.style === "side" && <path d="M20 27 Q19 13 33 13 Q45 14 44 25 Q36 17 26 21 Q22 23 20 27 Z" fill={H} />}
      {L.style === "crop" && <path d="M20.5 24 Q22 15 32 15 Q42 15 43.5 24 Q38 20 32 20 Q26 20 20.5 24 Z" fill={H} />}
      {L.style === "wave" && <path d="M19 27 Q17 12 32 12 Q47 12 45 27 Q43 18 37 20 Q33 16 28 20 Q22 18 19 27 Z" fill={H} />}
      {L.style === "bald" && <path d="M20 28 Q20 22 22 20 L22 30 Z M44 28 Q44 22 42 20 L42 30 Z" fill={H} />}
      {L.style === "bob" && <path d="M19 30 Q17 13 32 13 Q47 13 45 30 Q42 18 32 18 Q22 18 19 30 Z" fill={H} />}
      {L.style === "long" && <path d="M19 32 Q16 12 32 12 Q48 12 45 32 Q43 17 32 17 Q21 17 19 32 Z" fill={H} />}
      {L.style === "bun" && <><circle cx="32" cy="11" r="5" fill={H} /><path d="M20 27 Q20 14 32 14 Q44 14 44 27 Q40 18 32 18 Q24 18 20 27 Z" fill={H} /></>}
      {L.style === "curly" && <path d="M18 30 Q14 22 19 17 Q21 10 28 11 Q32 8 37 11 Q44 10 45 17 Q50 22 46 30 Q44 21 38 20 Q32 17 26 20 Q20 21 18 30 Z" fill={H} />}
      {L.style === "pixie" && <path d="M20 26 Q19 13 32 13 Q45 13 44 24 Q38 16 30 19 Q24 20 20 26 Z" fill={H} />}
      {/* face */}
      <circle cx="27.5" cy="29" r="1.3" fill="#1f1a17" /><circle cx="36.5" cy="29" r="1.3" fill="#1f1a17" />
      <path d="M25.5 25.5 Q27.5 24.5 29.5 25.5 M34.5 25.5 Q36.5 24.5 38.5 25.5" stroke={H} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d="M32 30 Q31 33.5 32.5 34" stroke="#00000033" strokeWidth="1" fill="none" />
      <path d="M28.5 37 Q32 39.5 35.5 37" stroke="#7a3b2e" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      {L.lines && <path d="M24 33 Q25 35 24.5 36.5 M40 33 Q39 35 39.5 36.5" stroke="#00000022" strokeWidth="0.8" fill="none" />}
      {L.beard && <path d="M21 33 Q22 43 32 44 Q42 43 43 33 Q40 39 32 40 Q24 39 21 33 Z" fill={H} opacity="0.9" />}
      {L.glasses && <g stroke="#2b2b30" strokeWidth="1.1" fill="none"><circle cx="27.5" cy="29" r="3.6" /><circle cx="36.5" cy="29" r="3.6" /><path d="M31.1 29 L32.9 29" /></g>}
    </svg>
  );
}

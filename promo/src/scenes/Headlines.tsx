import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { mono, serif } from "../theme";

const CLIPS = [
  { outlet: "Beltway Daily", text: "Override fails by four votes", rot: -3, x: -430, y: -290 },
  { outlet: "The Capitol Ledger", text: "Voters blame the majority for a do-nothing Congress", rot: 2, x: 400, y: -160 },
  { outlet: "The Morning Gavel", text: "Rep. Kalvert breaks with his party on tariffs", rot: -1.5, x: -380, y: -10 },
  { outlet: "The Hill Herald", text: "An old quote of yours resurfaced", rot: 3, x: 420, y: 100 },
  { outlet: "Roll Call Sheet", text: "Primary challenger files with $400K in the bank", rot: -2.5, x: -60, y: 365 },
];

export const Headlines: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, #3a2a1c 0%, #1c130c 75%)", justifyContent: "center", alignItems: "center" }}>
      {CLIPS.map((c, i) => {
        const t0 = (0.15 + i * 0.42) * fps;
        const inP = interpolate(frame, [t0, t0 + 0.45 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
        return (
          <div
            key={c.text}
            style={{
              position: "absolute", width: 860, padding: "30px 40px", backgroundColor: "#f6f1e3", boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
              borderTop: "6px double #1b1b1b",
              opacity: inP, transform: `translate(${c.x}px, ${c.y + (1 - inP) * 120}px) rotate(${c.rot}deg) scale(${1.25 - 0.25 * inP})`,
            }}
          >
            <div style={{ fontFamily: serif, fontVariant: "small-caps", fontWeight: 700, fontSize: 34, color: "#5a4a36", marginBottom: 6 }}>{c.outlet}</div>
            <div style={{ fontFamily: serif, fontWeight: 900, fontSize: 56, lineHeight: 1.08, color: "#141414" }}>{c.text}</div>
          </div>
        );
      })}
      <div
        style={{
          position: "absolute", top: 70, fontFamily: mono, fontSize: 40, letterSpacing: 8, color: "#ffcf5a", textTransform: "uppercase",
          opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        Every week makes the papers
      </div>
    </AbsoluteFill>
  );
};

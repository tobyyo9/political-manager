import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { mono, serif } from "../theme";

// Your colleagues, as covered by the papers. Each headline gets time to land.
const HEADLINES = [
  { outlet: "The Hill Herald", head: "Congressman admits to crying at a farm-bill markup", quote: "\"Ask me anything. Just not about my fantasy football team.\"" },
  { outlet: "Beltway Daily", head: "Senator launches a podcast about launching a podcast", quote: "\"Episode one is about the trailer for episode one.\"" },
  { outlet: "The Capitol Ledger", head: "Freshman replies all to the entire caucus. Twice.", quote: "\"In my defense, the button was very large.\"" },
];

export const Funny: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const per = 2.3 * fps, start = 0.35 * fps;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 55%, #3a2a1c 0%, #140d08 78%)", justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "absolute", top: 90, fontFamily: mono, fontSize: 42, letterSpacing: 8, color: "#ffcf5a", textTransform: "uppercase", opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        Meanwhile, your colleagues
      </div>
      {HEADLINES.map((h, i) => {
        const t0 = start + i * per, t1 = t0 + per;
        const inP = interpolate(frame, [t0, t0 + 0.35 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
        const outP = i === HEADLINES.length - 1 ? 0 : interpolate(frame, [t1 - 0.2 * fps, t1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const rot = [-2.5, 2, -1.5][i];
        return (
          <div
            key={h.head}
            style={{
              position: "absolute", width: 1380, padding: "46px 64px 50px", backgroundColor: "#f6f1e3", boxShadow: "0 30px 80px rgba(0,0,0,0.55)", borderTop: "10px double #1b1b1b",
              opacity: inP * (1 - outP), transform: `translate(${outP * -900}px, ${(1 - inP) * 160 + 30}px) rotate(${rot + outP * -8}deg) scale(${1.35 - 0.35 * inP})`,
            }}
          >
            <div style={{ fontFamily: serif, fontVariant: "small-caps", fontWeight: 700, fontSize: 44, color: "#6a5a44" }}>{h.outlet}</div>
            <div style={{ fontFamily: serif, fontWeight: 900, fontSize: 92, lineHeight: 1.05, color: "#141414", marginTop: 8 }}>{h.head}</div>
            <div style={{ fontFamily: serif, fontStyle: "italic", fontWeight: 700, fontSize: 48, color: "#3d3326", marginTop: 22 }}>{h.quote}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

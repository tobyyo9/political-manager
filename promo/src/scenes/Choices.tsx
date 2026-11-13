import { AbsoluteFill, Easing, Img, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { mono, sans, serif } from "../theme";

// The inbox: a colleague in trouble asks for help, and every answer has a price.
const OPTIONS = [
  { label: "Stand by them", cost: "If it gets worse, so do you" },
  { label: "Say nothing", cost: "Safe. Forgettable." },
  { label: "Call on them to step down", cost: "They'll remember" },
];

export const Choices: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#070d1d", overflow: "hidden" }}>
      <Img
        src={staticFile("shots/inbox.jpg")}
        style={{ position: "absolute", width: 1920, height: 1080, transformOrigin: "640px 400px", transform: `translate(${interpolate(frame, [0, 5 * fps], [0, -40], { extrapolateRight: "clamp" })}px, 0px) scale(${interpolate(frame, [0, 5 * fps], [1.25, 1.4], { extrapolateRight: "clamp" })})`, filter: "blur(2px) brightness(0.45)" }}
      />
      <AbsoluteFill style={{ padding: "80px 140px", flexDirection: "column" }}>
        <Interactive.Div name="Kicker" style={{ fontFamily: mono, fontSize: 40, letterSpacing: 6, color: "#ffcf5a", textTransform: "uppercase", opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          Monday, your inbox
        </Interactive.Div>
        <Interactive.Div
          name="Message"
          style={{ fontFamily: serif, fontWeight: 900, fontSize: 80, lineHeight: 1.08, color: "#ffffff", marginTop: 18, maxWidth: 1600, opacity: interpolate(frame, [0.15 * fps, 0.6 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}
        >
          A colleague in your party is caught in a scandal. "I need people standing with me."
        </Interactive.Div>
        <div style={{ display: "flex", gap: 34, marginTop: 44 }}>
          {OPTIONS.map((o, i) => {
            const t0 = (1.3 + i * 0.55) * fps;
            const pick = i === 0 && frame > 3.4 * fps;
            return (
              <div
                key={o.label}
                style={{
                  flex: 1, padding: "34px 36px", borderRadius: 18, backgroundColor: pick ? "#ffcf5a" : "rgba(246,241,227,0.96)", boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
                  opacity: interpolate(frame, [t0, t0 + 0.3 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                  transform: `translateY(${interpolate(frame, [t0, t0 + 0.45 * fps], [50, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) })}px) scale(${pick ? interpolate(frame, [3.4 * fps, 3.6 * fps], [1.08, 1.03], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1})`,
                }}
              >
                <div style={{ fontFamily: sans, fontWeight: 800, fontSize: 52, color: "#14110a", lineHeight: 1.1 }}>{o.label}</div>
                <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 36, color: "#5a4a36", marginTop: 14 }}>{o.cost}</div>
              </div>
            );
          })}
        </div>
        <Interactive.Div
          name="Stamp"
          style={{
            alignSelf: "center", marginTop: 56, fontFamily: serif, fontWeight: 900, fontSize: 72, color: "#ff6b5a", border: "8px solid #ff6b5a", padding: "8px 40px", rotate: "-3deg", letterSpacing: 2,
            opacity: interpolate(frame, [3.7 * fps, 3.85 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            scale: interpolate(frame, [3.7 * fps, 3.95 * fps], [1.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.2, 0, 0.2, 1), output: "perceptual-scale" }),
          }}
        >
          EVERY CHOICE COSTS SOMETHING
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { mono, sans, serif } from "../theme";

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 35%, #1a2a55 0%, #070d1d 72%)", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <Interactive.Div
        name="Tagline"
        style={{
          fontFamily: serif, fontWeight: 700, fontSize: 92, color: "#e8ecf5", marginBottom: 30,
          opacity: interpolate(frame, [0, 0.6 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        Washington is waiting.
      </Interactive.Div>
      <Interactive.Div
        name="Title"
        style={{
          fontFamily: serif, fontWeight: 900, fontSize: 200, color: "#ffffff", lineHeight: 1,
          opacity: interpolate(frame, [0.5 * fps, 1.1 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          scale: interpolate(frame, [0.5 * fps, 1.4 * fps], [0.92, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1), output: "perceptual-scale" }),
        }}
      >
        Political Manager
      </Interactive.Div>
      <Interactive.Div
        name="Button"
        style={{
          fontFamily: sans, fontWeight: 800, fontSize: 58, color: "#14110a", backgroundColor: "#ffcf5a", borderRadius: 999, padding: "26px 64px", marginTop: 70,
          boxShadow: "0 0 60px rgba(255,207,90,0.35)",
          opacity: interpolate(frame, [1.3 * fps, 1.8 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          scale: interpolate(frame, [1.3 * fps, 1.9 * fps], [0.85, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.spring({ damping: 12 }), output: "perceptual-scale" }),
        }}
      >
        Play free in your browser
      </Interactive.Div>
      <Interactive.Div
        name="Footnote"
        style={{
          fontFamily: mono, fontSize: 30, letterSpacing: 4, color: "#9aa6c4", marginTop: 50, textTransform: "uppercase",
          opacity: interpolate(frame, [1.8 * fps, 2.3 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        House · Senate · White House · Cabinet · Governor
      </Interactive.Div>
    </AbsoluteFill>
  );
};

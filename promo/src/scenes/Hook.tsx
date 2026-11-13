import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { mono, serif } from "../theme";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hours = Math.max(0, Math.round(interpolate(frame, [0.6 * fps, 2.2 * fps], [50, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.5, 0, 0.2, 1) })));
  return (
    <AbsoluteFill style={{ backgroundColor: "#070d1d", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 36 }}>
      <Interactive.Div
        name="Kicker"
        style={{
          fontFamily: mono, fontSize: 40, letterSpacing: 8, color: "#ffcf5a", textTransform: "uppercase",
          opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        Hours left this week
      </Interactive.Div>
      <Interactive.Div
        name="Hours counter"
        style={{
          fontFamily: serif, fontWeight: 900, fontSize: 340, lineHeight: 1, color: "#ffffff", fontVariantNumeric: "tabular-nums",
          scale: interpolate(frame, [0, 0.6 * fps], [0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1), output: "perceptual-scale" }),
          opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {hours}
      </Interactive.Div>
      <Interactive.Div
        name="Question"
        style={{
          fontFamily: serif, fontWeight: 700, fontSize: 96, color: "#e8ecf5",
          opacity: interpolate(frame, [2.1 * fps, 2.6 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          translate: interpolate(frame, [2.1 * fps, 2.7 * fps], ["0px 30px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
        }}
      >
        How did you spend them?
      </Interactive.Div>
    </AbsoluteFill>
  );
};

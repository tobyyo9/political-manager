import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { mono, serif } from "../theme";

export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #16244a 0%, #070d1d 70%)", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <Interactive.Div
        name="Rule top"
        style={{ width: interpolate(frame, [0, 0.8 * fps], [0, 900], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }), height: 4, backgroundColor: "#ffcf5a", marginBottom: 40 }}
      />
      <Interactive.Div
        name="Title"
        style={{
          fontFamily: serif, fontWeight: 900, fontSize: 190, color: "#ffffff", letterSpacing: 2, lineHeight: 1,
          opacity: interpolate(frame, [0.1 * fps, 0.7 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          scale: interpolate(frame, [0.1 * fps, 2.5 * fps], [1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1), output: "perceptual-scale" }),
        }}
      >
        Political Manager
      </Interactive.Div>
      <Interactive.Div
        name="Rule bottom"
        style={{ width: interpolate(frame, [0, 0.8 * fps], [0, 900], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }), height: 4, backgroundColor: "#ffcf5a", marginTop: 40 }}
      />
      <Interactive.Div
        name="Subtitle"
        style={{
          fontFamily: mono, fontSize: 44, letterSpacing: 6, color: "#ffcf5a", marginTop: 48, textTransform: "uppercase",
          opacity: interpolate(frame, [0.8 * fps, 1.3 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        Football Manager, but it's Congress
      </Interactive.Div>
    </AbsoluteFill>
  );
};

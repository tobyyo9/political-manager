import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { mono, sans, serif } from "../theme";

// The higher you climb, the more people go looking.
export const Knock: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shake = frame < 0.5 * fps ? Math.sin(frame * 2.3) * interpolate(frame, [0, 0.5 * fps], [14, 0], { extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#1a0606", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120, backgroundColor: "#d1302a", display: "flex", alignItems: "center", paddingLeft: 140, fontFamily: sans, fontWeight: 800, fontSize: 54, letterSpacing: 6, color: "#ffffff", opacity: (frame % 16) < 11 ? 1 : 0.75 }}>
        BREAKING
      </div>
      <Interactive.Div
        name="Headline"
        style={{
          fontFamily: serif, fontWeight: 900, fontSize: 132, lineHeight: 1.04, color: "#ffffff", textAlign: "center", maxWidth: 1600, translate: `${shake}px 0px`,
          scale: interpolate(frame, [0, 0.25 * fps], [1.3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.2, 0, 0.2, 1), output: "perceptual-scale" }),
        }}
      >
        An old quote of yours just resurfaced.
      </Interactive.Div>
      <Interactive.Div
        name="Subline"
        style={{ fontFamily: mono, fontSize: 44, letterSpacing: 4, color: "#ffb4a8", marginTop: 50, textTransform: "uppercase", opacity: interpolate(frame, [1.0 * fps, 1.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}
      >
        The higher you climb, the harder they look
      </Interactive.Div>
    </AbsoluteFill>
  );
};

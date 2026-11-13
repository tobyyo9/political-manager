import { AbsoluteFill, Easing, Img, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { mono, serif } from "../theme";

// A game screenshot with a slow push-in toward the thing that matters, and a big caption.
export type ShotProps = { src: string; fx: number; fy: number; zoom: number; kicker: string; caption: string; captionTop?: boolean; side?: boolean };

export const Shot: React.FC<ShotProps> = ({ src, fx, fy, zoom, kicker, caption, captionTop, side }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.33, 0, 0.2, 1) });
  const scale = 1.02 + (zoom - 1.02) * p;
  // Bring the focus point to the part of the frame the caption leaves free.
  const tx = ((side ? 1450 : 960) - fx) * p, ty = ((side ? 540 : captionTop ? 660 : 400) - fy) * p;
  return (
    <AbsoluteFill style={{ backgroundColor: "#070d1d", overflow: "hidden" }}>
      <Img
        src={staticFile(src)}
        style={{ position: "absolute", width: 1920, height: 1080, transformOrigin: `${fx}px ${fy}px`, transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
      />
      <AbsoluteFill
        style={{ background: side ? "linear-gradient(90deg, rgba(7,13,29,0.97) 0%, rgba(7,13,29,0.85) 34%, rgba(7,13,29,0) 50%)" : captionTop ? "linear-gradient(180deg, rgba(7,13,29,0.95) 0%, rgba(7,13,29,0.75) 30%, rgba(7,13,29,0) 55%)" : "linear-gradient(0deg, rgba(7,13,29,0.97) 0%, rgba(7,13,29,0.8) 28%, rgba(7,13,29,0) 55%)" }}
      />
      <AbsoluteFill style={{ justifyContent: side ? "center" : captionTop ? "flex-start" : "flex-end", padding: side ? "110px 1160px 110px 120px" : "110px 140px" }}>
        <Interactive.Div
          name="Kicker"
          style={{
            fontFamily: mono, fontSize: 38, letterSpacing: 6, color: "#ffcf5a", textTransform: "uppercase", marginBottom: 18,
            opacity: interpolate(frame, [0.15 * fps, 0.6 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {kicker}
        </Interactive.Div>
        <Interactive.Div
          name="Caption"
          style={{
            fontFamily: serif, fontWeight: 900, fontSize: 120, lineHeight: 1.02, color: "#ffffff", maxWidth: 1600, textShadow: "0 6px 30px rgba(0,0,0,0.5)",
            opacity: interpolate(frame, [0.25 * fps, 0.75 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [0.25 * fps, 0.9 * fps], ["0px 40px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
          }}
        >
          {caption}
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

import { Video } from "@remotion/media";
import { AbsoluteFill, Easing, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { mono, serif } from "../theme";

// Real gameplay footage, framed on the part that matters, with a caption that stays up long enough to read.
export type ClipProps = { src: string; trim: number; fx: number; fy: number; zoom: number; kicker: string; caption: string; captionTop?: boolean; push?: number };

export const Clip: React.FC<ClipProps> = ({ src, trim, fx, fy, zoom, kicker, caption, captionTop, push = 0.06 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const z = zoom + push * interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ty = (captionTop ? 640 : 420) - fy;
  return (
    <AbsoluteFill style={{ backgroundColor: "#070d1d", overflow: "hidden" }}>
      <AbsoluteFill style={{ transformOrigin: `${fx}px ${fy}px`, transform: `translate(${960 - fx}px, ${ty}px) scale(${z})` }}>
        <Video src={staticFile(src)} trimBefore={Math.round(trim * fps)} muted />
      </AbsoluteFill>
      <AbsoluteFill
        style={{ background: captionTop ? "linear-gradient(180deg, rgba(7,13,29,0.95) 0%, rgba(7,13,29,0.7) 26%, rgba(7,13,29,0) 46%)" : "linear-gradient(0deg, rgba(7,13,29,0.97) 0%, rgba(7,13,29,0.78) 26%, rgba(7,13,29,0) 48%)" }}
      />
      <AbsoluteFill style={{ justifyContent: captionTop ? "flex-start" : "flex-end", padding: "100px 140px" }}>
        <Interactive.Div
          name="Kicker"
          style={{ fontFamily: mono, fontSize: 40, letterSpacing: 6, color: "#ffcf5a", textTransform: "uppercase", marginBottom: 14, opacity: interpolate(frame, [0.2 * fps, 0.6 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}
        >
          {kicker}
        </Interactive.Div>
        <Interactive.Div
          name="Caption"
          style={{
            fontFamily: serif, fontWeight: 900, fontSize: 124, lineHeight: 1.02, color: "#ffffff", textShadow: "0 6px 30px rgba(0,0,0,0.55)",
            opacity: interpolate(frame, [0.3 * fps, 0.8 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [0.3 * fps, 0.95 * fps], ["0px 40px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }),
          }}
        >
          {caption}
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

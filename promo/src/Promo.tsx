import { Audio } from "@remotion/media";
import { Series, staticFile } from "remotion";
import { Hook } from "./scenes/Hook";
import { TitleCard } from "./scenes/TitleCard";
import { Shot } from "./scenes/Shot";
import { Clip } from "./scenes/Clip";
import { Choices } from "./scenes/Choices";
import { Funny } from "./scenes/Funny";
import { Knock } from "./scenes/Knock";
import { EndCard } from "./scenes/EndCard";

// Scene starts are fixed so the soundtrack (tools/soundtrack.py) lands its hits on the cuts.
export const Promo: React.FC = () => (
  <>
    <Series>
      <Series.Sequence name="Hook" durationInFrames={105}>
        <Hook />
      </Series.Sequence>
      <Series.Sequence name="Week turns" durationInFrames={90}>
        <Clip src="clips/weekturn.mp4" trim={0.15} fx={960} fy={540} zoom={1} push={0.08} kicker="Every week" caption="A new week in Washington." />
      </Series.Sequence>
      <Series.Sequence name="Title" durationInFrames={90}>
        <TitleCard />
      </Series.Sequence>
      <Series.Sequence name="Chamber" durationInFrames={135}>
        <Shot src="shots/chamber.jpg" fx={1000} fy={560} zoom={1.45} kicker="435 House seats · 100 Senate seats" caption="Pick a seat. Any seat." captionTop />
      </Series.Sequence>
      <Series.Sequence name="Choices" durationInFrames={150}>
        <Choices />
      </Series.Sequence>
      <Series.Sequence name="Roll call" durationInFrames={180}>
        <Clip src="clips/rollcall.mp4" trim={3.0} fx={968} fy={490} zoom={1.4} kicker="Live roll call" caption="Then the votes come in." />
      </Series.Sequence>
      <Series.Sequence name="Funny headlines" durationInFrames={210}>
        <Funny />
      </Series.Sequence>
      <Series.Sequence name="Hearing scene" durationInFrames={180}>
        <Clip src="clips/scene.mp4" trim={0.3} fx={960} fy={500} zoom={1.7} kicker="Hearings, debates, press" caption="Face the cameras." />
      </Series.Sequence>
      <Series.Sequence name="Knock-down" durationInFrames={105}>
        <Knock />
      </Series.Sequence>
      <Series.Sequence name="Map" durationInFrames={105}>
        <Shot src="shots/map.jpg" fx={900} fy={700} zoom={1.3} kicker="2028" caption="Run for president." captionTop />
      </Series.Sequence>
      <Series.Sequence name="Election night" durationInFrames={150}>
        <Clip src="clips/election.mp4" trim={0.8} fx={960} fy={560} zoom={1.45} push={0.05} kicker="Election night" caption="Win it all. Or lose your seat." />
      </Series.Sequence>
      <Series.Sequence name="Governor" durationInFrames={75}>
        <Shot src="shots/gov.jpg" fx={700} fy={300} zoom={1.4} kicker="Or come home" caption="Run your state." />
      </Series.Sequence>
      <Series.Sequence name="Cabinet" durationInFrames={75}>
        <Shot src="shots/cab.jpg" fx={700} fy={300} zoom={1.4} kicker="Or take the call" caption="Join the Cabinet." />
      </Series.Sequence>
      <Series.Sequence name="End card" durationInFrames={180}>
        <EndCard />
      </Series.Sequence>
    </Series>
    <Audio src={staticFile("audio/soundtrack.wav")} />
  </>
);

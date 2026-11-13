import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Hook } from "./scenes/Hook";
import { TitleCard } from "./scenes/TitleCard";
import { Shot } from "./scenes/Shot";
import { Headlines } from "./scenes/Headlines";
import { EndCard } from "./scenes/EndCard";

export const Promo: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Hook" durationInFrames={100}>
      <Hook />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
    <TransitionSeries.Sequence name="Title" durationInFrames={80}>
      <TitleCard />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
    <TransitionSeries.Sequence name="Chamber" durationInFrames={105}>
      <Shot src="shots/chamber.jpg" fx={1000} fy={560} zoom={1.45} kicker="435 House seats · 100 Senate seats" caption="Play any one of them." captionTop />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 12 })} />
    <TransitionSeries.Sequence name="Inbox" durationInFrames={110}>
      <Shot src="shots/inbox.jpg" fx={640} fy={400} zoom={1.9} kicker="Your inbox, every Monday" caption="Every choice costs something." />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 12 })} />
    <TransitionSeries.Sequence name="Bills" durationInFrames={105}>
      <Shot src="shots/bills.jpg" fx={960} fy={740} zoom={1.6} kicker="218 to pass · 60 to break a filibuster" caption="Count the votes. Twist arms." />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 12 })} />
    <TransitionSeries.Sequence name="Card" durationInFrames={105}>
      <Shot src="shots/card.jpg" fx={1000} fy={470} zoom={1.2} kicker="Scout every member" caption="Know who you're dealing with." side />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 12 })} />
    <TransitionSeries.Sequence name="Network" durationInFrames={95}>
      <Shot src="shots/network.jpg" fx={900} fy={500} zoom={1.45} kicker="Favors, promises, grudges" caption="Keep your word. Or don't." />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 8 })} />
    <TransitionSeries.Sequence name="Map" durationInFrames={55}>
      <Shot src="shots/map.jpg" fx={900} fy={700} zoom={1.3} kicker="2028" caption="Run for president." captionTop />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 8 })} />
    <TransitionSeries.Sequence name="Governor" durationInFrames={50}>
      <Shot src="shots/gov.jpg" fx={700} fy={300} zoom={1.4} kicker="Or come home" caption="Run your state." />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 8 })} />
    <TransitionSeries.Sequence name="Cabinet" durationInFrames={50}>
      <Shot src="shots/cab.jpg" fx={700} fy={300} zoom={1.4} kicker="Or take the call" caption="Join the Cabinet." />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
    <TransitionSeries.Sequence name="Election" durationInFrames={95}>
      <Shot src="shots/end.jpg" fx={960} fy={330} zoom={1.3} kicker="Election night" caption="Win it all. Or lose your seat." />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 10 })} />
    <TransitionSeries.Sequence name="Headlines" durationInFrames={110}>
      <Headlines />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 14 })} />
    <TransitionSeries.Sequence name="End card" durationInFrames={120}>
      <EndCard />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);

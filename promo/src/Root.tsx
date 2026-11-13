import { Composition, Folder } from "remotion";
import { Promo } from "./Promo";
import { Hook } from "./scenes/Hook";
import { TitleCard } from "./scenes/TitleCard";
import { Headlines } from "./scenes/Headlines";
import { EndCard } from "./scenes/EndCard";

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Promo-Scenes">
      <Composition id="Hook" component={Hook} width={1920} height={1080} fps={30} durationInFrames={100} />
      <Composition id="TitleCard" component={TitleCard} width={1920} height={1080} fps={30} durationInFrames={80} />
      <Composition id="Headlines" component={Headlines} width={1920} height={1080} fps={30} durationInFrames={110} />
      <Composition id="EndCard" component={EndCard} width={1920} height={1080} fps={30} durationInFrames={120} />
    </Folder>
    <Composition id="Promo" component={Promo} width={1920} height={1080} fps={30} durationInFrames={1052} />
  </>
);

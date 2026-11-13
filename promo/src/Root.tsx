import { Composition, Folder } from "remotion";
import { Promo } from "./Promo";
import { Hook } from "./scenes/Hook";
import { TitleCard } from "./scenes/TitleCard";
import { Choices } from "./scenes/Choices";
import { Funny } from "./scenes/Funny";
import { Knock } from "./scenes/Knock";
import { EndCard } from "./scenes/EndCard";

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Promo-Scenes">
      <Composition id="Hook" component={Hook} width={1920} height={1080} fps={30} durationInFrames={105} />
      <Composition id="TitleCard" component={TitleCard} width={1920} height={1080} fps={30} durationInFrames={90} />
      <Composition id="Choices" component={Choices} width={1920} height={1080} fps={30} durationInFrames={150} />
      <Composition id="Funny" component={Funny} width={1920} height={1080} fps={30} durationInFrames={210} />
      <Composition id="Knock" component={Knock} width={1920} height={1080} fps={30} durationInFrames={105} />
      <Composition id="EndCard" component={EndCard} width={1920} height={1080} fps={30} durationInFrames={180} />
    </Folder>
    <Composition id="Promo" component={Promo} width={1920} height={1080} fps={30} durationInFrames={1830} />
  </>
);

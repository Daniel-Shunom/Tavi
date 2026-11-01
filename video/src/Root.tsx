import { Composition } from 'remotion';
import { FPS, HEIGHT, totalSeconds, WIDTH } from './config';
import { Trailer } from './Trailer';
import { Ad, AD_FRAMES } from './ad/Ad';
import { BrandStills } from './brand/Brand';

export function Root() {
  return (
    <>
    <BrandStills />
    <Composition
      id="Ad45"
      component={Ad}
      durationInFrames={AD_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ audio: true }}
    />
    <Composition
      id="Trailer"
      component={Trailer}
      durationInFrames={Math.round(totalSeconds * FPS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ audio: true }}
    />
    </>
  );
}

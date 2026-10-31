import { Composition } from 'remotion';
import { FPS, HEIGHT, totalSeconds, WIDTH } from './config';
import { Trailer } from './Trailer';

export function Root() {
  return (
    <Composition
      id="Trailer"
      component={Trailer}
      durationInFrames={Math.round(totalSeconds * FPS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
}

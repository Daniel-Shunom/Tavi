import type { ReactNode } from 'react';
import {
  IconChristmasTreeFilled,
  IconCloverFilled,
  IconConfettiFilled,
  IconEggFilled,
  IconHeartFilled,
  IconLamp2,
  IconLeafFilled,
  IconPumpkinScary,
} from '@tabler/icons-react';
import type { Motif } from './themes';

// The small festive mark a holiday theme shows beside the wordmark and on its reaction key.
// Solid Tabler icons; still, never animated.
export const motifIcons: Record<Motif, ReactNode> = {
  snowflake: <IconChristmasTreeFilled />,
  ghost: <IconPumpkinScary />,
  clover: <IconCloverFilled />,
  heart: <IconHeartFilled />,
  egg: <IconEggFilled />,
  party: <IconConfettiFilled />,
  lantern: <IconLamp2 />,
  wheat: <IconLeafFilled />,
};

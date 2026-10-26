// Browser-only registry of attachment rigs per character: slot components to name in memory,
// slot bindings, and the appearance animations that custom colours rewrite.
// Kept out of registry.ts, which the service imports and must stay plain data.
import type { AttachmentRig } from '../attachments/rive';
import type { RecolorTarget } from '../attachments/recolor';
import type { CharacterSlots } from '../attachments/schema';
import { lylaAttachmentRig, lylaRecolor, lylaSlots } from './mascot/attachments';

export interface CharacterAttachments {
  rig: AttachmentRig;
  slots: CharacterSlots;
  recolor: {
    artboard: string;
    hair?: RecolorTarget;
    outfit?: RecolorTarget;
    glasses?: RecolorTarget;
  };
}
export const attachmentRigs: Readonly<Record<string, CharacterAttachments | undefined>> = {
  mascot: { rig: lylaAttachmentRig, slots: lylaSlots, recolor: lylaRecolor },
};

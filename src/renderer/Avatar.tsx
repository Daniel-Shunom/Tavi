import { useEffect, useRef, useState } from 'react';
import type { State } from '../../shared/protocol';
import type { Target } from '../../shared/expressions';
import { locomotionTarget, type Point } from '../../shared/locomotion';
import { hiddenAmount } from '../../shared/presence';
import { wardrobePolicy } from '../../shared/wardrobe';
import { loadAttachments } from './attachments/bundle';
import { createAttachmentLayer, type AttachmentLayer } from './attachments/layer';
import { attachmentRigs } from './characters/attachmentRigs';
import { variantRigs } from './characters/variantRigs';
import { createVariantLayer, type VariantLayer } from './characters/variants/overlay/layer';
import { canonical, isOriginal, variantSchema } from '../../shared/variants';
import {
  createCharacterRenderer,
  type CharacterRenderer,
  type RenderFrame,
  type TrackApplication,
} from './adapter';
import { getCharacter } from './characters/registry';
import { composePose, phaseLookup, variantFor } from './compose';
import { IdleScheduler } from './idle';
import {
  createMotionLayer,
  fallbackStep,
  onMotionLayerChange,
  type MotionLayer,
  type MotionOutput,
} from './motionHook';
import { Performer, smooth } from './timeline';
import { headPoint, resolveAttention, type AttentionVector } from '../../shared/attention';
import { clearSceneLanding } from '../../shared/scenePlacement';
import { effectiveEnergy } from '../../shared/affect';
import { AttentionSmoother } from './attentionInput';
import { drawStateEffects } from './motion/states/effects';

/** Rough walking speed used to estimate arrival for timed visits (normalized units/second). */
const NOMINAL_SPEED = 0.22;
/** Body height of the overlay character in canvas units (220 px of 720). */
const REFERENCE_BODY = 220 / 720;

export function Avatar({
  state,
  serverNow = Date.now,
  presentation = 'overlay',
  captions = presentation === 'overlay'
    ? state.config.captions.overlay
    : state.config.captions.studio,
  onPosition,
  directTracks,
  directNodes,
  directTravel,
  onDraw,
  frame = { height: 0.9, bottom: 0.96, fitWidth: true },
}: {
  state: State;
  serverNow?: () => number;
  presentation?: 'overlay' | 'portrait';
  captions?: boolean;
  /** Imperative frame callback; lets controls sample the live ground point without rerenders. */
  onPosition?: (position: Point) => void;
  /** Optional imperative Rive clips for authored page choreography. */
  directTracks?: () => TrackApplication[];
  /** Node ownership for authored page foundations, applied after procedural offsets. */
  directNodes?: () => RenderFrame['nodes'];
  /** World travel in body heights when the page moves the character (cloth follow-through). */
  directTravel?: () => number | undefined;
  /** Capture after Rive flushes, before its WebGL drawing buffer is cleared. */
  onDraw?: (layers: readonly HTMLCanvasElement[]) => void;
  /**
   * Portrait placement: the artboard's height and its soles line as fractions of the host box.
   * A page that scrubs clips with root motion (hanging legs, hops) leaves room around the body by
   * drawing it smaller and higher than the default portrait, which fills the box.
   */
  frame?: { height: number; bottom: number; fitWidth?: boolean };
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLCanvasElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const stateLayer = useRef<HTMLDivElement>(null);
  const latest = useRef({
    state,
    serverNow,
    captions,
    onPosition,
    directTracks,
    directNodes,
    directTravel,
    frame,
    onDraw,
  });
  latest.current = {
    state,
    serverNow,
    captions,
    onPosition,
    directTracks,
    directNodes,
    directTravel,
    frame,
    onDraw,
  };
  const [error, setError] = useState('');
  const characterId = state.config.character;
  // Recolours are baked into the character file, so they reload the renderer (on commit).
  const wardrobe = state.config.wardrobe;
  const hideGlasses =
    wardrobePolicy.eyewearHidesBuiltInGlasses && !!wardrobe.attachments['head.face'];
  // Variants (skin, build, hair...) are baked in at load too; canonical JSON ignores key order.
  const variantKey = canonical(state.config.variant);
  const lookKey = JSON.stringify([
    wardrobe.hairColor,
    wardrobe.outfitColor,
    hideGlasses,
    variantKey,
  ]);
  useEffect(() => {
    const look = JSON.parse(lookKey) as [string | null, string | null, boolean, string];
    const variant = variantSchema.parse(JSON.parse(look[3]));
    const manifest = getCharacter(characterId);
    let cancelled = false,
      view: CharacterRenderer | undefined,
      frame: number | null = null;
    let clock = 0,
      last: number | null = null,
      width = 1,
      height = 1;
    let position: Point = { x: latest.current.state.config.x, y: latest.current.state.config.y };
    let pointer: Point | null = null;
    let facing: -1 | 1 = 1,
      facingScaleX = 1;
    const smoother = new AttentionSmoother();
    const rig = attachmentRigs[manifest.id];
    const layer: AttachmentLayer | null = rig
      ? createAttachmentLayer({
          slots: rig.slots,
          items: loadAttachments().items,
          path: (d) => new Path2D(d),
        })
      : null;
    const performer = new Performer(phaseLookup(manifest));
    const idle = new IdleScheduler({
      supported: Object.keys(manifest.expressions) as (keyof typeof manifest.expressions)[],
      seed: 7,
    });
    let motion: MotionLayer | null = createMotionLayer(manifest);
    const stopMotionWatch = onMotionLayerChange(() => {
      motion?.dispose?.();
      motion = createMotionLayer(manifest);
    });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    function resize() {
      const element = host.current;
      if (!element || !view) return;
      width = element.clientWidth;
      height = element.clientHeight;
      view.resize(width, height);
      for (const extra of [back.current, front.current])
        if (extra && canvas.current) {
          extra.width = canvas.current.width;
          extra.height = canvas.current.height;
        }
    }
    const observer = new ResizeObserver(resize);
    function trackPointer(event: PointerEvent) {
      // Host-relative CSS pixels; mapped into canvas coordinates around the portrait's head.
      const box = host.current?.getBoundingClientRect();
      pointer = box ? { x: event.clientX - box.left, y: event.clientY - box.top } : null;
    }
    if (presentation === 'portrait') addEventListener('pointermove', trackPointer);
    function stop() {
      if (frame !== null && view) view.cancelFrame(frame);
      frame = null;
      last = null;
    }
    function fail(reason: unknown) {
      console.error('Tavi character renderer:', reason);
      stop();
      view?.dispose();
      if (!cancelled)
        setError('The character could not load. Check graphics acceleration and refresh.');
    }
    function draw(time: number) {
      frame = null;
      if (cancelled || !view || document.hidden) return;
      try {
        const dt = last === null ? 0 : Math.min(0.1, Math.max(0, (time - last) / 1000));
        last = time;
        clock += dt;
        const { state: current, serverNow: now, captions: showCaptions } = latest.current;
        const config = current.config;
        const serviceTime = now();
        const reducedMotion = reduced.matches;
        performer.set(current.performance.script, serviceTime);
        const layers = performer.sample(serviceTime, reducedMotion);
        layers.push(
          ...idle.sample(
            clock,
            layers.length > 0,
            current.quiet || current.retracted || reducedMotion,
          ),
        );
        // Scene-aware attention: one resolver for every layer (shared/attention.ts). Directions
        // are computed in overlay-canvas coordinates from Tavi's live position, so the studio
        // portrait looks the same way as the overlay.
        const box = latest.current.frame;
        const portraitSize = box.fitWidth
          ? Math.min(height * box.height, width / 0.7)
          : height * box.height;
        const portraitBottom = height * box.bottom;
        const pointerCanvas =
          presentation === 'portrait' && pointer
            ? (() => {
                const unitPx = portraitSize / REFERENCE_BODY;
                const headPx = { x: width * 0.5, y: portraitBottom - 0.8 * portraitSize };
                const head = headPoint(position, REFERENCE_BODY);
                return {
                  x: head.x + (pointer.x - headPx.x) / unitPx,
                  y: head.y + (pointer.y - headPx.y) / unitPx,
                };
              })()
            : null;
        const attentionInput = {
          scene: config.scene,
          position,
          bodyHeight: REFERENCE_BODY,
          facing,
          pointer: pointerCanvas,
        };
        const resolved = new Map<Target, AttentionVector | null>();
        const attend = (target: Target) => {
          if (!resolved.has(target)) resolved.set(target, resolveAttention(target, attentionInput));
          return resolved.get(target) ?? null;
        };
        // Screen side, for host transforms (lean, shift), which are applied in screen space.
        const side = (target: Target): -1 | 1 => attend(target)?.side ?? facing;
        const pose = composePose(layers, manifest, {
          reducedMotion,
          energy: effectiveEnergy(config.energy, current.performance.affect),
          attitude: config.attitude,
          side,
          delegated: new Set(motion?.performances ?? []),
        });
        // Presence: entrances/exits on the service clock (never replayed after reconnect).
        const transition = current.performance.presence;
        let hidden =
          current.retracted && !transition
            ? 1
            : hiddenAmount(transition, serviceTime, reducedMotion);
        // Locomotion lane.
        const home = { x: config.x, y: config.y };
        const movement = current.performance.movement;
        const travel = movement
          ? Math.hypot(movement.to.x - home.x, movement.to.y - home.y) / NOMINAL_SPEED
          : 0;
        const goal = locomotionTarget(movement, home, serviceTime, travel);
        // Ordinary destinations stop clear of configured overlay panels. Named anchors and
        // body-state spots have intentional scene-aware placement and keep their exact target.
        if (
          goal.movement &&
          !goal.movement.anchor &&
          goal.movement.kind !== 'return' &&
          !current.performance.body
        ) {
          goal.to = clearSceneLanding(goal.to, config.scene, {
            halfWidth: (REFERENCE_BODY * 0.55 * height) / Math.max(width, 1),
            height: REFERENCE_BODY,
          });
        }
        let output: MotionOutput = {};
        if (motion)
          output = motion.update({
            dt,
            time: clock,
            layers,
            attention: smoother.update(pose.attention, attend, facing, dt),
            persona: {
              attitude: config.attitude,
              initiative: config.initiative,
              personality: config.personality,
              energy: effectiveEnergy(config.energy, current.performance.affect),
            },
            reducedMotion,
            quiet: current.quiet,
            retracted: current.retracted,
            presence: {
              transition,
              hidden,
              elapsed: transition ? (serviceTime - transition.startAt) / 1000 : Infinity,
            },
            performances: pose.performances,
            body: {
              cue: current.performance.body,
              elapsed: current.performance.body
                ? (serviceTime - current.performance.body.startAt) / 1000
                : 0,
            },
            base: { offset: { ...pose.offset } },
            locomotion: {
              home,
              target: goal.to,
              position,
              movement: goal.movement,
              viewport: { width, height },
            },
            character: {
              id: manifest.id,
              motionTracks: manifest.motionTracks,
              nodes: Object.keys(manifest.nodes),
              inputs: Object.keys(manifest.inputs),
              locomotion: manifest.locomotion,
              soleOffset: manifest.soleOffset,
            },
          });
        const previous = position;
        position =
          output.position ?? fallbackStep(position, goal.to, dt, NOMINAL_SPEED, reducedMotion);
        const groundPosition = output.groundPosition ?? position;
        latest.current.onPosition?.(groundPosition);
        // Teleports (anchor jumps, restored views) must not whip attachment springs.
        if (Math.hypot(position.x - previous.x, position.y - previous.y) > 0.08) layer?.reset();
        if (output.facing !== undefined) facing = output.facing;
        facingScaleX = output.facingScaleX ?? facing;
        const handledPresence = output.presence !== undefined;
        if (output.presence) hidden = output.presence.hidden;
        // Build the render frame: ambient loop, expressions, tuck, motion.
        const renderFrame: RenderFrame = {
          tracks: [],
          inputs: { ...output.inputs },
          nodes: { ...output.nodes },
        };
        if (output.bodyControls) renderFrame.bodyControls = output.bodyControls;
        if (manifest.idleLoop)
          renderFrame.tracks.push({
            track: manifest.idleLoop.track,
            time: reducedMotion
              ? 0.1
              : (clock % manifest.idleLoop.seconds) / manifest.idleLoop.seconds,
            mix: 1,
          });
        renderFrame.tracks.push(...pose.tracks);
        const tuck = variantFor(manifest.controls.tuck, 0.5);
        const tuckWeight = !handledPresence && transition?.kind === 'exit' ? smooth(hidden * 2) : 0;
        if (tuck && tuckWeight > 0)
          for (const sample of tuck.tracks)
            renderFrame.tracks.push({
              track: sample.track,
              time: sample.at ?? 0.5,
              mix: sample.mix * tuckWeight,
            });
        if (output.tracks) renderFrame.tracks.push(...output.tracks);
        for (const sample of latest.current.directTracks?.() ?? [])
          if (manifest.tracks[sample.track]) renderFrame.tracks.push(sample);
        Object.assign(renderFrame.nodes, latest.current.directNodes?.());
        const pageTravel = latest.current.directTravel?.();
        if (pageTravel !== undefined) renderFrame.travel = pageTravel;
        view.setAppearance(config.appearance);
        view.applyFrame(renderFrame);
        // Placement in CSS pixels; manifest offsets are in 720p reference pixels.
        const scale = Math.min(width / 1280, height / 720);
        const size = presentation === 'portrait' ? portraitSize : 220 * scale;
        const unit = presentation === 'portrait' ? size / 220 : scale;
        const offset = {
          x: pose.offset.x + (output.offset?.x ?? 0),
          y: pose.offset.y + (output.offset?.y ?? 0),
          rotation:
            pose.offset.rotation +
            (output.offset?.rotation ?? 0) +
            (!handledPresence && tuck?.transform?.rotation
              ? tuck.transform.rotation * tuckWeight
              : 0),
          scale: pose.offset.scale + (output.offset?.scale ?? 0),
        };
        const centerX = presentation === 'portrait' ? width * 0.5 : position.x * width;
        const bottomY = presentation === 'portrait' ? portraitBottom : position.y * height;
        const peek = pose.peek;
        const slide = handledPresence ? 0 : hidden;
        const placement = {
          x: centerX + offset.x * unit + (width - size * 0.35 - centerX) * peek,
          y:
            bottomY +
            offset.y * unit +
            (height + size * 0.42 - bottomY) * peek +
            (height + size - bottomY) * slide,
          width: size * manifest.aspect,
          height: size * offset.scale,
          rotation: offset.rotation,
        };
        const element = host.current;
        if (element) {
          const primary = [...layers].sort((a, b) => b.weight - a.weight)[0];
          element.dataset['performance'] =
            primary && primary.channel !== 'idle' ? primary.expression : 'idle';
          element.dataset['layers'] = layers
            .map((layer) => `${layer.expression}:${layer.weight.toFixed(2)}`)
            .join(' ');
          const looking = pose.attention ? attend(pose.attention.target) : null;
          element.dataset['attention'] =
            pose.attention && looking
              ? `${pose.attention.target}:${looking.side < 0 ? 'left' : 'right'}`
              : 'none';
          element.dataset['retracted'] = String(current.retracted);
          element.dataset['decidedBy'] = current.performance.script?.decidedBy.kind ?? 'none';
          element.dataset['ready'] = 'true';
          element.dataset['groundX'] = String(groundPosition.x);
          element.dataset['groundY'] = String(groundPosition.y);
        }
        // Rotation, mirroring and the ground-line mask apply to the whole body (Rive canvas plus
        // attachment canvases) around the character's feet; captions sit outside and never mirror.
        const wrapper = body.current;
        if (wrapper) {
          wrapper.style.opacity = String(1 - (handledPresence ? hidden : hidden * hidden));
          const origin = `${placement.x.toFixed(1)}px ${placement.y.toFixed(1)}px`;
          if (wrapper.style.transformOrigin !== origin) wrapper.style.transformOrigin = origin;
          const degrees = Math.round(placement.rotation * 100) / 100;
          const transform =
            (degrees ? `rotate(${String(degrees)}deg)` : '') + ` scaleX(${String(facingScaleX)})`;
          if (wrapper.style.transform !== transform.trim())
            wrapper.style.transform = transform.trim();
          const climbing =
            transition?.choreography === 'climb' &&
            (current.retracted || serviceTime - transition.startAt < 4000);
          const ground =
            output.clipBelow !== undefined
              ? output.clipBelow === null
                ? null
                : output.clipBelow * height
              : climbing
                ? bottomY
                : null;
          const clip =
            ground === null ? '' : `inset(0 0 ${Math.max(0, height - ground - 1).toFixed(1)}px 0)`;
          if (wrapper.style.clipPath !== clip) wrapper.style.clipPath = clip;
        }
        const caption = showCaptions && hidden < 0.5 ? pose.caption : '';
        if (bubble.current && bubble.current.textContent !== caption) {
          bubble.current.textContent = caption;
          bubble.current.hidden = !caption;
        }
        if (bubble.current && caption) {
          bubble.current.style.left = `${String(placement.x)}px`;
          bubble.current.style.top = `${String(placement.y - placement.height * 0.92)}px`;
        }
        // Contact shadow: behind the body and back attachments, inside the clipped, mirrored body.
        const spot = shadow.current;
        if (spot) {
          const groundX =
            presentation === 'portrait'
              ? centerX + ((output.shadow?.x ?? position.x) - position.x) * width
              : (output.shadow?.x ?? position.x) * width;
          const groundY =
            bottomY + ((output.shadow?.y ?? position.y) - position.y) * height + offset.y * unit;
          const shade = output.shadow ?? {
            scale: 1,
            opacity: handledPresence ? 0 : 0.35 * (1 - hidden) * (1 - peek),
          };
          const bodyHeight = size * offset.scale;
          const w = 0.44 * bodyHeight * shade.scale,
            h = 0.07 * bodyHeight * shade.scale;
          spot.style.width = `${w.toFixed(1)}px`;
          spot.style.height = `${h.toFixed(1)}px`;
          spot.style.left = `${(groundX - w / 2).toFixed(1)}px`;
          spot.style.top = `${(groundY - h / 2).toFixed(1)}px`;
          spot.style.opacity = shade.opacity.toFixed(3);
          spot.dataset['opacity'] = shade.opacity.toFixed(3);
          spot.dataset['scale'] = shade.scale.toFixed(3);
        }
        // Body-state effects (z z z, a lying body's floor shadow) sit outside the rotated body.
        if (stateLayer.current) {
          const states = output.states;
          const visible = hidden < 0.5;
          // The portrait draws the body larger than the overlay maths assumes; map around it.
          const k = presentation === 'portrait' ? size / (220 * scale) : 1;
          drawStateEffects(
            stateLayer.current,
            visible ? (states?.effects ?? []) : [],
            visible ? (states?.floorShadow ?? null) : null,
            (x, y) => ({
              x: centerX + (x - position.x) * width * k,
              y: bottomY + (y - position.y) * height * k,
            }),
            { x: width * k, y: height * k },
            size * manifest.aspect,
            presentation === 'portrait' && visible ? (states?.ledge ?? null) : null,
          );
          if (element) element.dataset['bodyState'] = states?.status ?? 'stand';
        }
        view.draw(dt, { ...placement, rotation: 0 });
        if (latest.current.onDraw && back.current && canvas.current && front.current)
          latest.current.onDraw([back.current, canvas.current, front.current]);
        frame = view.requestFrame(draw);
      } catch (reason) {
        fail(reason);
      }
    }
    function visibility() {
      if (document.hidden) stop();
      else if (view && !cancelled && frame === null) frame = view.requestFrame(draw);
    }
    async function mount() {
      try {
        const element = host.current,
          target = canvas.current;
        if (!element || !target) return;
        const loaded = await createCharacterRenderer(target, manifest, {
          look: {
            hairColor: look[0] ?? undefined,
            outfitColor: look[1] ?? undefined,
            hideGlasses: look[2],
            variant,
          },
          attachments: rig,
        });
        const variantRig = variantRigs[manifest.id];
        const variantLayer: VariantLayer | null =
          variantRig && !isOriginal(variant)
            ? createVariantLayer({ rig: variantRig, variant, path: (d) => new Path2D(d) })
            : null;
        const backContext = back.current?.getContext('2d') ?? null;
        const frontContext = front.current?.getContext('2d') ?? null;
        if ((layer || variantLayer) && frontContext)
          loaded.setDecorator?.((matrix, world, dt) => {
            const { state: current } = latest.current;
            const wardrobe = current.config.wardrobe;
            for (const context of [backContext, frontContext]) {
              if (!context) continue;
              context.setTransform(1, 0, 0, 1, 0, 0);
              context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            }
            // Variant hair and features first, so worn attachments (hats) sit on top.
            variantLayer?.draw(backContext, frontContext, {
              view: matrix,
              world,
              dt,
              still: reduced.matches,
            });
            layer?.draw(backContext, frontContext, {
              view: matrix,
              world,
              dt,
              equipped: wardrobe.attachments,
              tints: wardrobe.tints,
              palette: {
                ...(wardrobe.hairColor ? { hair: wardrobe.hairColor } : {}),
                ...(wardrobe.outfitColor ? { outfit: wardrobe.outfitColor } : {}),
              },
              still: reduced.matches,
            });
          });
        if (cancelled) {
          loaded.dispose();
          return;
        }
        view = loaded;
        resize();
        observer.observe(element);
        document.addEventListener('visibilitychange', visibility);
        frame = view.requestFrame(draw);
      } catch (reason) {
        fail(reason);
      }
    }
    void mount();
    return () => {
      cancelled = true;
      stop();
      observer.disconnect();
      stopMotionWatch();
      motion?.dispose?.();
      removeEventListener('pointermove', trackPointer);
      document.removeEventListener('visibilitychange', visibility);
      view?.dispose();
    };
  }, [presentation, characterId, lookKey]);
  return (
    <div className="avatar-renderer" ref={host} data-renderer={getCharacter(characterId).renderer}>
      <div className="avatar-body" ref={body}>
        <div ref={shadow} className="avatar-shadow" aria-hidden="true" />
        <canvas ref={back} className="avatar-layer" aria-hidden="true" />
        <canvas ref={canvas} aria-label={`${state.config.name}, animated companion`} />
        <canvas ref={front} className="avatar-layer" aria-hidden="true" />
      </div>
      <div className="avatar-states" ref={stateLayer} aria-hidden="true" />
      <div className="avatar-caption" ref={bubble} role="status" aria-live="polite" hidden />
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

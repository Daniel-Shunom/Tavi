import { z } from 'zod';
import type { ObsSource, ObsStatus } from '../../shared/obs.js';
import type { SceneRect } from '../../shared/states.js';
import { ObsClient } from './client.js';
import {
  chooseWebcam,
  identity,
  likelyCamera,
  normalized,
  sceneItemsSchema,
  sourceFrame,
  type Frame,
} from './layout.js';

const videoSchema = z.object({
  baseWidth: z.number().positive(),
  baseHeight: z.number().positive(),
});
const activeSceneSchema = z.object({
  currentProgramSceneName: z.string(),
  currentProgramSceneUuid: z.string().optional(),
});
const empty = (): ObsStatus => ({
  phase: 'disconnected',
  message: 'Connect OBS to locate the webcam automatically.',
  scene: null,
  canvas: null,
  sources: [],
  selection: null,
  webcam: null,
});

/** A read-only scene observer. Only confirmed, visible geometry becomes Tavi's webcam region. */
export class ObsWebcam {
  private state = empty();
  private generation = 0;
  private selections = new Map<string, string>();
  private sceneKey = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private refreshing: Promise<void> | null = null;
  private client: ObsClient;

  constructor(private apply: (webcam: SceneRect | null) => Promise<void>) {
    this.client = new ObsClient(
      () => {
        this.schedule();
      },
      () => {
        this.generation++;
        this.clearTimers();
        this.state = {
          ...empty(),
          phase: 'error',
          message: 'OBS disconnected. Webcam perching is unavailable until you reconnect.',
        };
        void this.apply(null).catch(() => undefined);
      },
    );
  }

  status(): ObsStatus {
    return structuredClone(this.state);
  }

  async connect(port: number, password: string) {
    this.close();
    const generation = this.generation;
    this.state = { ...empty(), phase: 'connecting', message: 'Reading the active OBS scene…' };
    // Never keep a previously imported webcam alive while discovery is unavailable.
    await this.apply(null);
    try {
      await this.client.connect(port, password);
      if (generation !== this.generation) return this.status();
      this.state.phase = 'connected';
      await this.refresh();
      this.poll = setInterval(() => {
        this.schedule();
      }, 2500);
    } catch (error) {
      if (generation !== this.generation) return this.status();
      this.client.close();
      this.state = {
        ...empty(),
        phase: 'error',
        message: error instanceof Error ? error.message : 'Could not read OBS.',
      };
    }
    return this.status();
  }

  async disconnect() {
    this.close();
    this.state = empty();
    await this.apply(null);
    return this.status();
  }

  async select(id: string | null) {
    if (this.state.phase !== 'connected') throw new Error('Connect OBS first.');
    if (id !== null && !this.state.sources.some((source) => source.id === id))
      throw new Error('Choose a source from the active scene.');
    if (id === null) this.selections.delete(this.sceneKey);
    else this.selections.set(this.sceneKey, id);
    await this.refresh();
    return this.status();
  }

  private schedule() {
    if (this.state.phase !== 'connected' || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, 180);
  }

  private refresh() {
    if (this.refreshing) return this.refreshing;
    const generation = this.generation;
    const work = this.readScene(generation)
      .catch(async () => {
        if (generation !== this.generation) return;
        this.state = {
          ...this.state,
          webcam: null,
          sources: [],
          message:
            'The OBS layout could not be read. Webcam perching is unavailable; refresh or reconnect.',
        };
        await this.apply(null);
      })
      .finally(() => {
        if (this.refreshing === work) this.refreshing = null;
      });
    this.refreshing = work;
    return work;
  }

  private async readScene(generation: number) {
    const [videoData, sceneData] = await Promise.all([
      this.client.request('GetVideoSettings'),
      this.client.request('GetCurrentProgramScene'),
    ]);
    const video = videoSchema.parse(videoData);
    const active = activeSceneSchema.parse(sceneData);
    const sources: ObsSource[] = [];
    let visited = 0;
    const walk = async (
      name: string,
      parent: Frame,
      path: string,
      depth: number,
      unsupported: string | null,
      group: boolean,
    ) => {
      if (depth > 5 || visited > 200) throw new Error('OBS scene is too deeply nested.');
      const data = await this.client.request(group ? 'GetGroupSceneItemList' : 'GetSceneItemList', {
        sceneName: name,
      });
      for (const item of sceneItemsSchema.parse(data).sceneItems) {
        visited++;
        if (!item.sceneItemEnabled) continue;
        const id = `${path}/${String(item.sceneItemId)}`;
        const projection = sourceFrame(item.sceneItemTransform, parent);
        const reason = unsupported ?? projection.reason;
        if (item.isGroup || item.sourceType === 'OBS_SOURCE_TYPE_SCENE') {
          await walk(
            item.sourceName,
            projection.frame ?? parent,
            id,
            depth + 1,
            reason,
            item.isGroup,
          );
        } else {
          const rect =
            !reason && projection.rect
              ? normalized(projection.rect, video.baseWidth, video.baseHeight)
              : null;
          // Audio-only and zero-sized inputs are not webcam regions.
          if (item.sceneItemTransform.sourceWidth <= 0 || item.sceneItemTransform.sourceHeight <= 0)
            continue;
          sources.push({
            id,
            name: `${name} / ${item.sourceName}`,
            camera: likelyCamera(item.sourceName),
            rect,
            reason:
              reason ??
              (rect ? null : 'This source is off canvas or too small to use as a webcam region.'),
          });
        }
      }
    };
    const key = active.currentProgramSceneUuid ?? active.currentProgramSceneName;
    await walk(active.currentProgramSceneName, identity, key, 0, null, false);
    // A scene change during discovery invalidates the result instead of briefly importing old geometry.
    const current = activeSceneSchema.parse(await this.client.request('GetCurrentProgramScene'));
    if (generation !== this.generation) return;
    if ((current.currentProgramSceneUuid ?? current.currentProgramSceneName) !== key) {
      this.schedule();
      return;
    }
    const selection = this.selections.get(key) ?? null;
    const selected = chooseWebcam(sources, selection);
    const webcam = selected?.rect ?? null;
    this.sceneKey = key;
    this.state = {
      phase: 'connected',
      scene: active.currentProgramSceneName,
      canvas: { width: video.baseWidth, height: video.baseHeight },
      sources,
      selection,
      webcam,
      message: selected
        ? (selected.reason ?? `Following ${selected.name}.`)
        : selection !== null
          ? 'The selected webcam is hidden or absent from this scene. Webcam perching is unavailable.'
          : sources.filter((source) => source.camera).length > 1
            ? 'More than one camera source was found. Choose the webcam Tavi should use.'
            : 'No visible webcam was identified. Choose its source, or leave perching unavailable.',
    };
    await this.apply(webcam);
  }

  private clearTimers() {
    if (this.timer) clearTimeout(this.timer);
    if (this.poll) clearInterval(this.poll);
    this.timer = null;
    this.poll = null;
  }

  close() {
    this.generation++;
    this.clearTimers();
    this.client.close();
    this.refreshing = null;
  }
}

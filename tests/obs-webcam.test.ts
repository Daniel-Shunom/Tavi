import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { ObsWebcam } from '../server/obs/webcam';
import {
  chooseWebcam,
  identity,
  normalized,
  sourceFrame,
  transformSchema,
} from '../server/obs/layout';
import { defaultScene, resolveSpot, webcamPerchStatus, type SceneRect } from '../shared/states';
import { createApp } from '../server/app';
import { defaults } from '../shared/protocol';
import { decodeFrame } from '../server/decode';

const transform = {
  positionX: 100,
  positionY: 470,
  sourceWidth: 640,
  sourceHeight: 480,
  scaleX: 0.5,
  scaleY: 0.5,
  alignment: 5,
  rotation: 0,
  cropLeft: 40,
  cropRight: 40,
  cropTop: 0,
  cropBottom: 0,
  boundsType: 'OBS_BOUNDS_NONE',
};
const camera = (id = 1, enabled = true) => ({
  sceneItemId: id,
  sourceName: `Webcam ${String(id)}`,
  inputKind: 'dshow_input',
  sourceType: 'OBS_SOURCE_TYPE_INPUT',
  sceneItemEnabled: enabled,
  sceneItemTransform: transform,
});
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function fakeObs(authenticate = false) {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('Missing fake OBS address');
  let scene = 'Main';
  let items = [camera()];
  let authenticated = false;
  const sha = (s: string) => createHash('sha256').update(s).digest('base64');
  const packet = z.object({
    op: z.number(),
    d: z.object({
      requestId: z.string().optional(),
      requestType: z.string().optional(),
      authentication: z.string().optional(),
    }),
  });
  server.on('connection', (socket) => {
    socket.send(
      JSON.stringify({
        op: 0,
        d: authenticate
          ? { authentication: { salt: 'test-salt', challenge: 'test-challenge' } }
          : {},
      }),
    );
    socket.on('message', (raw) => {
      const message = packet.parse(JSON.parse(decodeFrame(raw)));
      if (message.op === 1) {
        authenticated =
          !authenticate ||
          message.d.authentication === sha(sha('test-password' + 'test-salt') + 'test-challenge');
        if (!authenticated) socket.close(4009, 'Authentication failed');
        else socket.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
      } else if (message.op === 6) {
        const responseData =
          message.d.requestType === 'GetVideoSettings'
            ? { baseWidth: 1280, baseHeight: 720 }
            : message.d.requestType === 'GetCurrentProgramScene'
              ? { currentProgramSceneName: scene, currentProgramSceneUuid: scene }
              : { sceneItems: items };
        socket.send(
          JSON.stringify({
            op: 7,
            d: { requestId: message.d.requestId, requestStatus: { result: true }, responseData },
          }),
        );
      }
    });
  });
  cleanups.push(async () => {
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });
  return {
    port: address.port,
    authenticated: () => authenticated,
    scene(next: string, nextItems: ReturnType<typeof camera>[]) {
      scene = next;
      items = nextItems;
      for (const socket of server.clients)
        socket.send(
          JSON.stringify({
            op: 5,
            d: { eventType: 'CurrentProgramSceneChanged', eventData: { sceneName: next } },
          }),
        );
    },
  };
}

describe('OBS webcam discovery', () => {
  it('authenticates, imports cropped camera bounds, and invalidates them when the active scene has no camera', async () => {
    const fake = await fakeObs(true);
    const applied: (SceneRect | null)[] = [];
    const obs = new ObsWebcam((rect) => {
      applied.push(rect);
      return Promise.resolve();
    });
    cleanups.unshift(() => {
      obs.close();
      return Promise.resolve();
    });
    const status = await obs.connect(fake.port, 'test-password');
    expect(fake.authenticated()).toBe(true);
    expect(status.phase).toBe('connected');
    expect(status.webcam).toEqual({ enabled: true, x: 0.0781, y: 0.6528, w: 0.2188, h: 0.3333 });
    expect(JSON.stringify(status)).not.toContain('test-password');
    fake.scene('No webcam', []);
    await vi.waitFor(() => {
      expect(obs.status().scene).toBe('No webcam');
    });
    expect(obs.status().webcam).toBeNull();
    expect(applied.at(-1)).toBeNull();
  });

  it('requires selection when two cameras are visible and drops a hidden selected camera', async () => {
    const fake = await fakeObs();
    fake.scene('Main', [camera(1), camera(2)]);
    const obs = new ObsWebcam(() => Promise.resolve());
    cleanups.unshift(() => {
      obs.close();
      return Promise.resolve();
    });
    const initial = await obs.connect(fake.port, '');
    expect(initial.webcam).toBeNull();
    const selected = await obs.select('Main/2');
    expect(selected.webcam?.enabled).toBe(true);
    fake.scene('Main', [camera(1), camera(2, false)]);
    await vi.waitFor(() => {
      expect(obs.status().sources).toHaveLength(1);
    });
    expect(obs.status().webcam).toBeNull();
    expect(obs.status().message).toContain('hidden or absent');
  });

  it('reports authentication failure without leaking credentials or leaving webcam geometry enabled', async () => {
    const fake = await fakeObs(true);
    const applied: (SceneRect | null)[] = [];
    const obs = new ObsWebcam((rect) => {
      applied.push(rect);
      return Promise.resolve();
    });
    cleanups.unshift(() => {
      obs.close();
      return Promise.resolve();
    });
    const status = await obs.connect(fake.port, 'wrong-password');
    expect(status.phase).toBe('error');
    expect(status.message).toContain('password');
    expect(JSON.stringify(status)).not.toContain('wrong-password');
    expect(applied.at(-1)).toBeNull();
  });

  it('restricts OBS mutations to Studio and validates the port before connecting', async () => {
    const app = await createApp({ ...defaults, scene: { ...defaults.scene, webcamSource: 'obs' } });
    cleanups.unshift(() => app.close());
    const headers = { origin: 'http://127.0.0.1:5173', 'x-tavi-request': 'studio' };
    expect(
      (await app.inject({ method: 'POST', url: '/api/obs/connect', payload: { port: 4455 } }))
        .statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: 'POST', url: '/api/obs/connect', headers, payload: { port: 0 } }))
        .statusCode,
    ).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/obs' })).json<unknown>()).toMatchObject({
      phase: 'disconnected',
      webcam: null,
    });
    expect((await app.inject({ method: 'GET', url: '/api/state' })).json<unknown>()).toMatchObject({
      config: { scene: { webcam: { enabled: false } } },
    });
    const fake = await fakeObs();
    const connected = await app.inject({
      method: 'POST',
      url: '/api/obs/connect',
      headers,
      payload: { port: fake.port },
    });
    expect(connected.json<unknown>()).toMatchObject({
      phase: 'connected',
      webcam: { enabled: true },
    });
    expect((await app.inject({ method: 'GET', url: '/api/state' })).json<unknown>()).toMatchObject({
      config: { scene: { webcam: { enabled: true } } },
    });
    fake.scene('No camera', []);
    await vi.waitFor(async () => {
      expect(
        (await app.inject({ method: 'GET', url: '/api/state' })).json<unknown>(),
      ).toMatchObject({ config: { scene: { webcam: { enabled: false } } } });
    });
  }, 30000);
});

describe('webcam geometry and perch eligibility', () => {
  it('projects cropped, mirrored and center-aligned sources and clips off-canvas regions', () => {
    const projection = sourceFrame(
      transformSchema.parse({
        ...transform,
        alignment: 0,
        scaleX: -0.5,
        positionX: 200,
        positionY: 360,
      }),
      identity,
    );
    expect(projection.rect).toEqual({ x: 60, y: 240, w: 280, h: 240 });
    expect(normalized({ x: -100, y: 100, w: 200, h: 200 }, 1280, 720)?.x).toBe(0);
  });
  it('composes nested scale and crop transforms without using the child as canvas coordinates', () => {
    const group = sourceFrame(
      transformSchema.parse({
        ...transform,
        positionX: 200,
        positionY: 100,
        cropLeft: 0,
        cropRight: 0,
      }),
      identity,
    );
    if (!group.frame) throw new Error('Expected group frame');
    const child = sourceFrame(
      transformSchema.parse({
        ...transform,
        positionX: 20,
        positionY: 40,
        scaleX: 1,
        scaleY: 1,
        cropLeft: 0,
        cropRight: 0,
        sourceWidth: 100,
        sourceHeight: 80,
      }),
      group.frame,
    );
    expect(child.rect).toEqual({ x: 210, y: 120, w: 50, h: 40 });
  });
  it('does not invent usable geometry for rotated or fitted sources', () => {
    expect(
      sourceFrame(transformSchema.parse({ ...transform, rotation: 15 }), identity).rect,
    ).toBeUndefined();
    expect(
      sourceFrame(
        transformSchema.parse({ ...transform, boundsType: 'OBS_BOUNDS_SCALE_INNER' }),
        identity,
      ).rect,
    ).toBeUndefined();
    expect(chooseWebcam([], null)).toBeNull();
  });
  it('never substitutes a game frame for a missing webcam and rejects insufficient headroom or width', () => {
    const home = { x: 0.2, y: 0.9 };
    const scene = {
      ...defaultScene,
      webcam: { enabled: true, x: 0.1, y: 0.65, w: 0.3, h: 0.25 },
      game: { enabled: true, x: 0.4, y: 0.65, w: 0.3, h: 0.25 },
    };
    expect(webcamPerchStatus({ scene, home }).spot?.rect).toBe('webcam');
    expect(
      resolveSpot('perch', {
        scene: { ...scene, webcam: { ...scene.webcam, enabled: false } },
        home,
      }),
    ).toBeNull();
    expect(
      webcamPerchStatus({ scene: { ...scene, webcam: { ...scene.webcam, y: 0.01 } }, home }).reason,
    ).toContain('above');
    expect(
      webcamPerchStatus({ scene: { ...scene, webcam: { ...scene.webcam, w: 0.02 } }, home }).spot,
    ).toBeNull();
  });
});

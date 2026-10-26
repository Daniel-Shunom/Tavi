import { createHash } from 'node:crypto';
import { z } from 'zod';

const packetSchema = z.object({ op: z.number(), d: z.record(z.string(), z.unknown()) });
const helloSchema = z.object({
  authentication: z.object({ salt: z.string(), challenge: z.string() }).optional(),
});
const responseSchema = z.object({
  requestId: z.string(),
  requestStatus: z.object({ result: z.boolean() }),
  responseData: z.record(z.string(), z.unknown()).optional(),
});
const sha = (value: string) => createHash('sha256').update(value).digest('base64');
interface Pending {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** OBS WebSocket v5 client. It only exposes read requests used by webcam discovery. */
export class ObsClient {
  private socket: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private next = 0;
  private ready = false;

  constructor(
    private changed: () => void,
    private lost: () => void,
  ) {}

  connect(port: number, password: string): Promise<void> {
    this.close();
    const socket = new WebSocket(`ws://127.0.0.1:${String(port)}`);
    this.socket = socket;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        fail('OBS did not respond. Check its WebSocket settings.');
      }, 6000);
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(message));
        if (this.socket === socket) this.close();
      };
      socket.onmessage = (event: MessageEvent<unknown>) => {
        if (this.socket !== socket || typeof event.data !== 'string') return;
        try {
          const packet = packetSchema.parse(JSON.parse(event.data));
          if (packet.op === 0) {
            const hello = helloSchema.parse(packet.d);
            const authentication = hello.authentication
              ? sha(sha(password + hello.authentication.salt) + hello.authentication.challenge)
              : undefined;
            socket.send(
              JSON.stringify({
                op: 1,
                d: {
                  rpcVersion: 1,
                  // Scene, input and item changes plus the high-volume transform event.
                  eventSubscriptions: 4 | 8 | 128 | 262144,
                  ...(authentication ? { authentication } : {}),
                },
              }),
            );
          } else if (packet.op === 2 && !settled) {
            this.ready = true;
            settled = true;
            clearTimeout(timer);
            resolve();
          } else if (packet.op === 7) {
            const response = responseSchema.parse(packet.d);
            const waiting = this.pending.get(response.requestId);
            if (!waiting) return;
            this.pending.delete(response.requestId);
            clearTimeout(waiting.timer);
            if (response.requestStatus.result) waiting.resolve(response.responseData ?? {});
            else waiting.reject(new Error('OBS could not read the active scene.'));
          } else if (packet.op === 5) this.changed();
        } catch {
          fail('OBS returned an unsupported response. Use OBS WebSocket v5.');
        }
      };
      socket.onerror = () => {
        fail('Could not connect to OBS. Enable its WebSocket server and check the port.');
      };
      socket.onclose = (event) => {
        if (this.socket !== socket) return;
        if (!settled)
          fail(
            event.code === 4009
              ? 'OBS rejected the password. Check WebSocket Server Settings.'
              : 'OBS closed the connection. Check its WebSocket server settings.',
          );
        else {
          this.close();
          this.lost();
        }
      };
    });
  }

  request(
    type:
      'GetVideoSettings' | 'GetCurrentProgramScene' | 'GetSceneItemList' | 'GetGroupSceneItemList',
    data: Record<string, unknown> = {},
  ) {
    const socket = this.socket;
    if (!socket || !this.ready) return Promise.reject(new Error('OBS is disconnected.'));
    const id = String(++this.next);
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('OBS scene discovery timed out.'));
      }, 5000);
      this.pending.set(id, { resolve, reject, timer });
      socket.send(
        JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data } }),
      );
    });
  }

  close() {
    const socket = this.socket;
    this.socket = null;
    this.ready = false;
    socket?.close();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('OBS disconnected.'));
    }
    this.pending.clear();
  }
}

export {};

declare global {
  /** The two Deno runtime APIs used by this Edge Function's entry point. */
  const Deno: {
    env: { get(name: string): string | undefined };
    serve(handler: (request: Request) => Response | Promise<Response>): unknown;
  };
}

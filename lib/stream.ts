import "server-only";

/** NDJSON streaming response. Work runs inside the request, so nothing depends on code running after it ends. */
export function ndjson(work: (send: (o: unknown) => void) => Promise<void>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
        } catch {
          /* client went away; the work still finishes or is marked failed */
        }
      };
      try {
        await work(send);
      } catch (e) {
        console.error(e);
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-accel-buffering": "no" } });
}

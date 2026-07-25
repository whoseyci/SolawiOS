/**
 * Durable Object for one Bieterrunde (ADR-0004 §4, ADR-0005 §6).
 *
 * A round is a live, transient, single-farm session — exactly what a Durable
 * Object is for. It owns the WebSocket fan-out to the projector and, critically,
 * enforces the batching and jitter rules in ONE place, so no client can
 * accidentally render a rawer view than the room is allowed to see.
 */

interface DurableState {
  acceptWebSocket?(ws: WebSocket): void;
  getWebSockets?(): WebSocket[];
}

export class BiddingRoom {
  private sockets = new Set<WebSocket>();
  /** Last position we broadcast; used to suppress redundant updates. */
  private lastPosition: number | null = null;
  private pendingSince = 0;

  constructor(private readonly state: DurableState, private readonly env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/publish') {
      const message = await request.json<{
        phase: 'collecting' | 'showing' | 'final';
        position: number | null;
        participationHint: string;
      }>();
      this.broadcast(message);
      return new Response('ok');
    }

    if (request.headers.get('upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      server.accept();
      this.sockets.add(server);
      server.addEventListener('close', () => this.sockets.delete(server));
      server.addEventListener('error', () => this.sockets.delete(server));
      // Send current state immediately so a projector reconnecting mid-round
      // does not sit blank.
      if (this.lastPosition !== null) {
        server.send(JSON.stringify({ phase: 'showing', position: this.lastPosition }));
      }
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('not found', { status: 404 });
  }

  /**
   * Broadcast with jitter.
   *
   * The delay is randomised so that a bar movement cannot be correlated with the
   * moment a particular person pressed submit — which is the observable that
   * would otherwise let a room deanonymise a bid (ADR-0005 §3).
   */
  private broadcast(message: { position: number | null; phase: string; participationHint: string }): void {
    if (message.position === this.lastPosition && message.phase !== 'final') return;
    this.lastPosition = message.position;

    const jitterMs = message.phase === 'final' ? 0 : 800 + Math.floor(Math.random() * 2500);
    const payload = JSON.stringify(message);

    setTimeout(() => {
      for (const ws of this.sockets) {
        try { ws.send(payload); } catch { this.sockets.delete(ws); }
      }
    }, jitterMs);
  }
}

declare global {
  class WebSocketPair {
    0: WebSocket;
    1: WebSocket;
  }
  interface WebSocket {
    accept(): void;
    send(data: string): void;
    addEventListener(type: string, handler: () => void): void;
  }
  interface Request {
    json<T = unknown>(): Promise<T>;
  }
  interface ResponseInit { webSocket?: WebSocket }
}

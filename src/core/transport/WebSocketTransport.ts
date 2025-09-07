import type {
    Envelope,
    Transport,
    TransportEvent,
    WebSocketTransportOptions
} from "./types.ts";
import { DEFAULT_RECONNECT_POLICY } from "./types.ts";

/**
 * WebSocketTransport
 *
 * - Emits TransportEvent (see types) for lifecycle and incoming messages.
 * - send(envelope) is safe while disconnected: envelopes queue in-memory and flush on open.
 * - Multiplexing: envelope.convId (if present) is the mechanism to carry multiple conversations.
 */
export class WebSocketTransport implements Transport {
    public isConnected = false;
    public error?: string;
    public options: WebSocketTransportOptions;

    private ws: WebSocket | null = null;
    private eventCallbacks: Set<(event: TransportEvent) => void> = new Set();
    private reconnectAttempts = 0;
    private reconnectTimer: number | null = null;
    private outgoingQueue: Envelope[] = [];

    constructor(options: WebSocketTransportOptions) {
        this.options = {
            ...options,
            reconnectPolicy: options.reconnectPolicy ?? DEFAULT_RECONNECT_POLICY,
            url: options.url,
        };
    }

    // ------------------------
    // Generic event registration
    // ------------------------
    onEvent(callback: (event: TransportEvent) => void): void {
        this.eventCallbacks.add(callback);
    }

    offEvent(callback: (event: TransportEvent) => void): void {
        this.eventCallbacks.delete(callback);
    }

    private emitEvent(event: TransportEvent): void {
        for (const cb of Array.from(this.eventCallbacks)) {
            try {
                cb(event);
            } catch (err) {
                // swallow to avoid killing the transport loop
                console.error("Transport event handler error:", err);
            }
        }
    }

    // ------------------------
    // Convenience registration methods that produce typed callbacks
    // ------------------------
    onMessage(callback: (envelope: Envelope) => void): void {
        this.onEvent((e) => {
            if (e.type === "message" && e.envelope) callback(e.envelope);
        });
    }

    onPatch(callback: (patch: any) => void): void {
        this.onEvent((e) => {
            if (e.type === "patch" && e.envelope) callback(e.envelope.payload);
        });
    }

    onControl(callback: (control: any) => void): void {
        this.onEvent((e) => {
            if (e.type === "control" && e.envelope) callback(e.envelope.payload);
        });
    }

    onOpen(callback: () => void): void {
        this.onEvent((e) => {
            if (e.type === "open") callback();
        });
    }

    onClose(callback: (code?: number, reason?: string) => void): void {
        this.onEvent((e) => {
            if (e.type === "close") callback((e as any).code, (e as any).reason);
        });
    }

    onError(callback: (error: string, code?: number) => void): void {
        this.onEvent((e) => {
            if (e.type === "error") callback(e.error, (e as any).code);
        });
    }

    onDisconnect(callback: (reason?: string) => void): void {
        this.onEvent((e) => {
            if (e.type === "disconnect") callback((e as any).reason);
        });
    }

    onReconnect(callback: (attempt: number) => void): void {
        this.onEvent((e) => {
            if (e.type === "reconnect") callback((e as any).attempt);
        });
    }

    // ------------------------
    // send - multiplex-ready
    // ------------------------
    async send(envelope: Envelope): Promise<void> {
        // Send immediately if connected
        if (this.isConnected && this.ws) {
            try {
                this.ws.send(JSON.stringify(envelope));
                return;
            } catch (err) {
                // fallthrough to queue below
                console.warn("WebSocket send failed; enqueueing envelope", err);
            }
        }

        // otherwise queue in-memory for flush on open
        this.outgoingQueue.push(envelope);
    }

    // ------------------------
    // lifecycle: open / close
    // ------------------------
    async open(): Promise<void> {
        if (this.isConnected && this.ws) return;

        return new Promise((resolve, reject) => {
            try {
                if (!this.options.url) {
                    throw new Error("WebSocket URL is not configured");
                }

                // create websocket
                this.ws = new WebSocket(this.options.url);

                this.ws.onopen = () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.emitEvent({ type: "open" });

                    // Flush queued messages
                    while (this.outgoingQueue.length > 0 && this.ws && this.isConnected) {
                        const env = this.outgoingQueue.shift()!;
                        try {
                            this.ws.send(JSON.stringify(env));
                        } catch (err) {
                            // If flush fails, push the envelope back and stop flushing
                            this.outgoingQueue.unshift(env);
                            console.error("Failed flushing queued envelope:", err);
                            break;
                        }
                    }

                    resolve();
                };

                this.ws.onmessage = (ev: MessageEvent) => {
                    if (!ev.data) return;
                    try {
                        const envelope: Envelope = JSON.parse(ev.data);
                        // produce the proper TransportEvent shaped object
                        if (envelope.type === "patch") {
                            this.emitEvent({ type: "patch", envelope } as TransportEvent);
                        } else if (envelope.type === "control") {
                            this.emitEvent({ type: "control", envelope } as TransportEvent);
                        } else {
                            // treat as message by default
                            this.emitEvent({ type: "message", envelope } as TransportEvent);
                        }
                    } catch (err) {
                        this.emitEvent({ type: "error", error: "Failed to parse message" });
                    }
                };

                this.ws.onclose = (ev: CloseEvent) => {
                    this.isConnected = false;
                    this.emitEvent({
                        type: "close",
                        code: ev.code,
                        reason: ev.reason,
                    } as TransportEvent);
                    // handle reconnection according to policy
                    this.handleDisconnection();
                };

                this.ws.onerror = (_) => {
                    this.error = "WebSocket error";
                    this.emitEvent({
                        type: "error",
                        error: "WebSocket error",
                    } as TransportEvent);
                    // Some browsers call onclose after onerror; handleDisconnection will be called by onclose.
                };
            } catch (err) {
                reject(err);
            }
        });
    }

    close(): void {
        // clear reconnect attempts
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            try {
                this.ws.close();
            } catch {
                // ignore
            }
            this.ws = null;
        }

        this.isConnected = false;
        this.emitEvent({ type: "disconnect", reason: "closed_by_client" } as TransportEvent);
    }

    // ------------------------
    // reconnection/backoff
    // ------------------------
    private handleDisconnection(): void {
        this.emitEvent({ type: "disconnect" } as TransportEvent);

        const policy = this.options.reconnectPolicy!;
        if (!policy || policy.maxAttempts <= 0) return;

        if (this.reconnectAttempts >= policy.maxAttempts) {
            this.emitEvent({
                type: "error",
                error: "Max reconnect attempts exceeded",
            } as TransportEvent);
            return;
        }

        let delay = policy.initialDelay * Math.pow(policy.backoffFactor, this.reconnectAttempts);
        delay = Math.min(delay, policy.maxDelay);

        if (policy.jitter) {
            delay = delay * (0.8 + 0.4 * Math.random()); // 20% jitter +/- 20%
        }

        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectAttempts++;
            this.emitEvent({ type: "reconnect", attempt: this.reconnectAttempts } as TransportEvent);

            this.open()
                .then(() => {
                    this.emitEvent({ type: "reconnect", attempt: this.reconnectAttempts } as TransportEvent);
                })
                .catch(() => {
                    // schedule next attempt
                    this.handleDisconnection();
                });
        }, delay);
    }
}

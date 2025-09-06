import  type {Envelope, Transport, TransportEvent, WebSocketTransportOptions} from "./types.ts";
import {DEFAULT_RECONNECT_POLICY,} from "./types.ts";

export class WebSocketTransport implements Transport {
    public isConnected = false;
    public error?: string;
    public options: WebSocketTransportOptions;

    private ws: WebSocket | null = null;
    private eventCallbacks: Set<(event: TransportEvent) => void> = new Set();
    private reconnectAttempts = 0;
    private reconnectTimer: any = null;

    constructor(options: WebSocketTransportOptions) {
        this.options = {
            ...options,
            reconnectPolicy: DEFAULT_RECONNECT_POLICY,
            url: options.url,
        };
    }

    onPatch(callback: (patch: any) => void): void {
        throw new Error("Method not implemented.");
    }
    onControl(callback: (control: any) => void): void {
        throw new Error("Method not implemented.");
    }
    onOpen(callback: () => void): void {
        throw new Error("Method not implemented.");
    }
    onClose(callback: () => void): void {
        throw new Error("Method not implemented.");
    }
    onError(callback: (error: string) => void): void {
        throw new Error("Method not implemented.");
    }
    onDisconnect(callback: () => void): void {
        throw new Error("Method not implemented.");
    }
    onReconnect(callback: () => void): void {
        throw new Error("Method not implemented.");
    }

    async send(envelope: Envelope): Promise<void> {
        if (!this.isConnected || !this.ws) {
            throw new Error('WebSocket is not connected');
        }

        this.ws.send(JSON.stringify(envelope));
    }

    async open(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                if (!this.options.url) {
                    throw new Error('WebSocket URL is not configured');
                }
                this.ws = new WebSocket(this.options.url);

                this.ws.onopen = () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.emitEvent({ type: 'open' });
                    resolve();
                };

                this.ws.onclose = () => {
                    this.isConnected = false;
                    this.emitEvent({ type: 'close' });
                    this.handleDisconnection();
                };

                this.ws.onerror = (_) => {
                    this.error = 'WebSocket error';
                    this.emitEvent({
                        type: 'error',
                        error: 'WebSocket error',
                        code: 1006 // Closure code
                    });
                };

                this.ws.onmessage = (event) => {
                    try {
                        const envelope: Envelope = JSON.parse(event.data);

                        this.emitEvent({
                            type: envelope.type as 'message' | 'patch' | 'control',
                            envelope
                        });
                    } catch (error) {
                        this.emitEvent({
                            type: 'error',
                            error: 'Failed to parse message'
                        });
                    }
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    close(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;
    }

    onEvent(callback: (event: TransportEvent) => void): void {
        this.eventCallbacks.add(callback);
    }

    offEvent(callback: (event: TransportEvent) => void): void {
        this.eventCallbacks.delete(callback);
    }

    // Implementation of shortcut methods
    onMessage(callback: (envelope: Envelope) => void): void {
        this.onEvent((event) => {
            if (event.type === 'message') {
                callback(event.envelope);
            }
        });
    }

    private emitEvent(event: TransportEvent): void {
        for (const callback of this.eventCallbacks) {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in transport event callback:', error);
            }
        }
    }

    private handleDisconnection(): void {
        this.emitEvent({ type: 'disconnect' });

        const policy = this.options.reconnectPolicy!;

        if (this.reconnectAttempts >= policy.maxAttempts) {
            this.emitEvent({
                type: 'error',
                error: 'Max reconnect attempts exceeded'
            });
            return;
        }

        // Calculate delay with exponential backoff and optional jitter
        let delay = policy.initialDelay * Math.pow(policy.backoffFactor, this.reconnectAttempts);
        delay = Math.min(delay, policy.maxDelay);

        if (policy.jitter) {
            delay = delay * (0.8 + 0.4 * Math.random()); // Add 20% jitter
        }

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.emitEvent({
                type: 'reconnect',
                attempt: this.reconnectAttempts
            });

            this.open().then(() => {
                this.emitEvent({ type: 'reconnect', attempt: this.reconnectAttempts });
            }).catch(_ => {
                this.handleDisconnection();
            });
        }, delay);
    }
}

import type {
    Envelope,
    Transport,
    TransportEvent,
    WebSocketTransportOptions
} from "./types.ts";
import {DEFAULT_RECONNECT_POLICY} from "./types.ts";

/**
 * Implements a WebSocket-based transport mechanism for real-time communication.
 * This class manages the WebSocket connection lifecycle, sends outgoing messages,
 * queues messages during disconnection, and dispatches incoming messages as `TransportEvent`s.
 *
 * It is designed to be resilient, supporting automatic reconnection with configurable backoff.
 * The `envelope.convId` field is used to carry conversation IDs for multiplexing
 * (though actual multiplexing logic would typically reside at a higher layer).
 */
export class WebSocketTransport implements Transport {
    /**
     * Indicates whether the WebSocket connection is currently established and ready for communication.
     */
    public isConnected = false;
    /**
     * Stores the last error message encountered by the transport, if any.
     */
    public lastError?: string;
    /**
     * Configuration options for the WebSocket transport, including the URL and reconnection policy.
     */
    public options: WebSocketTransportOptions;

    /**
     * The WebSocket instance managing the connection. `null` if not connected.
     * @private
     */
    private webSocket: WebSocket | null = null;
    /**
     * A set of registered callback functions that listen to all transport events.
     * @private
     */
    private eventCallbacks: Set<(event: TransportEvent) => void> = new Set();
    /**
     * Counter for the number of reconnection attempts made. Resets on successful connection.
     * @private
     */
    private reconnectAttempts = 0;
    /**
     * Stores the ID of the timeout used for scheduled reconnection attempts.
     * `null` if no reconnection is pending.
     * @private
     */
    private reconnectTimeoutId: number | null = null;
    /**
     * A queue for `Envelope` messages that could not be sent immediately (e.g., due to disconnection).
     * These messages are flushed when the connection is re-established.
     * @private
     */
    private messageQueue: Envelope[] = [];

    /**
     * Creates an instance of WebSocketTransport.
     * Initializes with provided initialOptions, applying default reconnection policy if not specified.
     * @param initialOptions Configuration initialOptions for the WebSocket transport.
     */
    constructor(initialOptions: WebSocketTransportOptions) {
        this.options = {
            reconnectPolicy: DEFAULT_RECONNECT_POLICY, // Apply the default policy first
            ...initialOptions,                         // Merge initial options, allowing them to override defaults
        };

        // Ensure URL is explicitly set from initialOptions if not already
        if (!this.options.url && initialOptions.url) {
            this.options.url = initialOptions.url;
        }
    }

    /**
     * Registers a callback function to be invoked for all transport events.
     * @param handler The callback function to register.
     */
    onEvent(handler: (event: TransportEvent) => void): void {
        this.eventCallbacks.add(handler);
    }

    /**
     * Unregisters a callback function from receiving transport events.
     * @param handler The callback function to unregister.
     */
    offEvent(handler: (event: TransportEvent) => void): void {
        this.eventCallbacks.delete(handler);
    }

    /**
     * Dispatches a transport event to all registered handlers.
     * Callbacks are invoked in a `try-catch` block to prevent one handler from
     * stopping the execution of others.
     * @private
     * @param event The `TransportEvent` to emit.
     */
    private emitEvent(event: TransportEvent): void {
        for (const handler of Array.from(this.eventCallbacks)) {
            try {
                handler(event);
            } catch (err) {
                // swallow to avoid killing the transport loop
                console.error("Transport event handler error:", err);
            }
        }
    }

    /**
     * Registers a handler for 'message' type envelopes.
     * @param handler The callback function to invoke with the received envelope.
     */
    onMessage(handler: (envelope: Envelope) => void): void {
        this.onEvent((event) => {
            if (event.type === "message" && event.envelope) handler(event.envelope);
        });
    }

    /**
     * Registers a handler for 'patch' type envelopes.
     * @param handler The callback function to invoke with the received patch payload.
     */
    onPatch(handler: (patch: any) => void): void {
        this.onEvent((event) => {
            if (event.type === "patch" && event.envelope) handler(event.envelope.payload);
        });
    }

    /**
     * Registers a handler for 'control' type envelopes.
     * @param handler The callback function to invoke with the received control payload.
     */
    onControl(handler: (control: any) => void): void {
        this.onEvent((event) => {
            if (event.type === "control" && event.envelope) handler(event.envelope.payload);
        });
    }

    /**
     * Registers a handler for the 'open' event, triggered when the connection is successfully established.
     * @param handler The callback function to invoke.
     */
    onOpen(handler: () => void): void {
        this.onEvent((event) => {
            if (event.type === "open") handler();
        });
    }

    /**
     * Registers a handler for the 'close' event, triggered when the connection is closed.
     * @param handler The callback function to invoke with the close code and reason.
     */
    onClose(handler: (code?: number, reason?: string) => void): void {
        this.onEvent((event) => {
            if (event.type === "close") {
                handler(event.code, event.reason);
            }
        });
    }

    /**
     * Registers a handler for 'error' events, triggered when an error occurs in the transport.
     * @param handler The callback function to invoke with the error message and optional error code.
     */
    onError(handler: (error: string, code?: number) => void): void {
        this.onEvent((event) => {
            if (event.type === "error") handler(event.error, (event as any).code);
        });
    }

    /**
     * Registers a handler for 'disconnect' events, triggered when the connection is unexpectedly lost.
     * @param handler The callback function to invoke with the disconnection reason.
     */
    onDisconnect(handler: (reason?: string) => void): void {
        this.onEvent((event) => {
            if (event.type === "disconnect") handler((event as any).reason);
        });
    }

    /**
     * Registers a handler for 'reconnect' events, triggered when a reconnection attempt is made.
     * @param handler The callback function to invoke with the current attempt number.
     */
    onReconnect(handler: (attempt: number) => void): void {
        this.onEvent((event) => {
            if (event.type === "reconnect") handler((event as any).attempt);
        });
    }

    /**
     * Sends an `Envelope` message over the WebSocket connection.
     * If the connection is active, the message is sent immediately.
     * If disconnected or sending fails, the message is queued in-memory and will be
     * flushed when the connection is re-established.
     * @param envelope The `Envelope` to send.
     * @returns A Promise that resolves to `void` when the message is sent or queued.
     */
    async send(envelope: Envelope): Promise<void> {
        // Queue the message immediately if not connected, or if a previous send attempt failed
        if (!this.isConnected || !this.webSocket) {
            this.messageQueue.push(envelope);
            // If disconnected, try to open the connection to flush the queue
            if (!this.webSocket) { // Only attempt open if no WebSocket instance exists (e.g. initial send)
                try {
                    await this.open();
                } catch (err) {
                    console.warn("Failed to auto-open WebSocket for sending; message remains queued.", err);
                }
            }
            return;
        }

        try {
            this.webSocket.send(JSON.stringify(envelope));
        } catch (err) {
            // If sending fails for an 'isConnected' WebSocket, queue it and log.
            // This might happen if connection drops right after `isConnected` check.
            this.messageQueue.push(envelope);
            console.warn("WebSocket send failed; message queued for reconnection.", err);
            // Trigger disconnection handling, which will initiate reconnection.
            this.handleDisconnection();
        }
    }

    /**
     * Establishes a WebSocket connection.
     * If the connection is already open, this method returns immediately.
     * This method resolves when the connection is successfully opened, and rejects on failure.
     * It also initiates flushing of any pending messages from the queue upon successful connection.
     * @returns A Promise that resolves when the WebSocket connection is successfully opened.
     * @throws {Error} If the WebSocket URL is not configured.
     */
    async open(): Promise<void> {
        if (this.isConnected && this.webSocket) return;

        return new Promise((resolve, reject) => {
            try {
                if (!this.options.url) {
                    throw new Error("WebSocket URL is not configured");
                }

                // create websocket
                this.webSocket = new WebSocket(this.options.url);

                this.webSocket.onopen = () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.emitEvent({type: "open"});

                    // Flush queued messages
                    while (this.messageQueue.length > 0 && this.webSocket && this.isConnected) {
                        const queuedEnvelope = this.messageQueue.shift()!;
                        try {
                            this.webSocket.send(JSON.stringify(queuedEnvelope));
                        } catch (err) {
                            // If flush fails, push the envelope back and stop flushing
                            this.messageQueue.unshift(queuedEnvelope);
                            console.error("Failed flushing queued envelope:", err);
                            break;
                        }
                    }

                    resolve();
                };

                this.webSocket.onmessage = (ev: MessageEvent) => {
                    if (!ev.data) return;
                    try {
                        const envelope: Envelope = JSON.parse(ev.data);
                        // produce the proper TransportEvent shaped object
                        if (envelope.type === "patch") {
                            this.emitEvent({type: "patch", envelope} as TransportEvent);
                        } else if (envelope.type === "control") {
                            this.emitEvent({type: "control", envelope} as TransportEvent);
                        } else {
                            // treat as message by default
                            this.emitEvent({type: "message", envelope} as TransportEvent);
                        }
                    } catch (err) {
                        this.emitEvent({type: "error", error: "Failed to parse message"});
                    }
                };

                this.webSocket.onclose = (ev: CloseEvent) => {
                    this.isConnected = false;
                    this.emitEvent({
                        type: "close",
                        code: ev.code,
                        reason: ev.reason,
                    } as TransportEvent);
                    // handle reconnection according to policy
                    this.handleDisconnection();
                };

                this.webSocket.onerror = (_) => {
                    this.lastError = "WebSocket error";
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

    /**
     * Gracefully closes the WebSocket connection and clears any active reconnection timers.
     * Emits a 'disconnect' event with a 'closed_by_client' reason.
     */
    close(): void {
        // clear reconnect attempts
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }

        if (this.webSocket) {
            try {
                this.webSocket.close();
            } catch {
                // ignore
            }
            this.webSocket = null;
        }

        this.isConnected = false;
        this.emitEvent({type: "disconnect", reason: "closed_by_client"} as TransportEvent);
    }

    /**
     * Handles the logic for a WebSocket disconnection event (either `onclose` or `onerror`).
     * It emits a 'disconnect' event, and then initiates reconnection attempts
     * based on the configured `reconnectPolicy`.
     * @private
     */
    private handleDisconnection(): void {
        this.emitEvent({type: "disconnect"} as TransportEvent);

        const reconnectPolicy = this.options.reconnectPolicy!;
        if (!reconnectPolicy || reconnectPolicy.maxAttempts <= 0) return;

        if (this.reconnectAttempts >= reconnectPolicy.maxAttempts) {
            this.emitEvent({
                type: "error",
                error: "Max reconnect attempts exceeded",
            } as TransportEvent);
            return;
        }

        let delay = reconnectPolicy.initialDelay * Math.pow(reconnectPolicy.backoffFactor, this.reconnectAttempts);
        delay = Math.min(delay, reconnectPolicy.maxDelay);

        if (reconnectPolicy.jitter) {
            delay = delay * (0.8 + 0.4 * Math.random()); // 20% jitter +/- 20%
        }

        this.reconnectTimeoutId = window.setTimeout(() => {
            this.reconnectAttempts++;
            this.emitEvent({type: "reconnect", attempt: this.reconnectAttempts} as TransportEvent);

            this.open()
                .then(() => {
                    this.emitEvent({type: "reconnect", attempt: this.reconnectAttempts} as TransportEvent);
                })
                .catch(() => {
                    // schedule next attempt
                    this.handleDisconnection();
                });
        }, delay);
    }
}

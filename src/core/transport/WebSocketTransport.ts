import type {
    Envelope,
    Transport,
    TransportEvent,
    WebSocketTransportOptions,
    ControlPayload, TransportOpenEvent, TransportErrorEvent, TransportCloseEvent, TransportDisconnectEvent,
    TransportReconnectEvent,
} from "./types.ts";
import {DEFAULT_RECONNECT_POLICY} from "./types.ts";
import type {Patch} from "../../schema.d.ts";

/**
 * Implements a WebSocket-based transport mechanism for real-time communication.
 * This class manages the WebSocket connection lifecycle, sends outgoing messages,
 * queues messages during disconnection, and dispatches incoming messages as structured `TransportEvent`s.
 *
 * It is designed to be resilient, supporting automatic reconnection with configurable backoff.
 * The `envelope.convId` field is used to carry conversation IDs for multiplexing,
 * although the actual multiplexing logic would typically reside at a higher layer.
 */
export class WebSocketTransport implements Transport {
    /**
     * Indicates whether the WebSocket connection is currently established and ready for communication.
     * This property is publicly accessible for status monitoring.
     */
    public isConnected = false;
    /**
     * Stores the last error message encountered by the transport, if any.
     * This property is publicly accessible for status monitoring.
     */
    public lastError?: string;
    /**
     * Configuration options for the WebSocket transport, including the `url`,
     * `reconnectPolicy`, `heartbeatInterval`, and `timeout`.
     */
    public options: WebSocketTransportOptions;

    /**
     * The `WebSocket` instance managing the connection. It is `null` when not connected.
     * @private
     */
    private webSocket: WebSocket | null = null;
    /**
     * A set of registered callback functions that listen to all generic `TransportEvent`s emitted by this transport.
     * @private
     */
    private eventCallbacks: Set<(event: TransportEvent) => void> = new Set();
    /**
     * Counter for the number of reconnection attempts made. This count is reset on a successful connection.
     * @private
     */
    private reconnectAttempts = 0;
    /**
     * Stores the ID of the timeout used for scheduled reconnection attempts.
     * It is `null` if no reconnection is pending.
     * @private
     */
    private reconnectTimeoutId: number | NodeJS.Timeout | null = null;
    /**
     * A queue for `Envelope` messages that could not be sent immediately (e.g., due to disconnection).
     * These messages are stored in memory and are flushed when the connection is re-established.
     * @private
     */
    private messageQueue: Envelope[] = [];

    /**
     * Creates an instance of `WebSocketTransport`.
     * Initializes with provided `initialOptions`, applying the `DEFAULT_RECONNECT_POLICY`
     * as a base default if not explicitly overridden by the `initialOptions`.
     * @param initialOptions Configuration options for the WebSocket transport, including the WebSocket `url`.
     */
    constructor(initialOptions: WebSocketTransportOptions) {
        this.options = {
            reconnectPolicy: DEFAULT_RECONNECT_POLICY,
            ...initialOptions,
        };

        if (!this.options.url && initialOptions.url) {
            this.options.url = initialOptions.url;
        }
    }

    /**
     * Registers a generic callback function to be invoked for all `TransportEvent`s emitted by this transport.
     * @param handler The callback function to register, which receives a `TransportEvent` object.
     */
    onEvent(handler: (event: TransportEvent) => void): void {
        this.eventCallbacks.add(handler);
    }

    /**
     * Unregisters a previously registered generic callback function from receiving transport events.
     * @param handler The callback function to unregister.
     */
    offEvent(handler: (event: TransportEvent) => void): void {
        this.eventCallbacks.delete(handler);
    }

    /**
     * Dispatches a `TransportEvent` to all registered callback handlers in `eventCallbacks`.
     * Each handler is invoked within a `try-catch` block to prevent a single faulty handler
     * from stopping the execution of others.
     * @private
     * @param event The `TransportEvent` object to emit.
     */
    private emitEvent(event: TransportEvent): void {
        for (const handler of Array.from(this.eventCallbacks)) {
            try {
                handler(event);
            } catch (err: unknown) {
                console.error("WebSocketTransport: Error in transport event handler:", err, event);
            }
        }
    }

    /**
     * Registers a specific handler for incoming 'message' type `Envelope`s.
     * The callback receives the full `Envelope` object (expected to be `EnvelopeMessage`).
     * @param handler The callback function to invoke with the received `Envelope`.
     */
    onMessage(handler: (envelope: Envelope) => void): void {
        this.onEvent((event) => {
            if (event.type === "message") {
                handler(event.envelope as Envelope);
            }
        });
    }

    /**
     * Registers a specific handler for incoming `Patch` payloads (derived from 'patch' type `Envelope`s).
     * The callback receives the `Patch` object directly.
     * @param handler The callback function to invoke with the received `Patch` object.
     */
    onPatch(handler: (patch: Patch) => void): void {
        this.onEvent((event) => {
            if (event.type === "patch") {
                handler(event.envelope.payload as Patch);
            }
        });
    }

    /**
     * Registers a specific handler for incoming `ControlPayload` (derived from 'control' type `Envelope`s).
     * The callback receives the `ControlPayload` object directly.
     * @param handler The callback function to invoke with the received `ControlPayload` object.
     */
    onControl(handler: (control: ControlPayload) => void): void {
        this.onEvent((event) => {
            if (event.type === "control") {
                handler(event.envelope.payload as ControlPayload);
            }
        });
    }

    /**
     * Registers a handler for the 'open' event, triggered when the transport connection is successfully established.
     * @param handler The callback function to invoke.
     */
    onOpen(handler: () => void): void {
        this.onEvent((event) => {
            if (event.type === "open") {
                handler();
            }
        });
    }

    /**
     * Registers a handler for the 'close' event, triggered when the transport connection is closed.
     * @param handler The callback function to invoke, receiving optional close `code` and `reason`.
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
     * @param handler The callback function to invoke, receiving the error message and optional error code.
     */
    onError(handler: (error: string, code?: number) => void): void {
        this.onEvent((event) => {
            if (event.type === "error") {
                handler(event.error, event.code);
            }
        });
    }

    /**
     * Registers a handler for 'disconnect' events, triggered when the transport connection is unexpectedly lost.
     * @param handler The callback function to invoke with the disconnection reason.
     */
    onDisconnect(handler: (reason?: string) => void): void {
        this.onEvent((event) => {
            if (event.type === "disconnect") {
                handler(event.reason);
            }
        });
    }

    /**
     * Registers a handler for 'reconnect' events, triggered when a reconnection attempt is made.
     * The callback receives the current attempt number and the calculated delay before the attempt.
     * @param handler The callback function to invoke.
     */
    onReconnect(handler: (attempt: number, delay: number) => void): void {
        this.onEvent((event) => {
            if (event.type === "reconnect") {
                handler(event.attempt, event.delay);
            }
        });
    }

    /**
     * Sends an `Envelope` message over the WebSocket connection.
     * If the connection is active, the message is sent immediately.
     * If disconnected or sending fails, the message is queued in `messageQueue`
     * and will be flushed when the connection is re-established.
     * @param envelope The `Envelope` to send.
     * @returns A Promise that resolves to `void` when the message is sent or successfully queued.
     */
    async send(envelope: Envelope): Promise<void> {
        if (!this.isConnected || !this.webSocket) {
            this.messageQueue.push(envelope);
            if (!this.webSocket) {
                try {
                    await this.open();
                } catch (err: unknown) {
                    console.warn("WebSocketTransport: Failed to auto-open WebSocket for sending; message remains queued.", err);
                }
            }
            return;
        }

        try {
            this.webSocket.send(JSON.stringify(envelope));
        } catch (err: unknown) {
            this.messageQueue.push(envelope);
            console.warn("WebSocketTransport: WebSocket send failed; message queued for reconnection.", err);
            this.handleDisconnection();
        }
    }

    /**
     * Establishes a WebSocket connection to the configured `url`.
     * If a connection is already open (`isConnected` is true and `webSocket` exists), this method returns immediately.
     * This method returns a Promise that resolves when the connection is successfully opened, and rejects on failure.
     * It also initiates flushing of any pending messages from the `messageQueue` upon successful connection.
     * @returns A Promise that resolves to `void` when the WebSocket connection is successfully opened.
     * @throws {Error} If the WebSocket `url` is not configured in options or if the connection fails to establish.
     */
    async open(): Promise<void> {
        if (this.isConnected || this.webSocket) return;

        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }

        return new Promise<void>((resolve, reject) => {
            try {
                if (!this.options.url) {
                    throw new Error("WebSocket `url` is not configured in options.");
                }

                this.webSocket = new WebSocket(this.options.url);

                this.webSocket.onopen = () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.emitEvent({ type: "open" } as TransportOpenEvent);

                    while (this.messageQueue.length > 0 && this.webSocket && this.isConnected) {
                        const queuedEnvelope = this.messageQueue.shift()!;
                        try {
                            this.webSocket.send(JSON.stringify(queuedEnvelope));
                        } catch (err: unknown) {
                            this.messageQueue.unshift(queuedEnvelope);
                            console.error("WebSocketTransport: Failed flushing queued envelope, re-queuing:", err, queuedEnvelope);
                            this.handleDisconnection();
                            break;
                        }
                    }
                    resolve();
                };

                this.webSocket.onmessage = (event: MessageEvent) => {
                    if (!event.data) return;
                    try {
                        const envelope: Envelope = JSON.parse(event.data);
                        this.emitEvent({ type: envelope.type, envelope } as TransportEvent);
                    } catch (err: unknown) {
                        this.lastError = "WebSocketTransport: Failed to parse incoming message.";
                        this.emitEvent({ type: "error", error: this.lastError } as TransportErrorEvent);
                    }
                };

                this.webSocket.onclose = (event: CloseEvent) => {
                    this.isConnected = false;
                    this.webSocket = null;

                    this.emitEvent({
                        type: "close",
                        code: event.code,
                        reason: event.reason,
                    } as TransportCloseEvent);
                    this.handleDisconnection(event);
                    reject(new Error(`WebSocket closed: ${event.code} ${event.reason}`));
                };

                this.webSocket.onerror = (_: Event) => {
                    this.lastError = "WebSocketTransport: WebSocket error occurred.";
                    this.emitEvent({
                        type: "error",
                        error: this.lastError,
                    } as TransportErrorEvent);
                };
            } catch (err: unknown) {
                this.lastError = `WebSocketTransport: Failed to establish connection: ${String(err)}`;
                this.emitEvent({ type: "error", error: this.lastError } as TransportErrorEvent);
                this.webSocket = null;
                this.handleDisconnection();
                reject(err);
            }
        });
    }

    /**
     * Gracefully closes the WebSocket connection and clears any active reconnection timers.
     * If the WebSocket is open, it attempts a standard closure (code 1000).
     * Emits a 'disconnect' event with a 'closed_by_client' reason.
     */
    close(): void {
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }

        if (this.webSocket && (this.webSocket.readyState === WebSocket.OPEN || this.webSocket.readyState === WebSocket.CONNECTING)) {
            try {
                this.webSocket.close(1000, "Client initiated close");
            } catch (err: unknown) {
                console.warn("WebSocketTransport: Error while attempting to close WebSocket:", err);
            }
        }
        this.webSocket = null;
        this.isConnected = false;
        this.emitEvent({ type: "disconnect", reason: "closed_by_client" } as TransportDisconnectEvent);
    }

    /**
     * Handles the logic for a WebSocket disconnection event (triggered by `onclose` or a failed `send`).
     * It emits a 'disconnect' event and then initiates reconnection attempts
     * based on the configured `reconnectPolicy`.
     * @private
     * @param closeEvent Optional `CloseEvent` providing details about the closure.
     */
    private handleDisconnection(closeEvent?: CloseEvent): void {
        if (this.isConnected) {
            this.isConnected = false;
            this.emitEvent({ type: "disconnect", reason: closeEvent?.reason || "connection_lost" } as TransportDisconnectEvent);
        }

        const reconnectPolicy = this.options.reconnectPolicy!;
        if (!reconnectPolicy || reconnectPolicy.maxAttempts === 0 || this.reconnectAttempts >= reconnectPolicy.maxAttempts) {
            this.lastError = `WebSocketTransport: Max reconnection attempts (${this.reconnectAttempts}/${reconnectPolicy.maxAttempts}) exceeded. Permanent disconnection.`;
            this.emitEvent({
                type: "error",
                error: this.lastError,
                code: closeEvent?.code,
            } as TransportErrorEvent);
            return;
        }

        let delay = reconnectPolicy.initialDelay * Math.pow(reconnectPolicy.backoffFactor, this.reconnectAttempts);
        delay = Math.min(delay, reconnectPolicy.maxDelay);

        if (reconnectPolicy.jitter) {
            delay = delay * (1 - reconnectPolicy.jitter + (2 * reconnectPolicy.jitter * Math.random()));
        }

        this.reconnectTimeoutId = window.setTimeout(async () => {
            this.reconnectAttempts++;
            this.emitEvent({ type: "reconnect", attempt: this.reconnectAttempts, delay: delay } as TransportReconnectEvent);
            console.warn(`WebSocketTransport: Attempting to reconnect in ${delay.toFixed(0)}ms (attempt ${this.reconnectAttempts}/${reconnectPolicy.maxAttempts || 'unlimited'})`);

            try {
                await this.open();
                console.log('WebSocketTransport: Reconnected successfully.');
            } catch (error: unknown) {
                console.warn('WebSocketTransport: Reconnection attempt failed, scheduling next attempt:', error);
            }
        }, delay);
    }
}

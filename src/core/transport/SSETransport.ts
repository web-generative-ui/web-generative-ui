import type {TransportEvent, Transport, SSETransportOptions, Envelope, ControlPayload} from './types.ts';
import {DEFAULT_RECONNECT_POLICY} from './types.ts';
import type {Patch} from "../../schema.d.ts";

/**
 * Implements a Server-Sent Events (SSE) based transport mechanism for real-time communication.
 * This class manages the SSE connection, sends outgoing messages via HTTP POST,
 * and handles incoming SSE messages by emitting them as structured events.
 * It includes basic connection management, message queuing for disconnected states,
 * and an event-driven API for subscribers.
 */
export class SSETransport implements Transport{
    /**
     * Stores the last error message encountered by the transport, if any.
     * This property is publicly accessible for status monitoring.
     */
    public lastError?: string;
    /**
     * Indicates whether the SSE connection is currently established and ready for communication.
     * This property is publicly accessible for status monitoring.
     */
    public isConnected = false;
    /**
     * Configuration options for the SSE transport, including `streamURL`, `sendURL`,
     * `reconnectPolicy`, and `withCredentials`.
     */
    public options: SSETransportOptions;

    /**
     * The `EventSource` instance managing the SSE connection. It is `null` when not connected.
     * @private
     */
    private eventSource: EventSource | null = null;
    /**
     * A set of registered callback functions that listen to all generic `TransportEvent`s emitted by this transport.
     * @private
     */
    private eventCallbacks: Set<(event: TransportEvent) => void> = new Set();
    /**
     * Stores the ID of the timeout used for reconnection attempts, if active.
     * This allows for clearing pending reconnection attempts.
     * @private
     */
    private reconnectTimeoutId: number | NodeJS.Timeout | null = null;
    /**
     * A queue for `Envelope` messages that could not be sent immediately (e.g., due to disconnection).
     * These messages are flushed when the connection is re-established.
     * @private
     */
    private pendingMessages: Envelope[] = [];

    /**
     * Creates an instance of `SSETransport`.
     * Initializes with provided options, applying the `DEFAULT_RECONNECT_POLICY` and
     * `withCredentials: false` as base defaults if not explicitly overridden.
     * @param initialOptions Configuration options for the SSE transport, including `streamURL` and `sendURL`.
     */
    constructor(initialOptions: SSETransportOptions) {
        this.options = {
            reconnectPolicy: DEFAULT_RECONNECT_POLICY,
            withCredentials: false,
            ...initialOptions,
        };
        if (!this.options.streamURL && initialOptions.streamURL) this.options.streamURL = initialOptions.streamURL;
        if (!this.options.sendURL && initialOptions.sendURL) this.options.sendURL = initialOptions.sendURL;
    }

    /**
     * Sends an `Envelope` message to the server via an HTTP POST request.
     * If the SSE connection is not yet established, the message is queued in `pendingMessages`
     * and an attempt to `open()` the connection is initiated.
     * @param envelope The `Envelope` to send.
     * @returns A Promise that resolves when the message is sent successfully, or rejects on failure.
     * @throws {Error} If `sendURL` is not configured in options or if the HTTP request itself fails.
     */
    async send(envelope: Envelope): Promise<void> {
        if (!this.isConnected) {
            this.pendingMessages.push(envelope);
            if (!this.eventSource) {
                await this.open();
            }
            return;
        }

        try {
            if (!this.options.sendURL) {
                throw new Error('SSE `sendURL` is not configured');
            }
            const response = await fetch(this.options.sendURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.options.headers
                },
                body: JSON.stringify(envelope),
                credentials: this.options.withCredentials ? 'include' : 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error: any) {
            this.lastError = `Failed to send message: ${error.message}`;
            this.emitEvent({
                type: 'error',
                error: this.lastError
            });
            throw error;
        }
    }

    /**
     * Establishes the Server-Sent Events (SSE) connection to the `streamURL`.
     * If a connection already exists, it is closed gracefully before a new one is initiated.
     * This method includes a 10-second timeout for the initial connection attempt.
     * Upon successful connection, any `pendingMessages` are flushed.
     * @returns A Promise that resolves to `void` when the connection is successfully opened.
     * @throws {Error} If `streamURL` is not configured, or if the connection fails to establish or times out.
     */
    async open(): Promise<void> {
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        try {
            if (!this.options.streamURL) {
                throw new Error('SSE `streamURL` is not configured');
            }

            this.eventSource = new EventSource(this.options.streamURL, {
                withCredentials: this.options.withCredentials
            });

            this.setupEventSourceHandlers();

            await new Promise<void>((resolve, reject) => {
                const handleOpen = () => {
                    this.eventSource?.removeEventListener('open', handleOpen);
                    this.eventSource?.removeEventListener('error', handleError);
                    resolve();
                };

                const handleError = () => {
                    this.eventSource?.removeEventListener('open', handleOpen);
                    this.eventSource?.removeEventListener('error', handleError);
                    reject(new Error('Failed to connect to SSE endpoint'));
                };

                if (!this.eventSource) {
                    return reject(new Error('EventSource instance not created.'));
                }

                this.eventSource.addEventListener('open', handleOpen);
                this.eventSource.addEventListener('error', handleError);

                setTimeout(() => {
                    this.eventSource?.removeEventListener('open', handleOpen);
                    this.eventSource?.removeEventListener('error', handleError);
                    reject(new Error('SSE connection timeout'));
                }, 10000);
            });

            this.isConnected = true;
            this.emitEvent({ type: 'open' });

            while (this.pendingMessages.length > 0) {
                const message = this.pendingMessages.shift();
                if (message) {
                    await this.send(message);
                }
            }
        } catch (error: any) {
            this.lastError = `Failed to open connection: ${error.message}`;
            this.emitEvent({
                type: 'error',
                error: this.lastError
            });
            this.handleDisconnection();
            throw error;
        }
    }

    /**
     * Closes the SSE connection if it is open, and clears any active reconnection timers.
     * Emits a 'close' event if the transport was previously connected.
     */
    close(): void {
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        if (this.isConnected) {
            this.isConnected = false;
            this.emitEvent({ type: 'close' });
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
     * Registers a specific handler for incoming 'message' type `Envelope`s.
     * The callback receives the full `Envelope` object.
     * @param handler The callback function to invoke with the received `Envelope`.
     */
    onMessage(handler: (receivedEnvelope: Envelope) => void): void {
        this.onEvent((event) => {
            if (event.type === 'message') {
                handler(event.envelope);
            }
        });
    }

    /**
     * Registers a specific handler for incoming `Patch` payloads (derived from 'patch' type `Envelope`s).
     * The callback receives the `Patch` object directly.
     * @param handler The callback function to invoke with the received `Patch` object.
     */
    onPatch(handler: (receivedPatch: Patch) => void): void {
        this.onEvent((event) => {
            if (event.type === 'patch') {
                handler(event.envelope.payload as Patch);
            }
        });
    }

    /**
     * Registers a specific handler for incoming `ControlPayload` (derived from 'control' type `Envelope`s).
     * The callback receives the `ControlPayload` object directly.
     * @param handler The callback function to invoke with the received `ControlPayload` object.
     */
    onControl(handler: (receivedControl: ControlPayload) => void): void {
        this.onEvent((event) => {
            if (event.type === 'control') {
                handler(event.envelope.payload as ControlPayload);
            }
        });
    }

    /**
     * Registers a handler for the 'open' event, triggered when the transport connection is established.
     * @param handler The callback function to invoke.
     */
    onOpen(handler: () => void): void {
        this.onEvent((event) => {
            if (event.type === 'open') {
                handler();
            }
        });
    }

    /**
     * Registers a handler for the 'close' event, triggered when the transport connection is gracefully closed.
     * @param handler The callback function to invoke, receiving optional `code` and `reason` for the closure.
     */
    onClose(handler: (code?: number, reason?: string) => void): void {
        this.onEvent((event) => {
            if (event.type === 'close') {
                handler(event.code, event.reason);
            }
        });
    }

    /**
     * Registers a handler for 'error' events, triggered when an error occurs in the transport.
     * @param handler The callback function to invoke, receiving the error message and an optional error code.
     */
    onError(handler: (error: string, code?: number) => void): void {
        this.onEvent((event) => {
            if (event.type === 'error') {
                handler(event.error, event.code);
            }
        });
    }

    /**
     * Registers a handler for 'disconnect' events, triggered when the transport connection is unexpectedly lost.
     * @param handler The callback function to invoke, receiving an optional reason for the disconnection.
     */
    onDisconnect(handler: (reason?: string) => void): void {
        this.onEvent((event) => {
            if (event.type === 'disconnect') {
                handler(event.reason);
            }
        });
    }

    /**
     * Registers a handler for 'reconnect' events, triggered when a reconnection attempt is made.
     * @param handler The callback function to invoke, receiving the current attempt number and the calculated delay.
     */
    onReconnect(handler: (attempt: number, delay: number) => void): void {
        this.onEvent((event) => {
            if (event.type === 'reconnect') {
                handler(event.attempt, event.delay);
            }
        });
    }

    /**
     * Sets up the `EventSource` event handlers for processing incoming messages (`onmessage`)
     * and handling persistent connection errors (`onerror`).
     * This method is called once a new `EventSource` instance is created.
     * @private
     */
    private setupEventSourceHandlers(): void {
        if (!this.eventSource) return;

        this.eventSource.onmessage = (event: MessageEvent) => {
            try {
                const envelope: Envelope = JSON.parse(event.data);
                this.emitEvent({
                    type: envelope.type,
                    envelope: envelope,
                } as TransportEvent);
            } catch (error: any) {
                this.lastError = `Failed to parse SSE message: ${error.message}`;
                this.emitEvent({
                    type: 'error',
                    error: this.lastError,
                    code: undefined
                });
            }
        };

        this.eventSource.onerror = (_: Event) => {
            this.lastError = 'SSE connection error occurred';
            this.emitEvent({
                type: 'error',
                error: this.lastError,
                code: undefined,
            });
            this.handleDisconnection();
        };
    }

    /**
     * Dispatches a `TransportEvent` to all registered callback handlers in `eventCallbacks`.
     * Each handler is invoked within a `try-catch` block to prevent a single faulty handler
     * from stopping the execution of others.
     * @private
     * @param event The `TransportEvent` object to emit.
     */
    private emitEvent(event: TransportEvent): void {
        for (const callback of Array.from(this.eventCallbacks)) {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in SSETransport event callback:', error, event);
            }
        }
    }

    /**
     * Handles the logic for a disconnection event.
     * This method updates the `isConnected` state, emits a 'disconnect' event,
     * and then calls `close()` to formally shut down the `EventSource`.
     * Note: This implementation, as provided, does *not* include reconnection logic.
     * @private
     */
    private handleDisconnection(): void {
        if (this.isConnected) {
            this.isConnected = false;
            this.emitEvent({ type: 'disconnect' });
        }

        this.close();

        this.emitEvent({
            type: 'error',
            error: 'SSE Connection closed',
            code: undefined,
        });
    }
}

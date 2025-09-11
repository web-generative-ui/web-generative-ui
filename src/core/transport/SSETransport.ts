import type {TransportEvent, Transport, SSETransportOptions} from './types.ts';
import {DEFAULT_RECONNECT_POLICY} from './types.ts'
import type {Envelope} from "./types.ts";

/**
 * Implements a Server-Sent Events (SSE) based transport mechanism for real-time communication.
 * This class manages the SSE connection, sending outgoing messages via HTTP POST,
 * and handling incoming SSE messages by emitting them as events.
 */
export class SSETransport implements Transport{
    /**
     * Stores the last error message encountered by the transport, if any.
     */
    public lastError?: string;
    /**
     * Indicates whether the SSE connection is currently established.
     */
    public isConnected = false;
    /**
     * Configuration options for the SSE transport, including URLs, headers, and reconnection policy.
     */
    public options: SSETransportOptions;

    /**
     * The EventSource instance managing the SSE connection. Null if not connected.
     * @private
     */
    private eventSource: EventSource | null = null;
    /**
     * A set of registered callback functions that listen to all transport events.
     * @private
     */
    private eventCallbacks: Set<(event: TransportEvent) => void> = new Set();
    /**
     * Stores the ID of the timeout used for reconnection attempts, if active.
     * @private
     */
    private reconnectTimeoutId: any = null;
    /**
     * A queue for messages that need to be sent when the connection is established.
     * @private
     */
    private pendingMessages: Envelope[] = [];

    /**
     * Creates an instance of SSETransport.
     * Initializes with provided options, applying the default reconnection policy and credential setting.
     * @param initialOptions Configuration options for the SSE transport.
     */
    constructor(initialOptions: SSETransportOptions) {
        // Merge provided options with defaults, ensuring specific options aren't overwritten
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
     * If the SSE connection is not yet established, the message is queued and `open()` is called.
     * @param envelope The `Envelope` to send.
     * @returns A Promise that resolves when the message is sent successfully, or rejects on failure.
     * @throws {Error} If `sendURL` is not configured or HTTP request fails.
     */
    async send(envelope: Envelope): Promise<void> {
        if (!this.isConnected) {
            this.pendingMessages.push(envelope);

            // If not connected, but no connection attempt is active, start one.
            // This implicitly handles the initial connection or lazy reconnect.
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
            this.emitEvent({
                type: 'error',
                error: `Failed to send message: ${error.message}`
            });
            throw error;
        }
    }

    /**
     * Establishes the Server-Sent Events (SSE) connection.
     * If a connection already exists, it is closed first. This method also handles
     * sending any pending messages after a successful connection.
     * Includes a 10-second timeout for the initial connection.
     * @returns A Promise that resolves when the connection is successfully opened.
     * @throws {Error} If `streamURL` is not configured, or connection fails/times out.
     */
    async open(): Promise<void> {
        // Clear any existing reconnected timer if `open` is called manually
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }

        // If an event source already exists, close it gracefully before opening a new one.
        // This handles cases where `open` is called to force a reconnecting.
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

            // Setup persistent handlers for messages and errors
            this.setupEventSourceHandlers();

            // Use a promise to wait for the initial 'open' or 'error' event for a new connection
            await new Promise<void>((resolve, reject) => {
                const handleOpen = () => {
                    this.eventSource?.removeEventListener('open', handleOpen);
                    this.eventSource?.removeEventListener('error', handleError); // Clean up error listener too
                    resolve();
                };

                const handleError = () => {
                    this.eventSource?.removeEventListener('open', handleOpen); // Clean up open listener too
                    this.eventSource?.removeEventListener('error', handleError);
                    reject(new Error('Failed to connect to SSE endpoint'));
                };

                if (!this.eventSource) { // Safety check should not happen right after new EventSource
                    return reject(new Error('EventSource instance not created.'));
                }

                this.eventSource.addEventListener('open', handleOpen);
                this.eventSource.addEventListener('error', handleError);

                // Timeout for an initial connection attempt
                setTimeout(() => {
                    this.eventSource?.removeEventListener('open', handleOpen);
                    this.eventSource?.removeEventListener('error', handleError);
                    reject(new Error('SSE connection timeout'));
                }, 10000); // 10-second connection timeout
            });

            this.isConnected = true;
            this.emitEvent({ type: 'open' });

            // After a successful connection, send any pending messages
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
            this.handleDisconnection(); // This will now attempt to reconnect
            throw error; // Propagate error for immediate callers
        }
    }

    /**
     * Closes the SSE connection and clears any active reconnection timers.
     * Emits a 'close' event.
     */
    close(): void {
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null; // Clear reference to allow garbage collection
        }

        if (this.isConnected) { // Only emit 'close' if it was actually connected
            this.isConnected = false;
            this.emitEvent({ type: 'close' });
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
     * Registers a handler for 'message' type envelopes.
     * @param handler The callback function to invoke with the received envelope.
     */
    onMessage(handler: (receivedEnvelope: Envelope) => void): void {
        this.onEvent((event) => {
            if (event.type === 'message') {
                handler(event.envelope);
            }
        });
    }

    /**
     * Registers a handler for 'patch' type envelopes.
     * @param handler The callback function to invoke with the received patch payload.
     */
    onPatch(handler: (receivedPatch: any) => void): void {
        this.onEvent((event) => {
            if (event.type === 'patch') {
                handler(event.envelope.payload);
            }
        });
    }

    /**
     * Registers a handler for 'control' type envelopes.
     * @param handler The callback function to invoke with the received control payload.
     */
    onControl(handler: (receivedControl: any) => void): void {
        this.onEvent((event) => {
            if (event.type === 'control') {
                handler(event.envelope.payload);
            }
        });
    }

    /**
     * Registers a handler for the 'open' event, triggered when the connection is established.
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
     * Registers a handler for the 'close' event, triggered when the connection is closed gracefully.
     * @param handler The callback function to invoke.
     */
    onClose(handler: () => void): void {
        this.onEvent((event) => {
            if (event.type === 'close') {
                handler();
            }
        });
    }

    /**
     * Registers a handler for 'error' events, triggered when an error occurs in the transport.
     * @param handler The callback function to invoke with the error message.
     */
    onError(handler: (error: string) => void): void {
        this.onEvent((event) => {
            if (event.type === 'error') {
                handler(event.error!); // event.error will be defined for the 'error' type
            }
        });
    }

    /**
     * Registers a handler for 'disconnect' events, triggered when the connection is unexpectedly lost.
     * @param handler The callback function to invoke.
     */
    onDisconnect(handler: () => void): void {
        this.onEvent((event) => {
            if (event.type === 'disconnect') {
                handler();
            }
        });
    }

    /**
     * Registers a handler for 'reconnect' events, triggered when a reconnection attempt is made.
     * @param handler The callback function to invoke.
     */
    onReconnect(handler: () => void): void {
        this.onEvent((event) => {
            if (event.type === 'reconnect') {
                handler();
            }
        });
    }

    /**
     * Sets up the EventSource event handlers for 'message' and persistent 'error' handling.
     * This is called once a new EventSource is created.
     * @private
     */
    private setupEventSourceHandlers(): void {
        if (!this.eventSource) return;

        this.eventSource.onmessage = (event: MessageEvent) => {
            try {
                const envelope: Envelope = JSON.parse(event.data);
                this.emitEvent({
                    type: envelope.type, // Type is already inferred from Envelope
                    envelope
                });
            } catch (error: any) {
                this.lastError = `Failed to parse SSE message: ${error.message}`;
                this.emitEvent({
                    type: 'error',
                    error: this.lastError
                });
            }
        };

        // This onerror handles ongoing connection errors *after* the initial connection.
        this.eventSource.onerror = (_: Event) => {
            this.lastError = 'SSE connection error occurred';
            this.emitEvent({
                type: 'error',
                error: this.lastError
            });
            this.handleDisconnection(); // Trigger reconnection attempts
        };
    }

    /**
     * Dispatches a transport event to all registered handlers.
     * @private
     * @param event The `TransportEvent` to emit.
     */
    private emitEvent(event: TransportEvent): void {
        for (const callback of this.eventCallbacks) {
            try {
                callback(event);
            } catch (error) {
                console.error('Error in transport event callback:', error);
            }
        }
    }

    /**
     * Handles the logic for a disconnection, including emitting a 'disconnect' event,
     * closing the connection, and initiating a reconnection attempt based on policy.
     * @private
     */
    private handleDisconnection(): void {
        this.isConnected = false;
        this.emitEvent({ type: 'disconnect' });

        this.close();

        this.emitEvent({
            type: 'error',
            error: 'Connection closed'
        });
    }
}

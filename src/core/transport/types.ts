import type { Patch } from '../../schema.d.ts';

/**
 * Defines the structure for various control messages that can be sent or received.
 * This is used as the `payload` for an `Envelope` of type 'control'.
 */
export interface ControlPayload {
    /** The specific event name for the control message (e.g., 'conversation_started', 'typing_start', 'typing_end'). */
    event?: string;
    /** Optional conversation ID, often included for context within a control message. */
    convId?: string;
    /** Allows for arbitrary additional properties specific to the control message. */
    [key: string]: any;
}

/**
 * Represents a generic message container (`Envelope`) for communication between the Generative UI
 * frontend and a backend service.
 *
 * The `payload` field's structure depends on the `type` of the envelope:
 * - If `type` is 'patch', `payload` is expected to be a `Patch` object.
 * - If `type` is 'message', `payload` is expected to be an object containing message `content`
 *   (e.g., string, `Component`, `Children`, or a generic object).
 * - If `type` is 'control', `payload` is expected to be a `ControlPayload` object.
 */
export type Envelope = {
    /** The type of the envelope, indicating its purpose. */
    type: 'patch' | 'message' | 'control';
    /** Optional sequential number for ordering or acknowledgment of envelopes. */
    seq?: number;
    /** The unique identifier for the conversation this envelope belongs to. Required for conversation context. */
    convId: string;
    /** Optional unique identifier for the specific turn within the conversation. */
    turnId?: string;
    /** The role of the sender of this envelope (e.g., 'assistant', 'user', 'system'). */
    role?: 'assistant' | 'user' | 'system';
    /** Optional timestamp when the envelope was created or sent. */
    timestamp?: string;
    /** Optional model-specific metadata, allowing for arbitrary key-value pairs. */
    modelContext?: Record<string, any>;
    /**
     * The actual content or instruction carried by the envelope.
     * Its structure depends on the `type` property (e.g., `Patch` for 'patch', message content for 'message', `ControlPayload` for 'control').
     */
    payload: any;
}

/**
 * Defines the parameters for a robust reconnection strategy, typically used for WebSockets or SSE transports.
 */
export interface ReconnectPolicy {
    /** The maximum number of reconnection attempts before the transport gives up. Set to 0 for unlimited attempts. */
    maxAttempts: number;
    /** The initial delay in milliseconds before the first reconnection attempt. */
    initialDelay: number;
    /** The factor by which the delay increases with each subsequent attempt (e.g., 1.5 for exponential backoff). */
    backoffFactor: number;
    /** The maximum delay in milliseconds allowed between reconnection attempts. */
    maxDelay: number;
    /** If `true`, a random jitter will be added to the calculated delay to prevent all clients from reconnecting simultaneously. */
    jitter: number;
}

/**
 * Base interface for all transport-specific configuration options, providing common properties.
 */
export interface TransportOptionsBase {
    /** Optional reconnection policy to apply for the transport. If not provided, `DEFAULT_RECONNECT_POLICY` is used. */
    reconnectPolicy?: ReconnectPolicy;
    /** Optional HTTP headers to send with the transport connection or messages. */
    headers?: Record<string, string>;
}

/**
 * Specific options for configuring an SSE (Server-Sent Events) transport.
 */
export interface SSETransportOptions extends TransportOptionsBase {
    /** The URL for the SSE stream endpoint (for receiving messages). Required. */
    streamURL: string;
    /** The URL for sending outgoing messages via HTTP POST. Required. */
    sendURL: string;
    /** The type of the transport, must be 'sse'. */
    type: 'sse';
    /** If `true`, credentials (e.g., cookies, HTTP authentication) will be sent with requests. */
    withCredentials?: boolean;
}

/**
 * Specific options for configuring a WebSocket transport.
 */
export interface WebSocketTransportOptions extends TransportOptionsBase {
    /** The WebSocket URL to connect to (e.g., `ws://localhost:8080/ws`). Required. */
    url: string;
    /** The type of the transport must be 'websocket'. */
    type: 'websocket';
    /** Optional interval in milliseconds to send heartbeat (ping) messages to keep the connection alive. */
    heartbeatInterval?: number;
    /** Optional connection timeout in milliseconds for establishing the WebSocket connection. */
    timeout?: number;
}

/**
 * A union type representing all supported transport configuration options.
 */
export type TransportOptions = SSETransportOptions | WebSocketTransportOptions;

/**
 * Defines the contract for any transport mechanism used for communication with a backend service.
 * Implementations must provide methods for sending, opening, closing connections, and
 * a robust event-driven system for handling lifecycle and incoming data.
 */
export interface Transport {
    /** The last error message encountered by the transport, if any. */
    lastError?: string;
    /** Indicates whether the transport connection is currently established. */
    isConnected: boolean;
    /** The configuration options used to initialize this transport. */
    options: TransportOptions;

    /**
     * Sends an `Envelope` message to the backend service.
     * The message may be queued if the transport is not currently connected.
     * @param envelope The `Envelope` to send.
     * @returns A Promise that resolves when the message is sent or successfully queued.
     */
    send(envelope: Envelope): Promise<void>;
    /**
     * Establishes the transport connection.
     * @returns A Promise that resolves when the connection is successfully opened.
     */
    open(): Promise<void>;
    /**
     * Closes the transport connection.
     */
    close(): void;

    /**
     * Registers a generic callback function to be invoked for all transport events.
     * @param callback The handler function, receiving a `TransportEvent`.
     */
    onEvent(callback: (event: TransportEvent) => void): void;
    /**
     * Unregisters a generic callback function from receiving transport events.
     * @param handler The handler function to remove.
     */
    offEvent(handler: (event: TransportEvent) => void): void;

    /**
     * Registers a specific handler for incoming 'message' type envelopes.
     * The `envelope` parameter is expected to conform to `Envelope` with `type: 'message'`.
     * @param handler The handler function.
     */
    onMessage(handler: (envelope: Envelope) => void): void;
    /**
     * Registers a specific handler for incoming 'patch' type envelopes.
     * The `patch` parameter is expected to be the `payload` of an `Envelope` with `type: 'patch'`, i.e., a `Patch` object.
     * @param handler The handler function.
     */
    onPatch(handler: (patch: Patch) => void): void;
    /**
     * Registers a specific handler for incoming 'control' type envelopes.
     * The `control` parameter is expected to be the `payload` of an `Envelope` with `type: 'control'`, i.e., a `ControlPayload` object.
     * @param handler The handler function.
     */
    onControl(handler: (control: ControlPayload) => void): void;
    /**
     * Registers a handler for the 'open' event, triggered when the connection is established.
     * @param handler The handler function.
     */
    onOpen(handler: () => void): void;
    /**
     * Registers a handler for the 'close' event, triggered when the connection is closed.
     * @param handler The handler function, receiving optional close code and reason.
     */
    onClose(handler: (code?: number, reason?: string) => void): void;
    /**
     * Registers a handler for 'error' events, triggered when an error occurs in the transport.
     * @param handler The handler function, receiving the error message and optional code.
     */
    onError(handler: (error: string, code?: number) => void): void;
    /**
     * Registers a handler for 'disconnect' events, triggered when the connection is unexpectedly lost.
     * @param handler The handler function, receiving an optional reason.
     */
    onDisconnect(handler: (reason?: string) => void): void;
    /**
     * Registers a handler for 'reconnect' events, triggered when a reconnection attempt is made.
     * @param handler The handler function, receiving the attempt number and the calculated delay.
     */
    onReconnect(handler: (attempt: number, delay: number) => void): void;
}

/**
 * The default reconnection policy used by transport implementations if not overridden by `TransportOptions`.
 */
export const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = {
    maxAttempts: 10,
    initialDelay: 1000,
    backoffFactor: 1.5,
    maxDelay: 30000,
    jitter: 0.5,
};

/** Event emitted when an incoming 'message' type `Envelope` is received. */
export interface TransportMessageEvent {
    type: 'message';
    /** The incoming `Envelope` of type 'message'. */
    envelope: Envelope;
}

/** Event emitted when an incoming 'patch' type `Envelope` is received. */
export interface TransportPatchEvent {
    type: 'patch';
    /** The incoming `Envelope` of type 'patch'. */
    envelope: Envelope;
}

/** Event emitted when an incoming 'control' type `Envelope` is received. */
export interface TransportControlEvent {
    type: 'control';
    /** The incoming `Envelope` of type 'control'. */
    envelope: Envelope;
}

/** Event emitted when the transport connection is successfully opened. */
export interface TransportOpenEvent {
    type: 'open';
}

/** Event emitted when the transport connection is closed. */
export interface TransportCloseEvent {
    type: 'close';
    /** Optional WebSocket close code (e.g., 1000 for normal closure). */
    code?: number;
    /** Optional reason string provided by the server or browser for the closure. */
    reason?: string;
}

/** Event emitted when an error occurs in the transport layer. */
export interface TransportErrorEvent {
    type: 'error';
    /** The error message describing the issue. */
    error: string;
    /** Optional error code (e.g., HTTP status, WebSocket close code). */
    code?: number;
}

/** Event emitted when the transport connection is disconnected unexpectedly. */
export interface TransportDisconnectEvent {
    type: 'disconnect';
    /** Optional reason for the unexpected disconnection. */
    reason?: string;
}

/** Event emitted when a reconnection attempt is initiated after a disconnection. */
export interface TransportReconnectEvent {
    type: 'reconnect';
    /** The current reconnection attempt number. */
    attempt: number;
    /** The calculated delay in milliseconds before this reconnection attempt is made. */
    delay: number;
}

/**
 * A discriminated union of all possible event types that a `Transport` can emit.
 * This allows for type-safe handling of different transport lifecycle and data events.
 */
export type TransportEvent =
    | TransportMessageEvent
    | TransportPatchEvent
    | TransportControlEvent
    | TransportOpenEvent
    | TransportCloseEvent
    | TransportErrorEvent
    | TransportDisconnectEvent
    | TransportReconnectEvent;

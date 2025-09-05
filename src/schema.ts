import type {ActionHandler} from "./core/action-handler/types.ts";

export interface GenerativeUiPayload {
    children: Children;
}

export interface SessionOptions {
    /** The target HTML element to render the UI into. */
    target: HTMLElement;
    /** The SSE endpoint to connect to for receiving UI patches. */
    streamEndpoint: string;
    /** The default HTTP endpoint to send user actions to (for HATEOAS or unhandled actions). */
    actionEndpoint?: string;
    /** An optional array of modular client-side action handlers. */
    actionHandlers?: ActionHandler[];
    /** An optional initial UI payload to render immediately without streaming. */
    initialPayload?: GenerativeUiPayload;
}

export interface Session {
    /** The current state of the session's connection. */
    readonly state: 'initializing' | 'streaming' | 'idle' | 'closed';
    /**
     * Programmatically sends an action and the current UI context to the backend.
     * Useful for initiating a conversation or triggering events from outside the rendered UI.
     * @param action The action object to send.
     */
    sendAction?: (action: Action) => Promise<void>;
    /**
     * Manually renders a full UI payload, clearing any existing content.
     * @param payload The GenerativeUiPayload to render.
     */
    render: (payload: GenerativeUiPayload) => Promise<void>;
    /**
     * Closes the SSE connection and cleans up all event listeners.
     * Essential for preventing memory leaks in single-page applications.
     */
    destroy: () => void;
}

export interface Action {
    /**
     * For client-side handled actions (e.g., UI changes, simple dispatches).
     * The application's ActionDispatcher will look for a handler for this type.
     */
    type?: string;

    /**
     * For server-driven, HATEOAS-style actions.
     * If present, the dispatcher will make an HTTP request to this URL.
     */
    href?: string;

    /** The HTTP method to use with 'href'. Defaults to 'POST'. */
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';

    /** Data to be sent with the action, either to the client-side handler or as the body of the HTTP request. */
    payload?: { [key: string]: any };
}

export type PatchOperation = 'add' | 'update' | 'remove';

export interface Patch {
    /** The operation to perform. */
    op: PatchOperation;

    /**
     * For 'add' operations: The ID of the parent component to append to.
     * If null or undefined, appends to the root container.
     */
    path?: string | null;

    /**
     * For 'update' and 'remove' operations: The ID of the component to target.
     */
    targetId?: string;

    /** The component data to use for the 'add' or 'update' operation. */
    value: Component;
}

// --- Core Definitions ---

export interface TransitionConfig {
    enter: string;
    enterActive: string;
    exit: string;
    exitActive: string;
    update: string;
}

/**
 * The base interface for all UI components. It ensures that every component
 * can have a unique 'id', which is essential for partial/streamed updates.
 */
export interface BaseComponent {
    component: string;
    /**
     * A unique identifier for this component instance. Crucial for partial updates.
     */
    id?: string;
}

export type ElementModule = {
    default: typeof HTMLElement;
};

/**
 * An array of UI components to be rendered (can be a nested child of a child component).
 */
export type Children = Component[];

/**
 * A union of all possible UI components that can be rendered.
 */
export type Component =
    | Table
    | Chart
    | Grid
    | Spacer
    | Timeline
    | Stream
    | Carousel
    | Card
    | Text
    | CodeBlock
    | Image
    | Video
    | Icon
    | Button
    | Link
    | Badge
    | Progress
    | Loading
    | Box
    | Divider
    | Tabs
    | CollapseBlock
    | Reference

// --- Component-Specific Interfaces ---

export interface Table extends BaseComponent {
    component: 'table';
    data: { [k: string]: any; }[];
    columns: { key: string; header: string; }[];
    children?: { items: (Image | Button | Text | Badge | Link)[]; };
}

export interface Chart extends BaseComponent {
    component: 'chart';
    'chart-type': 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'area' | 'radar' | 'heatmap';
    data: {
        labels?: string[];
        datasets: {
            label?: string;
            data: (number | { [k: string]: any; })[];
            style?: { [k: string]: string; };
        }[];
    };
    options?: { [k: string]: any; };
}

export interface Grid extends BaseComponent {
    component: 'grid';
    columns?: number | string;
    gap?: string;
    children: { items: (Card | Image | Button)[]; };
}

export interface Spacer extends BaseComponent {
    component: 'spacer';
}

export interface Timeline extends BaseComponent {
    component: 'timeline';
    orientation?: 'vertical' | 'horizontal';
    items: {
        time?: string;
        title: string;
        description?: string;
        icon?: Icon;
        media?: Image | Video;
        status?: 'completed' | 'active' | 'upcoming' | 'default';
        extra?: { [k: string]: any; };
    }[];
}

export interface Stream extends BaseComponent {
    component: 'stream';
    direction?: 'up' | 'down';
    items: {
        id?: string; // This is an ID for an *item within* the stream, distinct from the stream's own ID
        timestamp?: string;
        author?: string;
        content: string | Text | Card | Image | Video | CodeBlock;
        status?: 'pending' | 'completed' | 'error';
        extra?: { [k: string]: any; };
    }[];
}

export interface Carousel extends BaseComponent {
    component: 'carousel';
    autoplay?: boolean;
    interval?: number;
    items: (Image | Card | Video)[];
}

export interface Card extends BaseComponent {
    component: 'card';
    title: string;
    children?: { items?: Children; };
}

export interface Text extends BaseComponent {
    component: 'text';
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle' | 'body' | 'caption' | 'overline' | 'highlight-info' | 'highlight-warning' | 'highlight-error' | 'highlight-success' | 'highlight-accent';
    text: string;
}

export interface CodeBlock extends BaseComponent {
    component: 'code-block';
    language?: string;
    value: string;
    'line-numbers'?: boolean;
}

export interface Image extends BaseComponent {
    component: 'image';
    src: string;
    alt?: string;
    caption?: string;
    fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

export interface Video extends BaseComponent {
    component: 'video';
    src: string;
    poster?: string;
    autoplay?: boolean;
    loop?: boolean;
    controls?: boolean;
    muted?: boolean;
}

export interface Icon extends BaseComponent {
    component: 'icon';
    name: string;
    variant?: 'outlined' | 'filled' | 'rounded' | 'sharp';
    size?: string;
}

export interface Button extends BaseComponent {
    component: 'button';
    label: string;
    action?: string;
}

export interface Link extends BaseComponent {
    component: 'link';
    href: string;
    target?: '_self' | '_blank' | '_parent' | '_top';
    children: { items?: (Text | Icon | Image | Badge)[]; };
}

export interface Badge extends BaseComponent {
    component: 'badge';
    text: string;
    variant?: 'info' | 'success' | 'warning' | 'error' | 'neutral';
    icon?: Icon & {
        position?: 'left' | 'right';
        size?: string;
    };
}

export interface Progress extends BaseComponent {
    component: 'progress';
    value?: number;
    variant?: 'linear' | 'circular';
    label?: string;
    indeterminate?: boolean;
}

export interface Loading extends BaseComponent {
    component: 'loading';
    message?: string;
    variant?: 'spinner' | 'skeleton' | 'dots' | 'bar';
}

export interface Box extends BaseComponent {
    component: 'box';
    children?: { items?: Children; };
}

export interface Divider extends BaseComponent {
    component: 'divider';
    orientation?: 'horizontal' | 'vertical';
    label?: string;
}

export interface Tabs extends BaseComponent {
    component: 'tabs';
    tabs: {
        id: string;
        label: string;
        content: Component[];
    }[];
    'active-tab'?: string;
}

export interface CollapseBlock extends BaseComponent {
    component: 'collapse-block';
    title: string;
    collapsed?: boolean;
    content: Component[];
}

export interface Reference extends BaseComponent {
    component: 'reference';
    label: string;
    target: string;
    description?: string;
}

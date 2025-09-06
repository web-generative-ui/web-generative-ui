import type {Transport, TransportOptions} from "./core/transport/types.ts";

export interface GenerativeUiPayload {
    children: Children;
}

export type GenerativeUIConfig = {
    container: string | HTMLElement;
    /** Optional: streamUrl is only required when using the legacy EventSource path. */
    streamUrl?: string;
    /** Accept either a ready Transport instance or transport options to create one. */
    transport?: Transport | TransportOptions;
    /** Clear container before first render (default: true) */
    clearContainer?: boolean;
    /** Pass-through options to EventSource (optional) */
    eventSourceInit?: EventSourceInit;
    /** Hook errors (JSON parse/apply failures) */
    onError?: (err: unknown, raw?: string) => void;
    /** Hook when connection established — receives either EventSource (legacy) or Transport instance */
    onOpen?: (conn: EventSource | Transport) => void;
    /** Hook when server signals close or error ends the stream */
    onClose?: () => void;
};

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
    /** Number of columns (number for fixed, string for css value like 'repeat(auto-fit, minmax(200px, 1fr))') */
    columns?: number | string;
    /** Gap between grid items (default 1rem) */
    gap?: string;
    /** Children that can be placed inside the grid */
    children: { items: (Card | Image | Button)[] };
}

export interface Spacer extends BaseComponent {
    component: 'spacer';
    size?: string;
    direction?: 'vertical' | 'horizontal';
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
    icon?: Icon & {
        position?: 'left' | 'right';
    };
}

export interface Link extends BaseComponent {
    component: 'link';
    href: string;
    target?: '_blank' | '_self' | '_parent' | '_top';
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

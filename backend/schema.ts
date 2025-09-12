/**
 * Defines the type of operation for a UI patch.
 */
export type PatchOperation = 'add' | 'update' | 'remove';

/**
 * Represents a structured instruction to modify the UI (add, update, or remove a component).
 */
export interface Patch {
    /** The operation to perform on the UI. */
    op: PatchOperation;
    /**
     * For 'add' operations: The ID of the parent component to append the new component to.
     * If `null` or `undefined`, the component is appended to the root container (`GenerativeUIConfig.container`).
     */
    path?: string | null;
    /**
     * For 'update' and 'remove' operations: The ID of the existing component to target.
     * Required for 'update' and 'remove' operations.
     */
    targetId?: string;
    /**
     * The component data (`Component` object) to use for the 'add' or 'update' operation.
     * For 'remove' operations, this property is typically omitted as only `targetId` is needed.
     */
    value?: Component;
}

// --- Core Definitions ---

/**
 * Defines the CSS class names used for UI component transition animations (enter, exit, update, highlight).
 * Custom UI components can provide their own `transitionConfig` static property.
 */
export interface TransitionConfig {
    /** CSS class for the entering state of a component. */
    enter: string;
    /** CSS class for the active entering animation state. */
    enterActive: string;
    /** CSS class for the exiting state of a component. */
    exit: string;
    /** CSS class for the active exiting animation state. */
    exitActive: string;
    /** CSS class for an update/highlight animation. */
    update: string;
    /** Alias for `update`, for clarity in specific contexts. */
    highlight: string;
}

/**
 * Represents a dynamically loaded module that exports a custom `HTMLElement` subclass as its default.
 */
export type ElementModule = {
    default: typeof HTMLElement;
};

/**
 * An array of UI components that can be rendered as children within another component.
 * This type is used for nested component structures.
 */
export type Children = Component[];

/**
 * Optional layout metadata used by container components (e.g., `Grid`, `Box`)
 * to position and size their children.
 */
export interface LayoutMeta {
    /**
     * Grid or flex span: number of columns (numeric) or a CSS span value (string, e.g., 'span 2').
     */
    span?: number | string;
    /** Ordering hint for flex/grid items. */
    order?: number;
    /** Self-alignment within a flex or grid container ('start', 'center', 'end', 'stretch'). */
    align?: 'start' | 'center' | 'end' | 'stretch';
    /** Flex-grow factor (numeric). */
    grow?: number;
    /** Flex-basis value (e.g., '200px', '30%'). */
    basis?: string;
    /** Named grid area for grid layout. */
    area?: string;
}

/**
 * The base interface for all UI components. It ensures every component has
 * essential properties for identification, reconciliation, and layout.
 */
export interface BaseComponent {
    /** The unique string identifier for the component type (e.g., 'card', 'text'). */
    component: string;
    /**
     * An optional stable identifier used for efficient DOM reconciliation by the `Interpreter`.
     * If provided, the `Interpreter` will attempt to reuse elements with matching keys.
     */
    key?: string;
    /**
     * Optional layout hints consumed by container components to control positioning and sizing.
     */
    layout?: LayoutMeta;
    /**
     * An optional unique HTML `id` attribute for the component's root element.
     * Essential for targeting specific components with `Patch` operations.
     */
    id?: string;
    /**
     * Optional inline CSS styles to apply to the component's root element.
     * Keys are CSS property names (camelCase or kebab-case), values are CSS values.
     */
    style?: { [key: string]: string | number; };
    /**
     * Optional arbitrary metadata associated with the component. Can be used for custom logic
     * or to pass additional data not covered by other properties.
     */
    meta?: { [key: string]: any; };
}

/**
 * A union of all possible UI components that can be dynamically rendered by the library.
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
    | Error;

// --- Component-Specific Interfaces ---

/**
 * Renders data in a tabular format.
 */
export interface Table extends BaseComponent {
    component: 'table';
    /** The array of data objects to display, where each object represents a row. */
    data: { [k: string]: any; }[];
    /** Definitions for the table columns, mapping data keys to headers. */
    columns: {
        /** The key in the data objects that corresponds to this column. */
        key: string;
        /** The display header for this column. */
        header: string;
        /** Optional width for the column (e.g., '100 px', '2nd'). */
        width?: string;
        /** Optional alignment for text in the column. */
        align?: 'left' | 'center' | 'right';
    }[];
    /** Optional child components to be rendered within the table (e.g., for custom cells or a footer). */
    children?: Children;
}

/**
 * Renders various types of charts (e.g., bar, line, pie).
 */
export interface Chart extends BaseComponent {
    component: 'chart';
    /** The type of chart to render. */
    'chart-type': 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'area' | 'radar' | 'heatmap';
    /** The data to be visualized in the chart. */
    data: {
        /** Optional labels for the X-axis or segments (e.g., for bar/line charts). */
        labels?: string[];
        /** Array of datasets, where each dataset represents a series of data points. */
        datasets: {
            /** Label for the dataset (e.g., legend entry). */
            label?: string;
            /** The actual data points for the dataset. */
            data: (number | { [k: string]: any; })[];
            /** Optional inline style for this specific dataset (e.g., color). */
            style?: { [k: string]: string; };
        }[];
    };
    /** Optional configuration options for the chart library being used (e.g., Chart.js options). */
    options?: { [k: string]: any; };
}

/**
 * Renders child components in a grid layout.
 */
export interface Grid extends BaseComponent {
    component: 'grid';
    /**
     * Defines the number of columns. Can be a number (e.g., 3 for 3 equal columns)
     * or a CSS grid-template-columns value (e.g., 'repeat(auto-fit, minmax(200px, 1fr))').
     */
    columns?: number | string;
    /** Gap between grid items (e.g., '1rem', '16px'). Defaults to '1rem'. */
    gap?: string;
    /** The child components to be arranged within the grid. */
    children: Children;
}

/**
 * Provides a flexible empty space for layout.
 */
export interface Spacer extends BaseComponent {
    component: 'spacer';
    /** The size of the spacer (e.g., '1rem', '16 px', or a number for relative units). */
    size?: string | number;
    /** The orientation of the spacer. 'vertical' adds height, 'horizontal' adds width. */
    direction?: 'vertical' | 'horizontal';
}

/**
 * Displays a series of events along a timeline.
 */
export interface Timeline extends BaseComponent {
    component: 'timeline';
    /** The orientation of the timeline. */
    orientation?: 'vertical' | 'horizontal';
    /** An array of events to display on the timeline. */
    items: {
        /** Optional timestamp for the event. */
        time?: string;
        /** The main title or heading for the timeline event. */
        title: string;
        /** Optional detailed description of the event. */
        description?: string;
        /** Optional icon to display next to the timeline event. */
        icon?: Icon;
        /** Optional media (image or video) to display with the event. */
        media?: Image | Video;
        /** The status of the event ('completed', 'active', 'upcoming', 'default'). */
        status?: 'completed' | 'active' | 'upcoming' | 'default';
        /** Optional arbitrary extra data associated with the timeline item. */
        extra?: { [k: string]: any; };
        /** Optional stable ID for reconciliation of individual timeline items. */
        key?: string;
    }[];
}

/**
 * Renders a continuous stream of content, typically used for chat or log-like interfaces.
 */
export interface Stream extends BaseComponent {
    component: 'stream';
    /** The direction in which new items are added ('up' for top, 'down' for bottom). */
    direction?: 'up' | 'down';
    /** An array of items to display in the stream. */
    items: {
        /** Item-level unique ID (for streaming entries themselves). */
        id?: string;
        /** Optional timestamp for the stream item. */
        timestamp?: string;
        /** Optional author or source of the stream item. */
        author?: string;
        /** The content of the stream item, which can be a string or another UI component. */
        content: string | Component;
        /** Status of the stream item ('pending', 'completed', 'error'). */
        status?: 'pending' | 'completed' | 'error';
        /** Optional arbitrary extra data associated with the stream item. */
        extra?: { [k: string]: any; };
        /** Optional stable ID for reconciliation of individual stream items. */
        key?: string;
    }[];
}

/**
 * Displays a rotating carousel of images, cards, or videos.
 */
export interface Carousel extends BaseComponent {
    component: 'carousel';
    /** If `true`, the carousel automatically advances slides. */
    autoplay?: boolean;
    /** Interval in milliseconds between automatic slide transitions. */
    interval?: number;
    /** The array of items (images, cards, or videos) to display in the carousel. */
    items: (Image | Card | Video)[];
}

/**
 * A versatile container component with a title, often used to group related content.
 */
export interface Card extends BaseComponent {
    component: 'card';
    /** The title displayed at the top of the card. */
    title: string;
    /** The child components to be rendered within the card's body. */
    children?: Children;
}

/**
 * Renders a block of text with various styling options.
 */
export interface Text extends BaseComponent {
    component: 'text';
    /**
     * Semantic or stylistic variant for the text (e.g., 'h1' for heading, 'body' for paragraph).
     */
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle' | 'body' | 'caption' | 'overline' | 'highlight-info' | 'highlight-warning' | 'highlight-error' | 'highlight-success' | 'highlight-accent';
    /** The actual text content to display. */
    text: string;
}

/**
 * Renders a block of code with optional syntax highlighting and line numbers.
 */
export interface CodeBlock extends BaseComponent {
    component: 'code-block';
    /** The programming language of the code block for syntax highlighting (e.g., 'javascript', 'python'). */
    language?: string;
    /** The code content as a string. */
    value: string;
    /** If `true`, line numbers will be displayed alongside the code. */
    'line-numbers'?: boolean;
}

/**
 * Renders an image.
 */
export interface Image extends BaseComponent {
    component: 'image';
    /** The URL of the image source. */
    src: string;
    /** Alternate text for the image, important for accessibility. */
    alt?: string;
    /** Optional caption to display below the image. */
    caption?: string;
    /** Object-fit property for the image ('cover', 'contain', 'fill', 'none', 'scale-down'). */
    fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    /** Optional explicit width for the image (e.g., '100 px', '50%'). */
    width?: string | number;
    /** Optional explicit height for the image (e.g., '100 px', 'auto'). */
    height?: string | number;
}

/**
 * Renders a video player.
 */
export interface Video extends BaseComponent {
    component: 'video';
    /** The URL of the video source. */
    src: string;
    /** Optional URL of an image to display before the video starts. */
    poster?: string;
    /** If `true`, the video will start playing automatically. */
    autoplay?: boolean;
    /** If `true`, the video will loop continuously. */
    loop?: boolean;
    /** If `true`, native video controls (play, pause, volume) will be displayed. */
    controls?: boolean;
    /** If `true`, the video's audio will be muted by default. */
    muted?: boolean;
    /** Optional explicit width for the video player (e.g., '100 px', '50%'). */
    width?: string | number;
    /** Optional explicit height for the video player (e.g., '100 px', 'auto'). */
    height?: string | number;
}

/**
 * Renders an icon, typically from an icon library.
 */
export interface Icon extends BaseComponent {
    component: 'icon';
    /** The name of the icon to display (e.g., 'home', 'settings'). */
    name: string;
    /**
     * Optional variant or style of the icon (e.g., 'outlined', 'filled', 'rounded', 'sharp').
     * Depends on the icon library in use.
     */
    variant?: 'outlined' | 'filled' | 'rounded' | 'sharp';
    /** The size of the icon (e.g., '24 px', '2rem', 'small', 'medium', 'large'). */
    size?: string | number;
}

/**
 * Renders a clickable button, often triggering an action.
 */
export interface Button extends BaseComponent {
    component: 'button';
    /** The text label displayed on the button. */
    label: string;
    /**
     * Optional action identifier or payload to be dispatched when the button is clicked.
     * This can be a string event name or a structured object.
     */
    action?: string | object;
    /** Optional icon to display within the button. */
    icon?: Icon & {
        /** Position of the icon relative to the label. */
        position?: 'left' | 'right';
    };
    /** Optional variant for button styling (e.g., 'primary', 'secondary', 'outlined', 'text'). */
    variant?: 'primary' | 'secondary' | 'outlined' | 'text';
    /** If `true`, the button is disabled and cannot be clicked. */
    disabled?: boolean;
}

/**
 * Renders a hyperlink.
 */
export interface Link extends BaseComponent {
    component: 'link';
    /** The URL the link points to. */
    href: string;
    /** The target attribute for the link ('_blank', '_self', '_parent', '_top'). */
    target?: '_blank' | '_self' | '_parent' | '_top';
    /** The content of the link, which can be text or other child components. */
    children: Children | string;
}

/**
 * Renders a small, descriptive badge or tag.
 */
export interface Badge extends BaseComponent {
    component: 'badge';
    /** The text content of the badge. */
    text: string;
    /**
     * Optional semantic variant for styling the badge ('info', 'success', 'warning', 'error', 'neutral').
     */
    variant?: 'info' | 'success' | 'warning' | 'error' | 'neutral';
    /** Optional icon to display within the badge. */
    icon?: Icon & {
        /** Position of the icon relative to the text. */
        position?: 'left' | 'right';
        /** Size of the icon within the badge. */
        size?: string;
    };
}

/**
 * Renders a progress indicator (linear or circular).
 */
export interface Progress extends BaseComponent {
    component: 'progress';
    /** The current value of the progress (0-100). Omit for indeterminate progress. */
    value?: number;
    /** The visual variant of the progress indicator ('linear' or 'circular'). */
    variant?: 'linear' | 'circular';
    /** Optional label to display alongside the progress indicator. */
    label?: string;
    /** If `true`, the progress indicator is indeterminate (continuous animation without a specific value). */
    indeterminate?: boolean;
}

/**
 * Renders a loading animation or message.
 */
export interface Loading extends BaseComponent {
    component: 'loading';
    /** Optional message to display along with the loading animation. */
    message?: string;
    /** The visual variant of the loading indicator ('spinner', 'skeleton', 'dots', 'bar'). */
    variant?: 'spinner' | 'skeleton' | 'dots' | 'bar';
}

/**
 * A flexible container component, typically used for layout (e.g., flexbox container).
 */
export interface Box extends BaseComponent {
    component: 'box';
    /** The flex direction of the box ('row' or 'column'). */
    direction?: 'row' | 'column';
    /** Gap between child items (e.g., '1rem', '16px'). */
    gap?: string;
    /** Alignment of items along the cross-axis ('start', 'center', 'end', 'stretch'). */
    align?: 'start' | 'center' | 'end' | 'stretch';
    /** Justification of items along the main-axis ('start', 'center', 'end', 'space-between', 'space-around'). */
    justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
    /** If `true`, items will wrap to the next line/row if they exceed container space. */
    wrap?: boolean;
    /** The child components contained within the box. */
    children?: Children;
}

/**
 * Renders a visual divider line, optionally with a label.
 */
export interface Divider extends BaseComponent {
    component: 'divider';
    /** The orientation of the divider. */
    orientation?: 'horizontal' | 'vertical';
    /** Optional label to display within or alongside the divider. */
    label?: string;
}

/**
 * Renders a tabbed interface.
 */
export interface Tabs extends BaseComponent {
    component: 'tabs';
    /** An array of tab definitions, each with an ID, label, and content. */
    tabs: {
        /** Unique ID for the tab. */
        id: string;
        /** Label displayed on the tab header. */
        label: string;
        /** The content (array of components) displayed when this tab is active. */
        content: Component[];
    }[];
    /** The ID of the tab that should be active by default. */
    activeTab?: string;
}

/**
 * Renders a content block that can be expanded or collapsed.
 */
export interface CollapseBlock extends BaseComponent {
    component: 'collapse-block';
    /** The title displayed on the header of the collapsible block. */
    title: string;
    /** If `true`, the content block is collapsed by default. */
    collapsed?: boolean;
    /** The content (array of components) hidden/shown by the collapse block. */
    content: Component[];
}

/**
 * Represents a reference or citation, often appearing as a clickable link.
 */
export interface Reference extends BaseComponent {
    component: 'reference';
    /** The text label for the reference. */
    label: string;
    /** The target URL or identifier that the reference points to. */
    target: string;
    /** Optional descriptive text for the reference. */
    description?: string;
}

/**
 * Renders an error message, optionally with original error details.
 */
export interface Error extends BaseComponent {
    component: "error";
    /** The main error message to display. */
    message: string;
    /** Optional original error object or data, useful for debugging. */
    original?: unknown;
    /** Optional title for the error message display. */
    title?: string;
    /** Optional variant for error styling (e.g., 'inline', 'banner', 'card'). */
    variant?: 'inline' | 'banner' | 'card';
}

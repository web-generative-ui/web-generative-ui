import type {Component, Timeline} from "../schema.d.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiTimeline` is a custom UI component that displays a series of events along a chronological timeline.
 * It supports both vertical and horizontal orientations, and each item can include a title,
 * time, description, icon, and media.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Timeline` object.
 *
 * @element ui-timeline
 * @slot (default) Renders `icon` or `media` components within each timeline item.
 */
export class UiTimeline extends BaseUiComponent {

    /**
     * The parsed data for the timeline component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private timelineData: Timeline | null = null;

    /**
     * Constructs an instance of `UiTimeline`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({mode: "open"});
    }

    /**
     * Parses the JSON string from the `data` attribute into a `Timeline` object.
     * Includes validation to ensure the `component` type is 'timeline' and `items` is an array.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "timeline" || !Array.isArray(parsed.items)) {
                throw new Error("Invalid timeline component data: 'component' must be 'timeline' and 'items' must be an array.");
            }
            this.timelineData = parsed as Timeline;
        } catch (e: unknown) {
            console.error("UiTimeline: Failed to parse data attribute:", e);
            this.timelineData = null;
        }
    }

    /**
     * Indicates whether the `timelineData` has been successfully parsed.
     * @protected
     * @returns `true` if `timelineData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.timelineData !== null;
    }

    /**
     * Renders the HTML content of the timeline component into its Shadow DOM.
     * It dynamically generates the timeline structure and delegates rendering of
     * nested icons and media to the `Interpreter`.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.timelineData) {
            this.shadow.innerHTML = `<div style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Timeline data missing or invalid.</div>`;
            return;
        }

        const {orientation = "vertical", items = []} = this.timelineData;
        const isHorizontal = orientation === "horizontal";

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    box-sizing: border-box;
                    width: 100%;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 1em 0; /* Add some vertical padding */
                    ${this.timelineData.style ? formatInlineStyle(this.timelineData.style) : ''}
                    ${this.timelineData.layout ? formatLayoutMetaAsHostStyle(this.timelineData.layout) : ''}
                    /* Base transitions for enter/exit */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                .timeline {
                    display: flex;
                    flex-direction: ${isHorizontal ? "row" : "column"};
                    gap: ${isHorizontal ? "2em" : "1.5em"}; /* Adjust gap based on orientation */
                    position: relative;
                    padding: ${isHorizontal ? "0 1em" : "0 0.5em"}; /* Padding for container */
                }
                .timeline::before { /* The connecting line */
                    content: '';
                    position: absolute;
                    background-color: #e0e0e0;
                    ${isHorizontal ? `
                        top: 50%;
                        left: 0;
                        right: 0;
                        height: 2px;
                        transform: translateY(-50%);
                    ` : `
                        left: 10px; /* Aligned with marker */
                        top: 0;
                        bottom: 0;
                        width: 2px;
                    `}
                    z-index: 0; /* Behind markers */
                }
                .timeline-item {
                    position: relative;
                    display: flex;
                    flex-direction: ${isHorizontal ? "column" : "row"};
                    align-items: ${isHorizontal ? "center" : "flex-start"};
                    flex-shrink: 0; /* Prevent items from shrinking in horizontal timeline */
                    min-width: ${isHorizontal ? "150px" : "auto"}; /* Minimum width for horizontal items */
                    z-index: 1; /* Above the connecting line */
                }
                .marker-wrapper {
                    position: relative;
                    ${isHorizontal ? `
                        margin-bottom: 0.75em;
                        margin-right: 0; /* No right margin for horizontal marker */
                    ` : `
                        margin-right: 1.5em; /* Space for vertical marker and line */
                    `}
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .marker {
                    width: 16px; /* Slightly larger marker */
                    height: 16px;
                    border-radius: 50%;
                    border: 3px solid #fff; /* White border for contrast */
                    box-shadow: 0 0 0 1px #e0e0e0; /* Outer subtle ring */
                    flex-shrink: 0;
                }
                .marker.completed { background-color: #4caf50; } /* Green */
                .marker.active { background-color: #007bff; } /* Blue */
                .marker.upcoming { background-color: #ff9800; } /* Orange */
                .marker.default { background-color: #9e9e9e; } /* Gray */

                .item-content-wrapper {
                    flex: 1;
                    padding: 0.5em 0; /* Padding for content */
                    min-width: 0; /* Allow content to shrink in flex layout */
                }
                .item-title {
                    font-weight: 600; /* Bolder title */
                    font-size: 1.1em;
                    color: #333;
                }
                .item-time {
                    font-size: 0.8em; /* Smaller time font */
                    color: #777;
                    margin-bottom: 0.25em; /* Space below time */
                }
                .item-description {
                    margin-top: 0.5em;
                    font-size: 0.9em;
                    color: #555;
                    line-height: 1.4;
                }
                .item-media {
                    margin-top: 0.75em; /* Space above media */
                    display: flex;
                    flex-direction: column;
                    gap: 0.5em;
                }
            </style>
            <div class="timeline">
                ${items.map((item, idx: number) => `
                    <div class="timeline-item" data-idx="${idx}" data-key="${item.key ?? `idx-${idx}`}">
                        <div class="marker-wrapper">
                            <div class="marker ${item.status ?? "default"}"></div>
                        </div>
                        <div class="item-content-wrapper">
                            ${item.time ? `<div class="item-time">${this._formatTimestamp(item.time)}</div>` : ""}
                            <div class="item-title">${item.title}</div>
                            ${item.description ? `<div class="item-description">${item.description}</div>` : ""}
                            <div class="item-media"></div>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;

        // Render optional icon/media into item-media containers
        const itemMediaContainers = this.shadow.querySelectorAll(".item-media");
        items.forEach((item, idx: number) => {
            const mediaEl = itemMediaContainers[idx] as HTMLElement;
            if (mediaEl) {
                const mediaToRender: (Component | undefined)[] = [];
                if (item.icon) mediaToRender.push(item.icon);
                if (item.media) mediaToRender.push(item.media);

                const validMediaToRender = mediaToRender.filter(Boolean) as Component[];

                if (validMediaToRender.length > 0) {
                    // Render into a wrapper to apply layout meta to media itself
                    const wrapper = document.createElement("div");
                    wrapper.classList.add("child-media-wrapper");
                    // Apply layoutMeta if the item.icon/media component itself has it
                    // NOTE: item.icon and item.media are themselves components, their layout will be applied by the interpreter
                    // no need to apply layout meta on this wrapper unless a specific parent layout is needed here.

                    mediaEl.appendChild(wrapper);
                    this.registry.getInterpreter().render(wrapper, validMediaToRender);
                }
            }
        });
    }

    /**
     * Formats a given timestamp string into a localized date/time string.
     * @private
     * @param timestampString The timestamp string (e.g., ISO date string).
     * @returns A localized date/time string, or an empty string if invalid.
     */
    private _formatTimestamp(timestampString: string): string {
        try {
            const date = new Date(timestampString);
            if (isNaN(date.getTime())) return ''; // Check for an invalid date
            return date.toLocaleString(); // Use browser's locale
        } catch (e: unknown) {
            console.warn("UiTimeline: Failed to format timestamp:", timestampString, e);
            return timestampString; // Fallback to raw string on error
        }
    }
}

import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Video} from "playwright";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiVideo` is a custom UI component that embeds and plays video content.
 * It supports standard HTML5 video attributes like `src`, `poster`, `autoplay`, `loop`, `controls`, and `muted`,
 * as well as explicit `width` and `height`.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Video` object.
 *
 * @element ui-video
 * @slot N/A
 */
export class UiVideo extends BaseUiComponent {

    /**
     * The parsed data for the video component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private videoData: any = null;

    /**
     * Constructs an instance of `UiVideo`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Parses the JSON string from the `data` attribute into a `Video` object.
     * Includes validation to ensure the `component` type is 'video' and `src` is present.
     * This method is solely responsible for data parsing, not rendering.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "video" || !parsed.src) {
                throw new Error("Invalid video component data: 'component' must be 'video' and 'src' is required.");
            }
            this.videoData = parsed as Video;
        } catch (e: unknown) {
            console.error("UiVideo: Failed to parse data attribute:", e);
            this.videoData = null;
        }
    }

    /**
     * Indicates whether the `videoData` has been successfully parsed.
     * @protected
     * @returns `true` if `videoData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.videoData !== null;
    }

    /**
     * Renders the HTML content of the video component into its Shadow DOM.
     * It embeds an HTML5 video player with attributes configured from `videoData`,
     * including `src`, `poster`, `autoplay`, `loop`, `controls`, `muted`, `width`, and `height`.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.videoData) {
            this.shadow.innerHTML = `<div style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Video data missing or invalid.</div>`;
            return;
        }

        const {
            src,
            poster,
            autoplay = false,
            loop = false,
            controls = true, // Default to true for better UX
            muted = false,
            width,
            height
        } = this.videoData;

        // Ensure width/height are CSS-compatible strings
        const cssWidth = typeof width === 'number' ? `${width}px` : width || '100%'; // Default to 100% width
        const cssHeight = typeof height === 'number' ? `${height}px` : height || 'auto';

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block; /* Typically block-level for video */
                    box-sizing: border-box;
                    width: ${cssWidth};
                    height: ${cssHeight};
                    ${this.videoData.style ? formatInlineStyle(this.videoData.style) : ''}
                    ${this.videoData.layout ? formatLayoutMetaAsHostStyle(this.videoData.layout) : ''}
                    /* Base transitions for enter/exit */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                /* Transition classes for host element (if any defined in BaseUiComponent.transitionConfig) */
                /* For video, often simple fade or slide in/out */
                video {
                    width: 100%;
                    height: 100%; /* Fill the host's defined height */
                    max-width: 100%;
                    max-height: 100%;
                    border-radius: 8px; /* Slightly rounded corners */
                    display: block; /* Remove extra space below video */
                    background-color: #000; /* Black background for player */
                }
            </style>
            <video
                src="${src}"
                ${poster ? `poster="${poster}"` : ""}
                ${autoplay ? "autoplay" : ""}
                ${loop ? "loop" : ""}
                ${controls ? "controls" : ""}
                ${muted ? "muted" : ""}
                playsinline
            >
                Your browser does not support the video tag.
            </video>
        `;

        const videoEl = this.shadow.querySelector('video');
        if (videoEl) {
            videoEl.addEventListener('error', () => {
                console.warn(`UiVideo: Failed to load video from src: ${src}`);
                // Optionally display a custom error message within the component.
            });
        }
    }
}

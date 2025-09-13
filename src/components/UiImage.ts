import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Image, TransitionConfig} from "../schema.d.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiImage` is a custom UI component that renders an image.
 * It supports alt text, captions, object-fit behavior, and explicit dimensions.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into an `Image` object.
 *
 * @element ui-image
 * @slot N/A
 */
export class UiImage extends BaseUiComponent {

    /**
     * The parsed data for the image component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private imageData: Image | null = null;

    /**
     * Constructs an instance of `UiImage`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }


    /**
     * Overrides the default `transitionConfig` from `BaseUiComponent` to define
     * specific CSS classes for image enter/exit animations.
     * @public
     */
    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'image-fade-enter',
        enterActive: 'image-fade-enter-active',
        exit: 'image-fade-exit',
        exitActive: 'image-fade-exit-active'
    };

    /**
     * Parses the JSON string from the `data` attribute into an `Image` object.
     * Includes validation to ensure the `component` type is 'image' and `src` is present.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "image" || !parsed.src) {
                throw new Error("Invalid image component data: 'component' must be 'image' and 'src' is required.");
            }
            this.imageData = parsed as Image;
        } catch (e: unknown) {
            console.error("UiImage: Failed to parse data attribute:", e);
            this.imageData = null;
        }
    }

    /**
     * Indicates whether the `imageData` has been successfully parsed.
     * @protected
     * @returns `true` if `imageData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.imageData !== null;
    }

    /**
     * Renders the HTML content of the image component into its Shadow DOM.
     * It displays the image, optional caption, and applies sizing and object-fit styles.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.imageData) {
            this.shadow.innerHTML = `<div style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Image data missing or invalid.</div>`;
            return;
        }

        const { src, alt = "Image content", caption, fit = "contain", width, height } = this.imageData;

        // Ensure width/height are CSS-compatible strings
        const cssWidth = typeof width === 'number' ? `${width}px` : width || 'auto';
        const cssHeight = typeof height === 'number' ? `${height}px` : height || 'auto';

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: inline-block; /* Default to inline-block for flow, can be block via layout/style */
                    box-sizing: border-box;
                    width: ${cssWidth};
                    height: ${cssHeight};
                    ${this.imageData.style ? formatInlineStyle(this.imageData.style) : ''}
                    ${this.imageData.layout ? formatLayoutMetaAsHostStyle(this.imageData.layout) : ''}
                    /* Base transitions for enter/exit */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                /* Transition classes for host element (defined in transition.css usually) */
                :host(.image-fade-enter) { opacity: 0; }
                :host(.image-fade-enter-active) { opacity: 1; }
                :host(.image-fade-exit) { opacity: 1; }
                :host(.image-fade-exit-active) { opacity: 0; }

                figure {
                    margin: 0; /* Remove default browser margins */
                    display: inline-flex; /* Use flex for figure to center/align contents */
                    flex-direction: column;
                    align-items: center;
                    width: 100%; /* Ensure figure takes full width of host */
                    height: 100%; /* Ensure figure takes full height of host */
                    justify-content: center; /* Center image vertically */
                }
                img {
                    max-width: 100%;
                    max-height: 100%;
                    width: ${width ? '100%' : 'auto'}; /* If width is set on host, img should fill it */
                    height: ${height ? '100%' : 'auto'}; /* If height is set on host, img should fill it */
                    object-fit: ${fit};
                    border-radius: 4px;
                    display: block; /* Remove extra space below image */
                    /* Optional: Add a subtle transition for image loading if desired */
                    transition: opacity 0.3s ease-in-out;
                }
                figcaption {
                    margin-top: 8px; /* Slightly more margin */
                    font-size: 0.85em; /* Slightly smaller relative to image */
                    color: #555; /* Softer color */
                    text-align: center;
                    max-width: 100%; /* Prevent caption overflow */
                    overflow-wrap: break-word; /* Break long words */
                }
            </style>
            <figure>
                <img src="${src}" alt="${alt}" loading="lazy" />
                ${caption ? `<figcaption>${caption}</figcaption>` : ""}
            </figure>
        `;

        const imgEl = this.shadow.querySelector('img');
        if (imgEl) {
            imgEl.addEventListener('error', () => {
                console.warn(`UiImage: Failed to load image from src: ${src}`);
            });
        }
    }
}

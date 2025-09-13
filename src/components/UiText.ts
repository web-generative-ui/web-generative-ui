import type {Text, TransitionConfig} from '../schema.d.ts';
import { BaseUiComponent } from './BaseUiComponent';
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiText` is a custom UI component that renders text content with various semantic
 * and stylistic variants (e.g., headings, body text, captions, highlights).
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Text` object.
 *
 * @element ui-text
 * @slot N/A
 */
export class UiText extends BaseUiComponent {

    /**
     * The parsed data for the text component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private textData: Text | null = null;

    /**
     * Constructs an instance of `UiText`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Overrides the default `transitionConfig` from `BaseUiComponent` to define
     * specific CSS classes for text component enter/exit animations.
     * @public
     */
    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'text-enter',
        enterActive: 'text-enter-active',
        exit: 'text-exit',
        exitActive: 'text-exit-active'
    };

    /**
     * Parses the JSON string from the `data` attribute into a `Text` object.
     * Includes validation to ensure the `component` type is 'text' and `text` content is present.
     * This method is solely responsible for data parsing, not rendering.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "text" || parsed.text === undefined) {
                throw new Error("Invalid text component data: 'component' must be 'text' and 'text' is required.");
            }
            this.textData = parsed as Text;
        } catch (e: unknown) {
            console.error("UiText: Failed to parse data attribute:", e);
            this.textData = null;
        }
    }

    /**
     * Indicates whether the `textData` has been successfully parsed.
     * @protected
     * @returns `true` if `textData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean { return this.textData !== null; }

    /**
     * Renders the HTML content of the text component into its Shadow DOM.
     * It selects the appropriate semantic HTML tag or applies CSS classes based on the `variant` property,
     * and displays the `text` content.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.textData) {
            this.shadow.innerHTML = `<span style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Text data missing or invalid.</span>`;
            return;
        }

        const textContent = this.textData.text || ''; // text is required by schema, but fallback for safety
        const variant = this.textData.variant || 'body';

        let tagName: string;
        let className: string = variant;

        // Choose semantic tag based on variant
        switch (variant) {
            case 'h1': tagName = 'h1'; break;
            case 'h2': tagName = 'h2'; break;
            case 'h3': tagName = 'h3'; break;
            case 'h4': tagName = 'h4'; break;
            case 'h5': tagName = 'h5'; break;
            case 'h6': tagName = 'h6'; break;
            case 'subtitle': tagName = 'p'; className = 'subtitle'; break;
            case 'caption': tagName = 'span'; className = 'caption'; break;
            case 'overline': tagName = 'span'; className = 'overline'; break;
            case 'body': tagName = 'p'; className = 'body'; break;
            // Highlight variants are typically spans with specific background/text colors
            case 'highlight-info':
            case 'highlight-warning':
            case 'highlight-error':
            case 'highlight-success':
            case 'highlight-accent':
                tagName = 'span';
                break;
            default:
                tagName = 'p';
                className = 'body'; // Default to paragraph body if variant is unknown
                console.warn(`UiText: Unknown text variant '${variant}'. Defaulting to 'body'.`);
                break;
        }

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block; /* Default to block, can be overridden by layout/style */
                    box-sizing: border-box;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.5; /* Default line height for readability */
                    margin: 0.5em 0; /* Default vertical margin for blocks of text */
                    ${this.textData.style ? formatInlineStyle(this.textData.style) : ''}
                    ${this.textData.layout ? formatLayoutMetaAsHostStyle(this.textData.layout) : ''}
                    /* Base transitions for enter/exit */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                /* Transition classes for host element (defined in transition.css usually) */
                :host(.text-enter) { opacity: 0; transform: translateY(5px); }
                :host(.text-enter-active) { opacity: 1; transform: translateY(0); }
                :host(.text-exit) { opacity: 1; }
                :host(.text-exit-active) { opacity: 0; transform: translateY(5px); }

                /* Headings */
                h1, .h1 { font-size: 2.25em; margin: 0.67em 0; font-weight: 700; color: #222; }
                h2, .h2 { font-size: 1.75em; margin: 0.83em 0; font-weight: 600; color: #333; }
                h3, .h3 { font-size: 1.35em; margin: 1em 0; font-weight: 600; color: #444; }
                h4, .h4 { font-size: 1.15em; margin: 1.33em 0; font-weight: 500; color: #555; }
                h5, .h5 { font-size: 1em; margin: 1.67em 0; font-weight: 500; color: #666; }
                h6, .h6 { font-size: 0.85em; margin: 2.33em 0; font-weight: 500; color: #777; }

                /* Other semantic variants */
                p, .body { font-size: 1em; line-height: 1.6; color: #333; }
                .subtitle { font-size: 1.1em; font-weight: 400; color: #666; margin-bottom: 0.5em; display: block; }
                .caption { font-size: 0.85em; color: #777; line-height: 1.4; display: block; }
                .overline { font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.05em; color: #999; display: block; }

                /* Highlight variants */
                .highlight-info { background-color: #e0f2fe; color: #0369a1; padding: 0.2em 0.5em; border-radius: 4px; display: inline-block; }
                .highlight-warning { background-color: #fff3e0; color: #a16207; padding: 0.2em 0.5em; border-radius: 4px; display: inline-block; }
                .highlight-error { background-color: #ffebee; color: #b91c1c; padding: 0.2em 0.5em; border-radius: 4px; display: inline-block; }
                .highlight-success { background-color: #e8f5e9; color: #15803d; padding: 0.2em 0.5em; border-radius: 4px; display: inline-block; }
                .highlight-accent { background-color: #e3f2fd; color: #1976d2; padding: 0.2em 0.5em; border-radius: 4px; display: inline-block; }
            </style>
            <${tagName} class="${className}">${textContent}</${tagName}>
        `;
    }
}

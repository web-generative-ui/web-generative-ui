import {BaseUiComponent} from "./BaseUiComponent.ts";
import type {Error} from "../schema.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiError` is a custom UI component designed to display error messages within the interface.
 * It can render a primary message, an optional title, and details about the original error data.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into an `Error` object.
 *
 * @element ui-error
 * @slot N/A
 */
export class UiError extends BaseUiComponent {

    /**
     * The parsed data for the error component, derived from the `data` attribute.
     * It is `null` if no data has been parsed, but `parseData` provides a fallback `Error` object on failure.
     * @private
     */
    private errorData: Error | null = null;

    /**
     * Constructs an instance of `UiError`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Parses the JSON string from the `data` attribute into an `Error` object.
     * If parsing fails or essential data is missing, it sets a default "Unknown error" message.
     * This method is solely responsible for data parsing, not rendering.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "error" || !parsed.message) {
                throw new Error("Invalid error component data: 'component' must be 'error' and 'message' is required.");
            }
            this.errorData = parsed as Error;
        } catch (e: unknown) {
            console.error("UiError: Failed to parse data attribute or missing required fields. Providing fallback error.", e);
            this.errorData = {
                component: "error",
                message: (e instanceof Error) ? e.message : "Failed to load error details. Check console for original error.",
                title: "Component Error",
                original: e,
                variant: "card",
            };
        }
    }

    /**
     * Indicates whether the `errorData` has been successfully parsed or a fallback has been set.
     * @protected
     * @returns `true` if `errorData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.errorData !== null;
    }

    /**
     * Renders the HTML content of the error component into its Shadow DOM.
     * It dynamically displays the error message, optional title, and original error details,
     * applying styling based on the `variant` property.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.errorData) {
            this.shadow.innerHTML = `<div style="color:red; font-family: sans-serif; padding: 1em;">Critical: Failed to render UiError component itself.</div>`;
            return;
        }

        const { message, original, title = "Error", variant = "card" } = this.errorData;

        let variantClass: string;
        switch (variant) {
            case 'inline': variantClass = 'error-inline'; break;
            case 'banner': variantClass = 'error-banner'; break;
            case 'card': default: variantClass = 'error-card'; break;
        }

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    box-sizing: border-box; /* Include padding/border in dimensions */
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    ${this.errorData.style ? formatInlineStyle(this.errorData.style) : ''}
                    ${this.errorData.layout ? formatLayoutMetaAsHostStyle(this.errorData.layout) : ''}
                    /* Base transitions for enter/exit (if any defined in BaseUiComponent.transitionConfig) */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                .error-container {
                    padding: 1em;
                    border-radius: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75em;
                }
                .error-title {
                    font-weight: bold;
                    font-size: 1.1em;
                    display: flex;
                    align-items: center;
                    gap: 0.5em;
                }
                .error-message {
                    font-size: 0.95em;
                    line-height: 1.4;
                    white-space: pre-wrap; /* Preserve whitespace and line breaks */
                }
                .error-original {
                    font-size: 0.8em;
                    color: #777;
                    background: #f9f9f9;
                    border: 1px solid #eee;
                    padding: 0.5em;
                    border-radius: 3px;
                    overflow-x: auto; /* Allow horizontal scrolling for long data */
                }
                .error-icon {
                    color: #b00020; /* Icon color matches primary error color */
                }

                /* Variant-specific styles */
                .error-card {
                    background: #fff0f0;
                    color: #b00020;
                    border: 1px solid #e0b4b4;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    margin: 0.5em 0;
                }
                .error-banner {
                    background: #ffecb3; /* Light yellow */
                    color: #e65100; /* Dark orange */
                    border: 1px solid #ffcc80;
                    padding: 1em 1.5em;
                    margin: 0;
                    border-radius: 0;
                    font-size: 1em;
                }
                .error-inline {
                    background: transparent;
                    color: #d32f2f; /* Red */
                    border: none;
                    padding: 0;
                    margin: 0;
                    font-size: 0.9em;
                }
                .error-inline .error-title { font-size: 1em; margin-bottom: 0; gap: 0.25em;}
                .error-inline .error-message { display: inline; }
                .error-inline .error-original { display: none; }

            </style>
            <div class="error-container ${variantClass}">
                <div class="error-title">
                    <span class="error-icon">⚠️</span>
                    <span>${title}</span>
                </div>
                <div class="error-message">${message}</div>
                ${
            original
                ? `<pre class="error-original">Original Data: ${JSON.stringify(original, null, 2)}</pre>`
                : ""
        }
            </div>
        `;
    }
}

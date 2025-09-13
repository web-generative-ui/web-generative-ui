import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Reference} from "../schema.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiReference` is a custom UI component that renders a clickable reference or citation.
 * It typically appears as a link with a descriptive label and an optional longer description.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Reference` object.
 *
 * @element ui-reference
 * @slot N/A
 */
export class UiReference extends BaseUiComponent {

    /**
     * The parsed data for the reference component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private refData: Reference | null = null;

    /**
     * Constructs an instance of `UiReference`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Parses the JSON string from the `data` attribute into a `Reference` object.
     * Includes validation to ensure the `component` type is 'reference' and required fields (`label`, `target`) are present.
     * This method is solely responsible for data parsing, not rendering.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "reference" || !parsed.label || !parsed.target) {
                throw new Error("Invalid reference component data: 'component' must be 'reference', and 'label' and 'target' are required.");
            }
            this.refData = parsed as Reference;
        } catch (e: unknown) {
            console.error("UiReference: Failed to parse data attribute:", e);
            this.refData = null;
        }
    }

    /**
     * Indicates whether the `refData` has been successfully parsed.
     * @protected
     * @returns `true` if `refData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.refData !== null;
    }

    /**
     * Renders the HTML content of the reference component into its Shadow DOM.
     * It displays a clickable link with a label and an optional description.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.refData) {
            this.shadow.innerHTML = `<div style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Reference data missing or invalid.</div>`;
            return;
        }

        const { label, target, description } = this.refData;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block; /* Typically block-level */
                    box-sizing: border-box;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0.5em 0;
                    ${this.refData.style ? formatInlineStyle(this.refData.style) : ''}
                    ${this.refData.layout ? formatLayoutMetaAsHostStyle(this.refData.layout) : ''}
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                a {
                    color: #007bff; /* Standard link blue */
                    text-decoration: none;
                    font-weight: 500; /* Slightly bolder */
                    transition: color 0.2s ease, text-decoration 0.2s ease;
                }
                a:hover {
                    text-decoration: underline;
                    color: #0056b3;
                }
                a:active {
                    color: #004085;
                }
                .description {
                    display: block;
                    font-size: 0.875em;
                    color: #666;
                    margin-top: 0.25em;
                    line-height: 1.4;
                }
            </style>
            <a href="${target}" target="_blank" rel="noopener noreferrer">${label}</a>
            ${description ? `<span class="description">${description}</span>` : ""}
        `;
    }
}

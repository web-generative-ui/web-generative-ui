import type {Spacer} from "../schema.d.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiSpacer` is a custom UI component that provides configurable empty space
 * in either a horizontal or vertical direction. It's useful for controlling
 * layout and visual separation between other components.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Spacer` object.
 *
 * @element ui-spacer
 * @slot N/A
 */
export class UiSpacer extends BaseUiComponent {

    /**
     * The parsed data for the spacer component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private spacerData: Spacer | null = null;

    /**
     * Constructs an instance of `UiSpacer`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Parses the JSON string from the `data` attribute into a `Spacer` object.
     * Includes validation to ensure the `component` type is 'spacer'.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "spacer") {
                throw new Error("Invalid spacer component data: 'component' must be 'spacer'.");
            }
            this.spacerData = parsed as Spacer;
        } catch (e: unknown) {
            console.error("UiSpacer: Failed to parse data attribute:", e);
            this.spacerData = null;
        }
    }

    /**
     * Indicates whether the `spacerData` has been successfully parsed.
     * @protected
     * @returns `true` if `spacerData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.spacerData !== null;
    }

    /**
     * Renders the HTML content of the spacer component into its Shadow DOM.
     * It sets its dimensions (`width` or `height`) based on the `size` and `direction` properties.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.spacerData) {
            this.shadow.innerHTML = `<div style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Spacer data missing or invalid.</div>`;
            return;
        }

        const { size = "1rem", direction = "vertical" } = this.spacerData;
        const isHorizontal = direction === "horizontal";

        const cssSize = size;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: ${isHorizontal ? 'inline-block' : 'block'};
                    box-sizing: border-box;
                    ${isHorizontal
            ? `width: ${cssSize}; height: auto; min-height: 1px;`
            : `width: auto; height: ${cssSize}; min-width: 1px;`}
                    ${this.spacerData.style ? formatInlineStyle(this.spacerData.style) : ''}
                    ${this.spacerData.layout ? formatLayoutMetaAsHostStyle(this.spacerData.layout) : ''}
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                .spacer-fill {
                    width: 100%;
                    height: 100%;
                }
            </style>
            <div class="spacer-fill"></div>
        `;
    }
}

import type {Divider} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiDivider` is a custom UI component that renders a visual separator line,
 * which can be either horizontal or vertical. It optionally supports displaying a text label.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Divider` object.
 *
 * @element ui-divider
 * @slot N/A
 */
export class UiDivider extends BaseUiComponent {

    /**
     * The parsed data for the divider component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private dividerData: Divider | null = null;

    /**
     * Constructs an instance of `UiDivider`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Parses the JSON string from the `data` attribute into a `Divider` object.
     * If parsing fails, an error is logged, and `dividerData` is set to `null`.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string) {
        try {
            this.dividerData = JSON.parse(dataString) as Divider;
        } catch (e) {
            console.error("UiDivider: Failed to parse data attribute:", e);
            this.dividerData = null;
        }
    }

    /**
     * Indicates whether the `dividerData` has been successfully parsed.
     * @protected
     * @returns `true` if `dividerData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.dividerData !== null;
    }

    /**
     * Renders the HTML content of the divider into the component's Shadow DOM.
     * It dynamically adjusts styling based on `orientation` and optionally includes a `label`.
     * @protected
     */
    protected renderContent(): void {
        if (!this.dividerData) {
            this.shadow.innerHTML = '';
            return;
        }

        const { orientation = "horizontal", label } = this.dividerData;
        const isVertical = orientation === "vertical";

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: ${isVertical ? 'inline-flex' : 'block'};
                    width: ${isVertical ? 'auto' : '100%'};
                    height: ${isVertical ? '100%' : 'auto'};
                    box-sizing: border-box;
                    ${this.dividerData.style ? formatInlineStyle(this.dividerData.style) : ''}
                    ${this.dividerData.layout ? formatLayoutMetaAsHostStyle(this.dividerData.layout) : ''}
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                .divider-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    ${isVertical ? `
                        flex-direction: column;
                        height: 100%;
                        width: auto;
                        padding: 0 0.5rem; /* Vertical padding */
                    ` : `
                        flex-direction: row;
                        width: 100%;
                        height: auto;
                        padding: 0.5rem 0; /* Horizontal padding */
                    `}
                }
                .line {
                    flex: 1;
                    border: none;
                    background-color: #dcdcdc;
                    ${isVertical ? "width: 1px; height: 100%; min-height: 1rem;" : "height: 1px; width: 100%; min-width: 1rem;"}
                }
                .label {
                    margin: ${isVertical ? "0.5rem 0" : "0 0.5rem"};
                    font-size: 0.875rem;
                    color: #888;
                    white-space: nowrap;
                    text-align: center;
                }
            </style>
            <div class="divider-container">
                <div class="line"></div>
                ${label ? `<span class="label">${label}</span><div class="line"></div>` : ""}
            </div>
        `;
    }
}

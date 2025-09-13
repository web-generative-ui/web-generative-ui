import type {Link} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiLink` is a custom UI component that renders a hyperlink.
 * It can wrap either plain text or a collection of other UI components as its content.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Link` object.
 *
 * @element ui-link
 * @slot (default) Renders children (text or other components) passed in its `children` property.
 */
export class UiLink extends BaseUiComponent {

    /**
     * The parsed data for the link component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private linkData: Link | null = null;

    /**
     * Constructs an instance of `UiLink`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Parses the JSON string from the `data` attribute into a `Link` object.
     * Includes validation to ensure the `component` type is 'link' and `href` is present.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "link" || !parsed.href) {
                throw new Error("Invalid link component data: 'component' must be 'link' and 'href' is required.");
            }
            this.linkData = parsed as Link;
        } catch (e: unknown) {
            console.error("UiLink: Failed to parse data attribute:", e);
            this.linkData = null;
        }
    }

    /**
     * Indicates whether the `linkData` has been successfully parsed.
     * @protected
     * @returns `true` if `linkData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.linkData !== null;
    }

    /**
     * Renders the HTML content of the link component into its Shadow DOM.
     * It sets up the anchor tag with `href` and `target` attributes
     * and renders its `children` (which can be texted or other components) inside it.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.linkData) {
            this.shadow.innerHTML = `<span style="color: red; font-family: sans-serif; padding: 1em;">⚠️ Link data missing or invalid.</span>`;
            return;
        }

        const { href, target, children = '' } = this.linkData; // Default children to empty string

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: inline-flex; /* Default to inline-flex for proper inline flow and alignment */
                    ${this.linkData.style ? formatInlineStyle(this.linkData.style) : ''}
                    ${this.linkData.layout ? formatLayoutMetaAsHostStyle(this.linkData.layout) : ''}
                    /* Base transitions for enter/exit (if any defined in BaseUiComponent.transitionConfig) */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                a {
                    color: #007bff; /* Standard link blue */
                    text-decoration: none;
                    display: inline-flex; /* Allow children to align horizontally */
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    transition: color 0.2s ease, text-decoration 0.2s ease;
                }
                a:hover {
                    text-decoration: underline;
                    color: #0056b3; /* Darker blue on hover */
                }
                a:active {
                    color: #004085; /* Even darker blue on active */
                }
                .child-wrapper {
                    display: contents; /* Makes child participate in a's flex layout directly */
                }
            </style>
            <a href="${href}" ${target ? `target="${target}"` : ""}></a>
        `;

        const anchor = this.shadow.querySelector("a");
        if (anchor) {
            anchor.textContent = children as string;
        }
    }
}

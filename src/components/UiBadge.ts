import type {Badge, TransitionConfig} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";

/**
 * `UiBadge` is a custom UI component that renders a small, descriptive badge or tag.
 * It supports displaying text, optional icons, and various stylistic variants.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Badge` object.
 *
 * @element ui-badge
 */
export class UiBadge extends BaseUiComponent {

    /**
     * The parsed data for the badge component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private badgeData: Badge | null = null;

    /**
     * Constructs an instance of `UiBadge`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Overrides the default `transitionConfig` from `BaseUiComponent` to define
     * specific CSS classes for badge enter/exit animations.
     * @public
     */
    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'badge-pop-enter',
        enterActive: 'badge-pop-enter-active',
        exit: 'badge-pop-exit',
        exitActive: 'badge-pop-exit-active'
    };

    /**
     * Parses the JSON string from the `data` attribute into a `Badge` object.
     * If parsing fails, an error is logged, and `badgeData` is set to `null`.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            this.badgeData = JSON.parse(dataString) as Badge;
        } catch (e: unknown) {
            console.error("UiBadge: Failed to parse data attribute:", e);
            this.badgeData = null;
        }
    }

    /**
     * Indicates whether the `badgeData` has been successfully parsed.
     * @protected
     * @returns `true` if `badgeData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.badgeData !== null;
    }

    /**
     * Renders the HTML content of the badge into the component's Shadow DOM.
     * It uses the `badgeData` to dynamically generate the text, variant, and icon.
     * @protected
     */
    protected renderContent(): void {
        if (!this.badgeData) return;

        const { text, variant = "neutral", icon } = this.badgeData;
        const iconHtml = icon ? this.renderIcon(icon) : "";

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                }

                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    line-height: 1;
                    white-space: nowrap;
                }

                /* Variants */
                .badge--info    { background-color: #e0f2fe; color: #0369a1; }
                .badge--success { background-color: #dcfce7; color: #15803d; }
                .badge--warning { background-color: #fef9c3; color: #a16207; }
                .badge--error   { background-color: #fee2e2; color: #b91c1c; }
                .badge--neutral { background-color: #f3f4f6; color: #374151; }

                /* Icon */
                .badge__icon {
                    display: inline-flex;
                    margin: 0 0.25em;
                    vertical-align: middle;
                }
                .badge__icon--left  { order: -1; }
                .badge__icon--right { order: 1; }

                .badge__text {
                    display: inline-block;
                }
            </style>
            <span class="badge badge--${variant}">
                ${icon && icon.position === "left" ? iconHtml : ""}
                <span class="badge__text">${text}</span>
                ${icon && icon.position === "right" ? iconHtml : ""}
            </span>
        `;
    }

    /**
     * Renders a `ui-icon` child component based on the provided icon data.
     * This method dynamically creates a `ui-icon` custom element and serializes
     * its properties into a `data` attribute for the child component to consume.
     * @private
     * @param icon The icon data from the `Badge` schema.
     * @returns An HTML string representing the `ui-icon` element.
     */
    private renderIcon(icon: Badge["icon"]): string {
        if (!icon) return "";

        const { name, variant = "filled", size = "1em", position = "left" } = icon;

        return `
            <ui-icon 
                data='${JSON.stringify({ component: "icon", name, variant, size })}'
                class="badge__icon badge__icon--${position}"
                style="font-size:${size};">
            </ui-icon>
        `;
    }
}

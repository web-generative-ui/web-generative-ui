import {BaseUiComponent} from "./BaseUiComponent.ts";
import type {Button, TransitionConfig} from "../schema.d.ts";

/**
 * `UiButton` is a custom UI component that renders a clickable button.
 * It supports displaying a label, an optional icon, and various stylistic variants.
 * When clicked, it dispatches a `button-action` custom event with an associated payload.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Button` object.
 *
 * @element ui-button
 * @slot N/A
 */
export class UiButton extends BaseUiComponent {

    /**
     * The parsed data for the button component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private buttonData: Button | null = null;

    /**
     * Constructs an instance of `UiButton`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({mode: "open"});
    }

    /**
     * Overrides the default `transitionConfig` from `BaseUiComponent` to define
     * specific CSS classes for button enter/exit animations.
     * @public
     */
    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'btn-rise-enter',
        enterActive: 'btn-rise-enter-active',
        exit: 'btn-fade-exit',
        exitActive: 'btn-fade-exit-active'
    };

    /**
     * Parses the JSON string from the `data` attribute into a `Button` object.
     * If parsing fails, an error is logged, and `buttonData` is set to `null`.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string) {
        try {
            this.buttonData = JSON.parse(dataString) as Button;
        } catch (e) {
            console.error("UiButton: Failed to parse data attribute:", e);
            this.buttonData = null;
        }
    }

    /**
     * Indicates whether the `buttonData` has been successfully parsed.
     * @protected
     * @returns `true` if `buttonData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.buttonData !== null;
    }

    /**
     * Renders the HTML content of the button into the component's Shadow DOM.
     * It sets up the button's label, icon, and applies styling based on `variant` and `disabled` states.
     * It also attaches a click listener to dispatch a `button-action` event.
     * @protected
     */
    protected renderContent(): void {
        if (!this.buttonData) return;
        const {label, action, icon, variant = "primary", disabled} = this.buttonData;

        this.shadow.innerHTML = `
        <style>
            :host { display: inline-block; }

            .button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.4em;
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 0.375rem;
                font-size: 0.875rem;
                font-weight: 500;
                line-height: 1.2;
                cursor: pointer;
                transition: background-color 0.2s, box-shadow 0.2s;
            }

            .button--primary   { background: #007bff; color: #fff; }
            .button--secondary { background: #6c757d; color: #fff; }
            .button--success   { background: #28a745; color: #fff; }
            .button--danger    { background: #dc3545; color: #fff; }
            .button--warning   { background: #ffc107; color: #212529; }

            .button:hover:not(:disabled)   { filter: brightness(0.9); }
            .button:active:not(:disabled)  { filter: brightness(0.8); }
            .button:focus-visible { outline: 2px solid #0056b3; outline-offset: 2px; }
            .button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .button__icon {
                display: inline-flex;
                vertical-align: middle;
            }
            .button__icon--left  { order: -1; }
            .button__icon--right { order: 1; }
        </style>
        <button class="button button--${variant}" ${disabled ? "disabled" : ""}>
            ${icon && icon.position === "left" ? this.renderIcon(icon, "left") : ""}
            <span class="button__label">${label}</span>
            ${icon && icon.position === "right" ? this.renderIcon(icon, "right") : ""}
        </button>
    `;

        const buttonEl = this.shadow.querySelector(".button") as HTMLButtonElement;
        if (buttonEl && action && !disabled) {
            buttonEl.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent("button-action", {
                    detail: {action},
                    bubbles: true,
                    composed: true,
                }));
            });
        }
    }

    /**
     * Renders a `ui-icon` child component based on the provided icon data.
     * This method dynamically creates a `ui-icon` custom element and serializes
     * its properties into a `data` attribute for the child component to consume.
     *
     * @private
     * @param icon The icon data (`IconSchema`) from the `Button` schema.
     * @param position
     * @returns An HTML string representing the `ui-icon` element wrapped in a span for positioning.
     */
    private renderIcon(icon: Button["icon"], position: "left" | "right"): string {
        if (!icon || icon.position !== position) return "";
        return `
        <ui-icon data='${JSON.stringify({
            component: "icon",
            name: icon.name,
            variant: icon.variant ?? "filled",
            size: icon.size ?? "1em",
        })}' class="button__icon button__icon--${position}"></ui-icon>
    `;
    }
}

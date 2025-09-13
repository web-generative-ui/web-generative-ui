import type {Progress, TransitionConfig} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiProgress` is a custom UI component that displays a progress indicator.
 * It supports both linear (bar) and circular (spinner-like) variants,
 * and can show either determinate progress (0-100%) or an indeterminate animation.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Progress` object.
 *
 * @element ui-progress
 * @slot N/A
 */
export class UiProgress extends BaseUiComponent {

    /**
     * The parsed data for the progress component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private progressData: Progress | null = null;

    /**
     * Constructs an instance of `UiProgress`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Overrides the default `transitionConfig` from `BaseUiComponent` to define
     * specific CSS classes for progress indicator enter/exit animations.
     * @public
     */
    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'progress-enter',
        enterActive: 'progress-enter-active',
        exit: 'progress-exit',
        exitActive: 'progress-exit-active'
    };

    /**
     * Parses the JSON string from the `data` attribute into a `Progress` object.
     * Includes validation to ensure the `component` type is 'progress'.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "progress") {
                throw new Error("Invalid progress component data: 'component' must be 'progress'.");
            }
            this.progressData = parsed as Progress;
        } catch (e: unknown) {
            console.error("UiProgress: Failed to parse data attribute:", e);
            this.progressData = null;
        }
    }

    /**
     * Indicates whether the `progressData` has been successfully parsed.
     * @protected
     * @returns `true` if `progressData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.progressData !== null;
    }

    /**
     * Renders the HTML content of the progress component into its Shadow DOM.
     * It displays either a linear or circular progress indicator,
     * handling both determinate (value-based) and indeterminate (animated) states.
     * An optional label can be displayed alongside the indicator.
     * @protected
     */
    protected renderContent(): void {
        if (!this.hasParsedData() || !this.progressData) {
            this.shadow.innerHTML = `<div style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Progress data missing or invalid.</div>`;
            return;
        }

        const { value = 0, variant = "linear", label, indeterminate = false } = this.progressData;

        // Ensure value is clamped between 0 and 100 for determinate progress
        const clampedValue = Math.max(0, Math.min(100, value));

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block; /* Typically block-level, or inline-block if space is tight */
                    box-sizing: border-box;
                    text-align: center; /* Center content */
                    ${this.progressData.style ? formatInlineStyle(this.progressData.style) : ''}
                    ${this.progressData.layout ? formatLayoutMetaAsHostStyle(this.progressData.layout) : ''}
                    /* Base transitions for enter/exit */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                /* Transition classes for host element (defined in transition.css usually) */
                :host(.progress-enter) { opacity: 0; }
                :host(.progress-enter-active) { opacity: 1; }
                :host(.progress-exit) { opacity: 1; }
                :host(.progress-exit-active) { opacity: 0; }

                .progress-container {
                    display: inline-flex; /* Use inline-flex to group indicator and label */
                    align-items: center;
                    justify-content: center;
                    flex-direction: ${variant === "linear" ? "row" : "column"}; /* Label below circular, beside linear */
                    gap: 0.75rem; /* Spacing between indicator and label */
                    width: 100%; /* Take full width of host */
                    max-width: 300px; /* Limit max width for linear progress for better aesthetics */
                }
                .label {
                    font-size: 0.9em; /* Slightly larger label */
                    color: #555;
                    white-space: nowrap; /* Prevent label text from wrapping */
                }

                /* Linear Progress Styles */
                .linear-wrapper {
                    flex: 1; /* Allows linear bar to take available space */
                    width: 100%;
                    height: 8px; /* Fixed height for linear bar */
                    background-color: #e0e0e0; /* Track color */
                    border-radius: 4px;
                    overflow: hidden; /* Hide overflow of fill/indeterminate bar */
                    position: relative;
                }
                .linear-fill {
                    height: 100%;
                    background-color: #007bff; /* Fill color */
                    width: ${clampedValue}%;
                    transition: width 0.3s ease-in-out; /* Smooth width transition */
                    border-radius: 4px;
                }
                .linear-indeterminate {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    width: 40%; /* Width of the moving bar */
                    background: linear-gradient(90deg, transparent, #007bff, transparent); /* Gradient for a softer look */
                    animation: linear-indeterminate 1.5s infinite forwards; /* Use forwards to stay at 100% at end */
                    border-radius: 4px;
                }
                @keyframes linear-indeterminate {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(250%); } /* Extends past end for a full sweep */
                }

                /* Circular Progress Styles */
                .circular-wrapper {
                    width: 40px; /* Fixed size for circular */
                    height: 40px;
                    border-radius: 50%;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8em; /* Font size for value if displayed internally */
                    color: #007bff;
                }
                .circular-track, .circular-fill {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                }
                .circular-track {
                    border: 4px solid #e0e0e0; /* Track color */
                }
                .circular-fill {
                    border: 4px solid transparent;
                    border-top-color: #007bff; /* Fill color */
                    border-left-color: #007bff;
                    transform: rotate(${clampedValue * 3.6}deg); /* Rotate for determinate fill */
                    transition: transform 0.3s ease-in-out;
                }
                .circular-value {
                     position: absolute;
                     font-size: 0.75em;
                     color: #333;
                }
                /* Indeterminate circular animation (separate from determinate fill) */
                .circular-indeterminate-animation {
                    border-top-color: #007bff; /* Primary color */
                    border-left-color: #007bff;
                    animation: spin 0.8s linear infinite; /* Faster spin for indeterminate */
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
            <div class="progress-container">
                ${variant === "linear" ? `
                    <div class="linear-wrapper">
                        ${indeterminate
            ? `<div class="linear-indeterminate"></div>`
            : `<div class="linear-fill"></div>`}
                    </div>
                ` : `
                    <div class="circular-wrapper">
                        ${indeterminate ? `
                            <div class="circular-track"></div>
                            <div class="circular-fill circular-indeterminate-animation"></div>
                        ` : `
                            <div class="circular-track" style="background: conic-gradient(#007bff ${clampedValue}%, #e0e0e0 ${clampedValue}%); transform: rotate(-90deg);"></div>
                            ${/* Optional: display value inside circular progress */''}
                            ${label ? `<span class="circular-value">${clampedValue}%</span>` : ''}
                        `}
                    </div>
                `}
                ${label && variant === 'linear' ? `<span class="label">${label}</span>` : ""}
            </div>
        `;
    }
}

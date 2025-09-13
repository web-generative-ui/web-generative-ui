import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Loading, TransitionConfig} from "../schema.ts";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";

/**
 * `UiLoading` is a custom UI component that displays various types of loading indicators,
 * optionally accompanied by a message.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Loading` object.
 *
 * @element ui-loading
 * @slot N/A
 */
export class UiLoading extends BaseUiComponent {

    /**
     * The parsed data for the loading component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private loadingData: Loading | null = null;

    /**
     * Constructs an instance of `UiLoading`.
     * The `BaseUiComponent` constructor handles the initialization of core services.
     * Shadow DOM attachment is now handled by `BaseUiComponent`'s `connectedCallback`.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Overrides the default `transitionConfig` from `BaseUiComponent` to define
     * specific CSS classes for loading indicator enter/exit animations.
     * @public
     */
    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'loading-enter',
        enterActive: 'loading-enter-active',
        exit: 'loading-exit',
        exitActive: 'loading-exit-active'
    };

    /**
     * Parses the JSON string from the `data` attribute into a `Loading` object.
     * Includes validation to ensure the `component` type is 'loading'.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== "loading") {
                throw new Error("Invalid loading component data: 'component' must be 'loading'.");
            }
            this.loadingData = parsed as Loading;
        } catch (e: unknown) {
            console.error("UiLoading: Failed to parse data attribute:", e);
            this.loadingData = null;
        }
    }

    /**
     * Indicates whether the `loadingData` has been successfully parsed.
     * @protected
     * @returns `true` if `loadingData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.loadingData !== null;
    }

    /**
     * Renders the HTML content of the loading component into its Shadow DOM.
     * It displays a loading indicator based on the `variant` property, along with an optional message.
     * @protected
     */
    protected renderContent() {
        if (!this.hasParsedData() || !this.loadingData) {
            this.shadow.innerHTML = `<div style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Loading data missing or invalid.</div>`;
            return;
        }

        const { variant = "spinner", message = "Loading..." } = this.loadingData;

        let loaderHtml = "";
        switch (variant) {
            case "spinner":
                loaderHtml = `<div class="loading-spinner"></div>`;
                break;
            case "skeleton":
                loaderHtml = `<div class="loading-skeleton"><div class="line"></div><div class="line"></div></div>`;
                break;
            case "dots":
                loaderHtml = `
                    <div class="loading-dots">
                        <span style="animation-delay: -0.32s;"></span>
                        <span style="animation-delay: -0.16s;"></span>
                        <span style="animation-delay: 0s;"></span>
                    </div>`;
                break;
            case "bar":
                loaderHtml = `<div class="loading-bar"><div class="bar"></div></div>`;
                break;
            default: // Fallback for unknown variants
                loaderHtml = `<div class="loading-spinner"></div>`;
                console.warn(`UiLoading: Unknown loading variant '${variant}'. Defaulting to 'spinner'.`);
                break;
        }

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    box-sizing: border-box;
                    text-align: center; /* Center text and loaders */
                    padding: 1em;
                    ${this.loadingData.style ? formatInlineStyle(this.loadingData.style) : ''}
                    ${this.loadingData.layout ? formatLayoutMetaAsHostStyle(this.loadingData.layout) : ''}
                    /* Base transitions for enter/exit */
                    transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                }
                /* Transition classes for host element (defined in transition.css usually) */
                :host(.loading-enter) { opacity: 0; }
                :host(.loading-enter-active) { opacity: 1; }
                :host(.loading-exit) { opacity: 1; }
                :host(.loading-exit-active) { opacity: 0; }

                .loading-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    flex-direction: column;
                    gap: 0.8em; /* Spacing between loader and message */
                    min-height: 50px; /* Ensure some vertical space */
                }
                .loading-spinner {
                    border: 4px solid rgba(0, 0, 0, 0.1);
                    border-left-color: #007bff; /* Primary color */
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .loading-skeleton {
                    width: 100%; /* Skeletons typically take full width */
                    max-width: 250px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px; /* Gap between skeleton lines */
                }
                .loading-skeleton .line {
                    width: 100%;
                    height: 16px;
                    background: linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 50%, #f0f0f0 100%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite linear;
                    border-radius: 4px;
                }
                .loading-skeleton .line:nth-child(2) { width: 80%; } /* Shorter second line */
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .loading-dots {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .loading-dots span {
                    display: inline-block;
                    width: 10px; /* Slightly larger dots */
                    height: 10px;
                    margin: 0 4px; /* Slightly more margin */
                    background: #007bff; /* Primary color */
                    border-radius: 50%;
                    animation: bounce 1.4s infinite both;
                }
                .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
                .loading-dots span:nth-child(2) { animation-delay: -0.16s; }
                .loading-dots span:nth-child(3) { animation-delay: 0s; }
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); opacity: 0; } /* Fade out and scale down */
                    40% { transform: scale(1); opacity: 1; } /* Scale up and fade in */
                }
                .loading-bar {
                    width: 100%;
                    max-width: 200px;
                    height: 8px;
                    background: #e0e0e0; /* Background for the track */
                    border-radius: 4px;
                    overflow: hidden;
                }
                .loading-bar .bar {
                    width: 0;
                    height: 100%;
                    background: #007bff; /* Primary color */
                    border-radius: 4px;
                    animation: load 2s infinite cubic-bezier(0.65, 0.81, 0.73, 0.4); /* Smoother animation */
                }
                @keyframes load {
                    0% { transform: translateX(-100%); width: 0; }
                    50% { transform: translateX(0%); width: 100%; }
                    100% { transform: translateX(100%); width: 0; }
                }
                .loading-text {
                    margin-top: 10px;
                    font-size: 0.9em; /* Slightly smaller text */
                    color: #555; /* Softer color */
                    text-align: center;
                }
            </style>
            <div class="loading-container">
                ${loaderHtml}
                <div class="loading-text">${message}</div>
            </div>
        `;
    }
}

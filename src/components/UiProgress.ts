import type {Progress, TransitionConfig} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";

export class UiProgress extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private progressData: Progress | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'progress-enter',
        enterActive: 'progress-enter-active',
        exit: 'progress-exit',
        exitActive: 'progress-exit-active'
    };

    protected parseData(dataString: string) {
        try {
            this.progressData = JSON.parse(dataString) as Progress;
        } catch (e) {
            console.error("UiProgress: Failed to parse data attribute:", e);
            this.progressData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.progressData !== null;
    }

    protected renderContent(): void {
        if (!this.progressData) return;

        const { value = 0, variant = "linear", label, indeterminate } = this.progressData;

        this.shadow.innerHTML = `
            <style>
                :host { display: inline-block; }
                .progress-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: ${variant === "linear" ? "column" : "row"};
                    gap: 0.5rem;
                }
                .label {
                    font-size: 0.875rem;
                    color: #444;
                }

                /* Linear Progress */
                .linear {
                    width: 100%;
                    height: 8px;
                    background-color: #eee;
                    border-radius: 4px;
                    overflow: hidden;
                    position: relative;
                }
                .linear-fill {
                    height: 100%;
                    background-color: #007bff;
                    transition: width 0.3s ease;
                }
                .linear-indeterminate {
                    position: absolute;
                    width: 30%;
                    height: 100%;
                    background-color: #007bff;
                    animation: linear-indeterminate 1.5s infinite;
                }
                @keyframes linear-indeterminate {
                    0% { left: -30%; }
                    50% { left: 100%; }
                    100% { left: 100%; }
                }

                /* Circular Progress */
                .circular {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 4px solid #eee;
                    border-top-color: #007bff;
                    animation: ${indeterminate ? "spin 1s linear infinite" : "none"};
                    position: relative;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
            <div class="progress-container">
                ${variant === "linear"
            ? `<div class="linear">
                            ${indeterminate
                ? `<div class="linear-indeterminate"></div>`
                : `<div class="linear-fill" style="width: ${value}%;"></div>`}
                       </div>`
            : `<div class="circular" style="${!indeterminate ? `background: conic-gradient(#007bff ${value}%, #eee ${value}%);` : ""}"></div>`
        }
                ${label ? `<span class="label">${label}</span>` : ""}
            </div>
        `;
    }
}

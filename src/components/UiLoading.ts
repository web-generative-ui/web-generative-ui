import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Loading, TransitionConfig} from "../schema.ts";

export class UiLoading extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private loadingData: Loading | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'loading-enter',
        enterActive: 'loading-enter-active',
        exit: 'loading-exit',
        exitActive: 'loading-exit-active'
    };

    protected parseData(dataString: string) {
        try {
            this.loadingData = JSON.parse(dataString) as Loading;
        } catch (e) {
            console.error("UiLoading: Failed to parse data attribute:", e);
            this.loadingData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.loadingData !== null;
    }

    protected renderContent() {
        const variant = this.loadingData?.variant ?? "spinner";
        const message = this.loadingData?.message ?? "Loading...";

        let loaderHtml = "";
        switch (variant) {
            case "spinner":
                loaderHtml = `<div class="loading-spinner"></div>`;
                break;
            case "skeleton":
                loaderHtml = `<div class="loading-skeleton"></div>`;
                break;
            case "dots":
                loaderHtml = `
                    <div class="loading-dots">
                        <span></span><span></span><span></span>
                    </div>`;
                break;
            case "bar":
                loaderHtml = `<div class="loading-bar"><div class="bar"></div></div>`;
                break;
        }

        this.shadow.innerHTML = `
            <style>
                :host { display: block; }
                .loading-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100%;
                    flex-direction: column;
                }
                .loading-spinner {
                    border: 4px solid rgba(0, 0, 0, 0.1);
                    border-left-color: #007bff;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .loading-skeleton {
                    width: 80%;
                    height: 20px;
                    background: linear-gradient(90deg, #eee, #ddd, #eee);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 4px;
                }
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .loading-dots span {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    margin: 0 3px;
                    background: #007bff;
                    border-radius: 50%;
                    animation: bounce 1.4s infinite both;
                }
                .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
                .loading-dots span:nth-child(2) { animation-delay: -0.16s; }
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
                .loading-bar {
                    width: 80%;
                    height: 8px;
                    background: #eee;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .loading-bar .bar {
                    width: 0;
                    height: 100%;
                    background: #007bff;
                    animation: load 2s infinite;
                }
                @keyframes load {
                    0% { width: 0; }
                    50% { width: 80%; }
                    100% { width: 0; }
                }
                .loading-text {
                    margin-top: 10px;
                    font-size: 14px;
                    color: #333;
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

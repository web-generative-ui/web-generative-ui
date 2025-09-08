import {BaseUiComponent} from "./BaseUiComponent.ts";
import type {Error} from "../schema.ts";

export class UiError extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private errorData: Error | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(data: string): void {
        try {
            const parsed = JSON.parse(data);
            if (parsed.component !== "error" || !parsed.message) {
                throw new Error("Invalid error component data");
            }
            this.errorData = parsed;
        } catch (e) {
            console.error("UiError parseData error:", e);
            this.errorData = {
                component: "error",
                message: "Unknown error",
            };
        }
        this.renderContent();
    }

    protected renderContent(): void {
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = `<div style="color:red;">Critical: Failed to render UiError</div>`;
            return;
        }

        const { message, original } = this.errorData!;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: monospace;
                    color: #b00020;
                    background: #fff0f0;
                    border: 1px solid #e0b4b4;
                    border-radius: 4px;
                    padding: 0.75em;
                    margin: 0.5em 0;
                    white-space: pre-wrap;
                }
                .header {
                    font-weight: bold;
                    margin-bottom: 0.5em;
                }
                .details {
                    font-size: 0.9em;
                    color: #555;
                }
            </style>
            <div class="header">⚠️ Component Render Error</div>
            <div>${message}</div>
            ${
            original
                ? `<div class="details">Original data: ${JSON.stringify(original, null, 2)}</div>`
                : ""
        }
        `;
    }

    protected hasParsedData(): boolean {
        return this.errorData !== null;
    }
}

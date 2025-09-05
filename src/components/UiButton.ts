import { BaseUiComponent } from "./BaseUiComponent.ts";
import type { Button } from "../schema.ts";

export class UiButton extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private buttonData: Button | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(dataString: string) {
        try {
            this.buttonData = JSON.parse(dataString) as Button;
        } catch (e) {
            console.error("UiButton: Failed to parse data attribute:", e);
            this.buttonData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.buttonData !== null;
    }

    protected renderContent(): void {
        const label = this.buttonData?.label ?? "Button";
        const action = this.buttonData?.action ?? null;

        this.shadow.innerHTML = `
            <style>
                :host { display: inline-block; }
                .btn {
                    padding: 8px 16px;
                    background: #007bff;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.2s;
                }
                .btn:hover {
                    background: #0056b3;
                }
                .btn:active {
                    background: #004085;
                }
            </style>
            <button class="btn">${label}</button>
        `;

        const buttonEl = this.shadow.querySelector(".btn") as HTMLButtonElement;
        if (buttonEl && action) {
            buttonEl.addEventListener("click", () => {
                this.dispatchEvent(new CustomEvent("button-action", {
                    detail: { action },
                    bubbles: true,
                    composed: true,
                }));
            });
        }
    }
}

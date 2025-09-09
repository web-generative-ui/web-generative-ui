import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {Button, TransitionConfig} from "../schema.ts";

export class UiButton extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private buttonData: Button | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'btn-rise-enter',
        enterActive: 'btn-rise-enter-active',
        exit: 'btn-fade-exit',
        exitActive: 'btn-fade-exit-active'
    };

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
        if (!this.buttonData) return;
        const { label, action, icon } = this.buttonData;

        this.shadow.innerHTML = `
            <style>
                :host { display: inline-block; }
                .btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4em;
                    padding: 8px 16px;
                    background: #007bff;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.2s;
                }
                .btn:hover { background: #0056b3; }
                .btn:active { background: #004085; }
                .btn-icon {
                    display: inline-flex;
                    vertical-align: middle;
                }
                .btn-icon-left { order: -1; }
                .btn-icon-right { order: 1; }
            </style>
            <button class="btn">
                ${icon ? this.renderIcon(icon, "left") : ""}
                <span class="btn-label">${label}</span>
                ${icon ? this.renderIcon(icon, "right") : ""}
            </button>
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

    private renderIcon(icon: Button["icon"], position: "left" | "right"): string {
        if (!icon || icon.position !== position) return "";
        return `
            <ui-icon data='${JSON.stringify({
            component: "icon",
            name: icon.name,
            variant: icon.variant ?? "filled",
            size: icon.size ?? "1em",
        })}' class="btn-icon btn-icon-${position}"></ui-icon>
        `;
    }
}

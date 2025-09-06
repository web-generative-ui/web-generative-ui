import type {Icon} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";
import {IconRegistry} from "../core/IconRegistry.ts";


export class UiIcon extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private iconData: Icon | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(dataString: string) {
        try {
            this.iconData = JSON.parse(dataString) as Icon;
        } catch (e) {
            console.error("UiIcon: Failed to parse data attribute:", e);
            this.iconData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.iconData !== null;
    }

    protected renderContent(): void {
        if (!this.iconData) return;

        const { name, variant = "filled", size = "1em" } = this.iconData;
        const svg = IconRegistry.getIcon(name, variant);

        this.shadow.innerHTML = `
            <style>
                :host { display: inline-flex; }
                .icon {
                    width: ${size};
                    height: ${size};
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                svg {
                    width: 100%;
                    height: 100%;
                    fill: currentColor;
                }
            </style>
            <span class="icon">${svg}</span>
        `;
    }
}

import { BaseUiComponent } from "./BaseUiComponent.ts";
import type {CollapseBlock} from "../schema.ts";

export class UiCollapseBlock extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private blockData: CollapseBlock | null = null;
    private isCollapsed: boolean = false;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(data: string): void {
        try {
            const parsed = JSON.parse(data);
            if (parsed.component !== "collapse-block" || !parsed.title) {
                throw new Error("Invalid collapse-block component data");
            }
            this.blockData = parsed;
            this.isCollapsed = Boolean(parsed.collapsed);
            this.renderContent();
        } catch (e) {
            console.error("UiCollapseBlock parseData error:", e);
            this.blockData = null;
            this.renderContent();
        }
    }

    protected renderContent(): void {
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = `<span style="color: red;">Invalid or missing collapse-block data</span>`;
            return;
        }

        const { title } = this.blockData!;

        this.shadow.innerHTML = `
        <style>
            :host {
                display: block;
                border: 1px solid #ccc;
                border-radius: 6px;
                margin: 0.5em 0;
                font-family: sans-serif;
            }
            .header {
                background: #f5f5f5;
                padding: 0.5em 1em;
                cursor: pointer;
                font-weight: bold;
                user-select: none;
            }
            .body {
                overflow: hidden;
                max-height: 0;
                opacity: 0;
                transition: max-height 300ms ease, opacity 200ms ease;
            }
            .body.expanded {
                opacity: 1;
            }
        </style>
        <div class="header">${title}</div>
        <div class="body box-content ${this.isCollapsed ? "" : "expanded"}"></div>
    `;
        const header = this.shadow.querySelector(".header");
        const body = this.shadow.querySelector(".body") as HTMLElement;

        const scrollHeight = body.scrollHeight;
        body.style.maxHeight = this.isCollapsed ? "0" : `${scrollHeight}px`;

        if (header && body) {
            header.addEventListener("click", () => {
                this.isCollapsed = !this.isCollapsed;
                body.classList.toggle("expanded", !this.isCollapsed);
            });

            if (this.blockData?.content) {
                this.registry.getInterpreter().render(body, this.blockData.content);
            }
        }
    }

    protected hasParsedData(): boolean {
        return this.blockData !== null;
    }
}

customElements.define("ui-collapse-block", UiCollapseBlock);

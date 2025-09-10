import type { Link } from "../schema.ts";
import { BaseUiComponent } from "./BaseUiComponent.ts";
import { applyLayoutMeta } from "../core/common.ts";

export class UiLink extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private linkData: Link | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(dataString: string): void {
        try {
            this.linkData = JSON.parse(dataString) as Link;
        } catch (e) {
            console.error("UiLink: Failed to parse data attribute:", e);
            this.linkData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.linkData !== null;
    }

    protected renderContent(): void {
        if (!this.linkData) return;

        const { href, target, children } = this.linkData;

        this.shadow.innerHTML = `
            <style>
                :host { display: inline-flex; }
                a {
                    color: #007bff;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                a:hover {
                    text-decoration: underline;
                }
            </style>
            <a href="${href}" ${target ? `target="${target}"` : ""}></a>
        `;

        const anchor = this.shadow.querySelector("a");
        if (anchor && Array.isArray(children)) {
            for (const child of children) {
                const wrapper = document.createElement("span");
                applyLayoutMeta(wrapper, child.layout);

                anchor.appendChild(wrapper);
                this.registry.getInterpreter().render(wrapper, child);
            }
        }
    }
}

import {BaseUiComponent} from "./BaseUiComponent.ts";
import type {Image, Link, Text} from "../schema.ts";

export class UiLink extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private linkData: Link | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    protected parseData(dataString: string) {
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
        const items = children?.items || [];
        const contentHTML = items.map(item => {
            switch (item.component) {
                case 'text':
                    return `<span>${(item as Text).text}</span>`;
                case 'icon':
                    return `<ui-icon data='${JSON.stringify(item)}'></ui-icon>`;
                case 'image':
                    return `<ui-image src="${(item as Image).src}" alt="${(item as Image).alt || ''}" />`;
                case 'badge':
                    return `<ui-badge data='${JSON.stringify(item)}'></ui-badge>`;
                default:
                    return '';
            }
        }).join('');

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
            <a href="${href}" ${target ? `target="${target}"` : ''}>
                ${contentHTML}
            </a>
        `;
    }
}

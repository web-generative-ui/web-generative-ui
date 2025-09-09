import type {Badge, TransitionConfig} from "../schema.ts";
import {BaseUiComponent} from "./BaseUiComponent.ts";

export class UiBadge extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private badgeData: Badge | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'badge-pop-enter',
        enterActive: 'badge-pop-enter-active',
        exit: 'badge-pop-exit',
        exitActive: 'badge-pop-exit-active'
    }

    protected parseData(dataString: string) {
        try {
            this.badgeData = JSON.parse(dataString) as Badge;
        } catch (e) {
            console.error("UiBadge: Failed to parse data attribute:", e);
            this.badgeData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.badgeData !== null;
    }

    protected renderContent(): void {
        if (!this.badgeData) return;

        const { text, variant = "neutral", icon } = this.badgeData;
        const iconSize = icon?.size || "1em";
        const iconHtml = icon
            ? `<span class="icon ${icon.position || "left"}" style="font-size:${iconSize};">${this.renderIcon(
                icon
            )}</span>`
            : "";

        this.shadow.innerHTML = `
            <style>
                :host { display: inline-block; }
                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    line-height: 1;
                    white-space: nowrap;
                }
                .badge.info { background-color: #e0f2fe; color: #0369a1; }
                .badge.success { background-color: #dcfce7; color: #15803d; }
                .badge.warning { background-color: #fef9c3; color: #a16207; }
                .badge.error { background-color: #fee2e2; color: #b91c1c; }
                .badge.neutral { background-color: #f3f4f6; color: #374151; }

                .badge-icon {
                    display: inline-flex;
                    margin: 0 0.25em;
                    vertical-align: middle;
                }
                .badge-icon-left { order: -1; }
                .badge-icon-right { order: 1; }
            </style>
            <span class="badge ${variant}">
                ${icon && icon.position === "left" ? iconHtml : ""}
                <span class="text">${text}</span>
                ${icon && icon.position === "right" ? iconHtml : ""}
            </span>
        `;
    }

    private renderIcon(icon: Badge["icon"]): string {
        if (!icon) return "";

        const { name, variant = "filled", size = "1em", position = "left" } = icon;

        return `
        <ui-icon data='${JSON.stringify({
            component: "icon",
            name,
            variant,
            size
        })}' class="badge-icon badge-icon-${position}"></ui-icon>
    `;
    }
}

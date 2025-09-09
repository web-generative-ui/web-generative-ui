import {BaseUiComponent} from "./BaseUiComponent.ts";
import type {Tabs, TransitionConfig} from "../schema.ts";

export class UiTabs extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private tabsData: Tabs | null = null;
    private activeTabId: string | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'tab-content-enter',
        enterActive: 'tab-content-enter-active',
        exit: 'tab-content-exit',
        exitActive: 'tab-content-exit-active'
    };

    protected parseData(data: string): void {
        try {
            const parsed = JSON.parse(data);
            if (parsed.component !== "tabs" || !Array.isArray(parsed.tabs)) {
                throw new Error("Invalid tabs component data");
            }
            this.tabsData = parsed;
            this.activeTabId =
                parsed["active-tab"] && parsed.tabs.some((t: any) => t.id === parsed["active-tab"])
                    ? parsed["active-tab"]
                    : parsed.tabs[0]?.id ?? null;
            this.renderContent();
        } catch (e) {
            console.error("UiTabs parseData error:", e);
            this.tabsData = null;
            this.activeTabId = null;
            this.renderContent();
        }
    }

    protected renderContent(): void {
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = `<span style="color: red;">Invalid or missing tabs data</span>`;
            return;
        }

        const { tabs } = this.tabsData!;
        const activeId = this.activeTabId;

        this.shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: sans-serif;
                }
                .tab-headers {
                    display: flex;
                    border-bottom: 1px solid #ccc;
                }
                .tab-header {
                    padding: 0.5em 1em;
                    cursor: pointer;
                    border: none;
                    background: none;
                    font-weight: bold;
                }
                .tab-header.active {
                    border-bottom: 2px solid #007acc;
                    color: #007acc;
                }
                .tab-content {
                    padding: 1em;
                }
            </style>
            <div class="tab-headers">
                ${tabs
            .map(
                (t: { id: string | null; label: any; }) =>
                    `<button class="tab-header ${t.id === activeId ? "active" : ""}" data-id="${t.id}">${t.label}</button>`
            )
            .join("")}
            </div>
            <div class="tab-content"></div>
        `;

        const contentContainer = this.shadow.querySelector(".tab-content") as HTMLElement;
        const headerButtons = this.shadow.querySelectorAll(".tab-header");

        // set up event listeners
        headerButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                this.activeTabId = (btn as HTMLElement).dataset.id!;
                this.renderContent(); // re-render to update active state
            });
        });

        // render active tab content
        const activeTab = tabs.find((t) => t.id === activeId);
        if (activeTab && contentContainer) {
            this.registry.getInterpreter().render(contentContainer, activeTab.content);
        }
    }

    protected hasParsedData(): boolean {
        return this.tabsData !== null;
    }
}

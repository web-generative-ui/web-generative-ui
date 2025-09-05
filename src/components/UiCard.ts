import type {Card, TransitionConfig} from '../schema.ts';
import {BaseUiComponent} from './BaseUiComponent';

export class UiCard extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private cardData: Card | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'card-slide-enter',
        enterActive: 'card-slide-enter-active'
    }

    protected parseData(dataString: string): void {
        try {
            this.cardData = JSON.parse(dataString) as Card;
        } catch (e) {
            console.error("UiCard: Failed to parse data attribute:", e);
            this.cardData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.cardData !== null;
    }

    protected renderContent(): void {
        this.shadow.innerHTML = `
            <style>
                :host { display: block; }
                .card {
                    border: 1px solid #ccc;
                    border-radius: 8px;
                    padding: 16px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }
                h3 {
                    margin-top: 0;
                    margin-bottom: 10px;
                }
                .card-content {
                    margin-top: 10px;
                }
            </style>
            <div class="card">
                <h3>${this.cardData?.title || ''}</h3>
                <div class="card-content"></div>
            </div>
        `;

        if (this.cardData?.children?.items) {
            const contentContainer = this.shadow.querySelector('.card-content');
            if (contentContainer) {
                this.registry.getInterpreter().render(contentContainer, this.cardData.children.items);
            }
        }
    }
}

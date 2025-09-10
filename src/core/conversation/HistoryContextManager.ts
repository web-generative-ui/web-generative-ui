// In HistoryContextManager.ts
export class HistoryContextManager {
    private container: HTMLElement;
    private config: any;
    private historyPanel: HTMLElement | null = null;
    private mainContent: HTMLElement;

    constructor(container: HTMLElement, config: any) {
        this.container = container;
        this.config = config;
        this.mainContent = this.createMainContentElement();
        this.init();
    }

    private init(): void {
        // Reset container styles
        this.container.style.display = 'block';
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.overflow = 'hidden';

        // Create main content (this should be the only visible element initially)
        this.mainContent = document.createElement('div');
        this.mainContent.className = 'main-content';
        this.mainContent.style.width = '100%';
        this.mainContent.style.height = '100%';
        this.mainContent.style.overflow = 'auto';

        // Create history panel (but don't add it to DOM yet)
        this.historyPanel = document.createElement('div');
        this.historyPanel.className = `history-panel ${this.config?.position || 'left'}`;
        this.historyPanel.style.width = this.config?.width || '300px';
        this.historyPanel.style.display = 'none'; // Start hidden
        this.historyPanel.style.position = 'absolute';
        this.historyPanel.style.top = '0';
        this.historyPanel.style.bottom = '0';
        this.historyPanel.style.zIndex = '1000';

        // Append only the main content initially
        this.container.appendChild(this.mainContent);

        // Initialize responsive behavior
        this.initResponsiveBehavior();
    }

    private createMainContentElement(): HTMLElement {
        const mainContent = document.createElement('div');
        mainContent.className = 'main-content';
        mainContent.style.position = 'absolute';
        mainContent.style.top = '0';
        mainContent.style.left = '0';
        mainContent.style.right = '0';
        mainContent.style.bottom = '0';
        mainContent.style.overflow = 'auto';
        return mainContent;
    }

    getMainContentElement(): HTMLElement {
        return this.mainContent;
    }

    createHistoryElement(convId: string): HTMLElement {
        const historyEl = document.createElement('ui-history');

        const historyConfig = {
            convId,
            limit: this.config?.limit || 20,
            title: this.config?.title || 'Chat History',
            chunkable: this.config?.chunkable || false,
            defaultCollapsed: this.config?.defaultCollapsed || false,
            chunkSize: this.config?.chunkSize || 1,
            style: {
                backgroundColor: this.config?.style?.backgroundColor,
                borderColor: this.config?.style?.borderColor,
                accentColor: this.config?.style?.accentColor,
            }
        };

        historyEl.setAttribute('data', JSON.stringify(historyConfig));
        return historyEl;
    }

    // Update the show method
// In HistoryContextManager.ts - Update the show method
    show(convId: string): void {
        if (!this.historyPanel) return;

        // Add history panel to DOM if not already there
        if (!this.historyPanel.parentNode) {
            if (this.config?.position === 'right') {
                this.container.appendChild(this.historyPanel);
            } else {
                this.container.insertBefore(this.historyPanel, this.container.firstChild);
            }
        }

        // Clear previous history and add new one
        this.historyPanel.innerHTML = '';

        // Add a protective attribute to prevent Interpreter interference
        this.historyPanel.setAttribute('data-protected', 'true');

        const historyElement = this.createHistoryElement(convId);
        this.historyPanel.appendChild(historyElement);

        // Show the history panel
        this.historyPanel.style.display = 'flex';
        this.historyPanel.classList.add('visible');
        this.mainContent.classList.add(`with-history-${this.config?.position || 'left'}`);
    }

// Update the hide method
    hide(): void {
        if (!this.historyPanel) return;

        // Hide the history panel
        this.historyPanel.style.display = 'none';
        this.historyPanel.classList.remove('visible');
        this.mainContent.classList.remove(`with-history-${this.config?.position || 'left'}`);

        // Remove from DOM to prevent layout issues
        if (this.historyPanel.parentNode) {
            this.historyPanel.parentNode.removeChild(this.historyPanel);
        }
    }

    toggle(convId?: string): void {
        if (this.historyPanel?.classList.contains('visible')) {
            this.hide();
        } else if (convId) {
            this.show(convId);
        }
    }

    update(convId: string): void {
        if (this.historyPanel && this.historyPanel.classList.contains('visible')) {
            this.show(convId); // Re-render the history for the given conversation
        }
    }

    private handleResize(): void {
        const width = window.innerWidth;
        if (!this.historyPanel) return;

        if (width < 768) {
            // Mobile adjustments
            this.historyPanel.style.width = '100%';
            this.historyPanel.style.height = '50%';
            this.historyPanel.style.bottom = '0';
            this.historyPanel.style.top = 'auto';
        } else {
            // Reset to desktop styles
            this.historyPanel.style.width = this.config?.width || '300px';
            this.historyPanel.style.height = '100%';
            this.historyPanel.style.bottom = '';
            this.historyPanel.style.top = '0';
        }
    }

    private initResponsiveBehavior(): void {
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize(); // Initial call
    }
}

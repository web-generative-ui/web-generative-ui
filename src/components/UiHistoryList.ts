import { BaseUiComponent } from "./BaseUiComponent.ts";
import type { HistoryList } from "../schema.ts";
import "../history.css";

// Define types for chunk management
interface HistoryChunk {
    id: string;
    messages: any[];
    isCollapsed: boolean;
    timestamp: Date;
    height: number;
}

export class UiHistoryList extends BaseUiComponent {
    protected shadow: ShadowRoot;
    private historyData: HistoryList | null = null;
    private chunks: HistoryChunk[] = [];
    private chunkStates: Map<string, boolean> = new Map();
    private resizeObserver: ResizeObserver | null = null;
    private lastUpdateTime: number = 0;
    private updateDebounce: number | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    }

    /**
     * Parses the 'data' attribute to get the conversation ID and other options.
     */
    protected parseData(dataString: string): void {
        try {
            this.historyData = JSON.parse(dataString) as HistoryList;
        } catch (e) {
            console.error("UiHistoryList: Failed to parse data attribute:", e);
            this.historyData = null;
        }
    }

    /**
     * Checks if the component has valid data.
     */
    protected hasParsedData(): boolean {
        return this.historyData !== null;
    }

    private handleStoreUpdate = (updatedConvId: string) => {
        if (this.historyData && this.historyData.convId === updatedConvId) {
            // Debounce updates to prevent rapid re-renders
            if (this.updateDebounce) {
                clearTimeout(this.updateDebounce);
            }

            this.updateDebounce = setTimeout(() => {
                this._fetchAndRenderHistory();
            }, 300) as unknown as number;
        }
    };

    connectedCallback(): void {
        super.connectedCallback();
        this.store.on("update", this.handleStoreUpdate);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                    console.log("DOM changed in history panel:", mutation);
                }
            });
        });

        observer.observe(this.shadow, { childList: true, subtree: true });

        // Set up resize observer for chunk height tracking
        this.resizeObserver = new ResizeObserver((entries) => {
            requestAnimationFrame(() => {
                entries.forEach((entry) => {
                    const chunkElement = entry.target as HTMLElement;
                    const chunkId = chunkElement.dataset.chunkId;
                    if (chunkId && !chunkElement.classList.contains("collapsed")) {
                        const chunkIndex = this.chunks.findIndex((c) => c.id === chunkId);
                        if (chunkIndex !== -1) {
                            this.chunks[chunkIndex].height = entry.contentRect.height;
                            this._renderChunkIndicators();
                        }
                    }
                });
            });
        });
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.store.off("update", this.handleStoreUpdate);

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (this.updateDebounce) {
            clearTimeout(this.updateDebounce);
        }
    }

    /**
     * Groups messages into chunks based on configuration
     */
    private groupMessagesIntoChunks(envelopes: any[]): HistoryChunk[] {
        if (!this.historyData) return [];

        const chunkSize = this.historyData.chunkSize || 1;
        const defaultCollapsed = this.historyData.defaultCollapsed || false;
        const chunks: HistoryChunk[] = [];

        for (let i = 0; i < envelopes.length; i += chunkSize) {
            const chunkMessages = envelopes.slice(i, i + chunkSize);
            const chunkId = `chunk-${i}-${Date.now()}`;

            // Preserve existing state if available, otherwise use default
            const isCollapsed = this.chunkStates.has(chunkId)
                ? this.chunkStates.get(chunkId)!
                : defaultCollapsed;

            chunks.push({
                id: chunkId,
                messages: chunkMessages,
                isCollapsed,
                timestamp: new Date(),
                height: 0, // Will be set after rendering
            });
        }

        return chunks;
    }

    /**
     * Toggles the collapsed state of a chunk
     */
    private toggleChunk(chunkId: string): void {
        const currentState = this.chunkStates.get(chunkId) || false;
        this.chunkStates.set(chunkId, !currentState);

        // Update the chunk in our array
        const chunkIndex = this.chunks.findIndex((c) => c.id === chunkId);
        if (chunkIndex !== -1) {
            this.chunks[chunkIndex].isCollapsed = !currentState;
        }

        this._renderChunks();

        // Update indicators after a short delay to allow for animation
        setTimeout(() => this._renderChunkIndicators(), 350);
    }

    /**
     * Renders visual indicators for chunks
     */
    private _renderChunkIndicators(): void {
        console.log("Rendering chunk indicators with chunks:", this.chunks);

        const indicatorsContainer = this.shadow.querySelector(".chunk-indicators");
        console.log("Indicators container:", indicatorsContainer);
        if (!indicatorsContainer) {
            console.warn("Chunk indicators container not found");
            return;
        }

        // If no chunks, show a placeholder
        if (this.chunks.length === 0) {
            indicatorsContainer.innerHTML =
                '<div class="no-indicators">No history yet</div>';
            return;
        }

        // Calculate total height of all chunks
        const totalHeight = this.chunks.reduce((sum, chunk) => {
            return sum + (chunk.isCollapsed ? 40 : Math.max(chunk.height, 50));
        }, 0);

        // Don't render indicators if container is too small
        if (totalHeight < 100) {
            indicatorsContainer.innerHTML = "";
            return;
        }

        let indicatorsHTML = "";

        this.chunks.forEach((chunk) => {
            const chunkHeight = chunk.isCollapsed ? 40 : Math.max(chunk.height, 50);
            const percentage = (chunkHeight / totalHeight) * 100;

            // Only show indicators for chunks that take up at least 5% of the total height
            if (percentage >= 5) {
                indicatorsHTML += `
        <div class="chunk-indicator" 
             style="height: ${percentage}%"
             data-chunk-id="${chunk.id}"
             title="${chunk.messages.length} message(s)">
        </div>
      `;
            }
        });

        indicatorsContainer.innerHTML =
            indicatorsHTML || '<div class="no-indicators">Chunks too small</div>';

        // Add click handlers to indicators
        indicatorsContainer
            .querySelectorAll(".chunk-indicator")
            .forEach((indicator) => {
                const chunkId = indicator.getAttribute("data-chunk-id");
                indicator.addEventListener("click", () => {
                    if (chunkId) {
                        const chunkElement = this.shadow.querySelector(
                            `[data-chunk-id="${chunkId}"]`,
                        );
                        if (chunkElement) {
                            chunkElement.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                            });
                        }
                    }
                });
            });
        console.log("Chunk indicators rendered successfully");
    }

    /**
     * Renders the chunk UI
     */
    // In UiHistoryList.ts - Update the _renderChunks method
    private _renderChunks(): void {
        const messagesContainer = this.shadow.querySelector(".messages-container");
        if (!messagesContainer || !this.historyData) return;

        // Store scroll position before updating
        const scrollTop = messagesContainer.scrollTop;
        const scrollHeight = messagesContainer.scrollHeight;

        messagesContainer.innerHTML = "";

        this.chunks.forEach((chunk) => {
            const chunkElement = document.createElement("div");
            chunkElement.className = "history-chunk";
            chunkElement.dataset.chunkId = chunk.id;

            // Create chunk header
            const header = document.createElement("div");
            header.className = "chunk-header";
            header.innerHTML = `
      <span class="chunk-title">${this.formatChunkTitle(chunk)}</span>
      <span class="collapse-icon">${chunk.isCollapsed ? "▶" : "▼"}</span>
    `;
            header.addEventListener("click", () => this.toggleChunk(chunk.id));

            // Create chunk content
            const content = document.createElement("div");
            content.className = `chunk-content ${chunk.isCollapsed ? "collapsed" : ""}`;

            // Render messages in this chunk
            if (!chunk.isCollapsed) {
                // Use a wrapper to prevent Interpreter from affecting our structure
                const messageWrapper = document.createElement("div");
                messageWrapper.className = "message-wrapper";
                content.appendChild(messageWrapper);

                this.registry
                    .getInterpreter()
                    .render(messageWrapper, chunk.messages)
                    .then(() => {
                        // Update chunk height after rendering
                        setTimeout(() => {
                            chunk.height = content.scrollHeight;
                            this._renderChunkIndicators();

                            // Observe the chunk element for height changes
                            if (this.resizeObserver) {
                                this.resizeObserver.observe(content);
                            }
                        }, 50);
                    })
                    .catch((err) =>
                        console.error("Error rendering chunk messages:", err),
                    );
            } else {
                // Update chunk height for collapsed state
                chunk.height = 40;
                setTimeout(() => this._renderChunkIndicators(), 50);
            }

            chunkElement.appendChild(header);
            chunkElement.appendChild(content);
            messagesContainer.appendChild(chunkElement);
        });

        // Restore scroll position or scroll to bottom for new content
        setTimeout(() => {
            if (Date.now() - this.lastUpdateTime < 2000) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                messagesContainer.scrollTop =
                    scrollTop + (messagesContainer.scrollHeight - scrollHeight);
            }
        }, 100);

        this.lastUpdateTime = Date.now();
    }

    /**
     * Formats the title for a chunk based on its content
     */
    private formatChunkTitle(chunk: HistoryChunk): string {
        if (chunk.messages.length === 0) return "Empty chunk";

        const firstMessage = chunk.messages[0];
        const firstContent = firstMessage.payload?.content || "";
        let title = "";
        if (typeof firstContent === "string") {
            title = firstContent.substring(0, 30);
        } else if (firstContent.text) {
            title = firstContent.text.substring(0, 30);
        }

        if (chunk.messages.length > 1) {
            title += `... (+${chunk.messages.length - 1} more)`;
        }

        return title;
    }

    /**
     * Handles the transition for new data
     */
    private async handleNewDataTransition(): Promise<void> {
        const messagesContainer = <HTMLElement>(
            this.shadow.querySelector(".messages-container")
        );
        if (!messagesContainer) return;

        // Add transition class
        messagesContainer.classList.add("transitioning");

        // Scroll up to hide old content
        messagesContainer.style.transform = "translateY(-100%)";
        messagesContainer.style.opacity = "0";

        // Wait for transition to complete
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Clear container and reset transform
        messagesContainer.innerHTML = "";
        messagesContainer.style.transform = "";
        messagesContainer.style.opacity = "";

        // Remove transition class after a brief delay
        setTimeout(() => {
            messagesContainer.classList.remove("transitioning");
        }, 50);
    }

    private async _fetchAndRenderHistory(): Promise<void> {
        if (!this.historyData) return;

        // Handle transition for new data
        if (this.chunks.length > 0) {
            await this.handleNewDataTransition();
        }

        const envelopes = await this.store.getHistory(this.historyData.convId, {
            limit: this.historyData.limit,
        });

        const validEnvelopes = envelopes.filter(
            (env) =>
                env?.payload?.component && typeof env.payload.component === "string",
        );

        // Group messages into chunks
        this.chunks = this.groupMessagesIntoChunks(validEnvelopes);

        // Re-render the chunks
        this._renderChunks();
    }

    /**
     * Renders the component's shell and triggers the async data fetching.
     */
    protected renderContent(): void {
        if (!this.hasParsedData()) {
            this.shadow.innerHTML = "";
            return;
        }

        this.shadow.innerHTML = `
      <style>
        :host { 
          display: flex; 
          height: 100%;
          background-color: ${this.historyData?.style?.backgroundColor || "#f8f9fa"};
          border: 1px solid ${this.historyData?.style?.borderColor || "#e9ecef"};
          border-radius: 8px;
          overflow: hidden;
        }
        
          .history-protected {
        display: flex;
        height: 100%;
        pointer-events: auto;
      }
      
      .message-wrapper {
        display: contents; /* Allows content to flow normally */
      }
        
        .chunk-indicators {
          width: 12px;
          background-color: #f1f3f5;
          border-right: 1px solid #e9ecef;
          display: flex;
          flex-direction: column;
          padding: 4px 0;
          cursor: pointer;
        }
        
        .chunk-indicator {
          background-color: ${this.historyData?.style?.accentColor || "#007bff"};
          margin: 2px;
          border-radius: 2px;
          opacity: 0.6;
          transition: opacity 0.2s ease;
        }
        
        .chunk-indicator:hover {
          opacity: 1;
        }
        
        .history-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .history-title { 
          font-weight: bold; 
          padding: 0.75em;
          color: ${this.historyData?.style?.accentColor || "#007bff"};
          border-bottom: 1px solid #e9ecef;
          background-color: white;
        }
        
        .messages-container { 
          flex: 1;
          overflow-y: auto;
          padding: 0.5em;
          transition: transform 0.5s ease, opacity 0.5s ease;
        }
        
        .messages-container.transitioning {
          overflow: hidden;
        }
        
        .error-message { 
          color: #666; 
          font-style: italic; 
          padding: 1em;
          text-align: center;
        }
        
        .history-chunk {
          border: 1px solid #dee2e6;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 0.75em;
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .history-chunk:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        
        .chunk-header {
          padding: 0.75em;
          background-color: #f8f9fa;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 500;
          transition: background-color 0.2s ease;
        }
        
        .chunk-header:hover {
          background-color: #e9ecef;
        }
        
        .chunk-content {
          padding: 0.75em;
          max-height: 1000px;
          overflow: hidden;
          transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease;
        }
        
        .chunk-content.collapsed {
          max-height: 0;
          padding: 0;
          opacity: 0;
        }
        
        .collapse-icon {
          font-size: 0.8em;
          color: #6c757d;
        }
        
        /* Responsive styles */
        @media (max-width: 768px) {
          :host {
            flex-direction: column;
          }
          
           .chunk-indicators {
            width: 12px;
            background-color: #f1f3f5;
            border-right: 1px solid #e9ecef;
            display: flex;
            flex-direction: column;
            padding: 4px 0;
            cursor: pointer;
            min-height: 100px; /* Ensure it has a minimum height */
        }
          
          .chunk-indicator {
            height: 8px;
            margin: 2px 0;
          }
        }
      </style>
      
      <div class="history-protected">
      <div class="chunk-indicators"></div>
      
      <div class="history-content">
        ${this?.historyData?.title ? `<div class="history-title">${this.historyData.title}</div>` : ""}
        <div class="messages-container"></div>
      </div>
    </div>
    `;

        setTimeout(() => {
            this._renderChunkIndicators();
        }, 100);

        this._fetchAndRenderHistory();
    }
}

customElements.define("ui-history", UiHistoryList);

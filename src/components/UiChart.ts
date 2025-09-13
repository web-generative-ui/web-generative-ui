import {BaseUiComponent} from "./BaseUiComponent";
import type {Chart as SchemaChart, TransitionConfig} from "../schema";
import type {GenericChartInstance} from "../charts/types";
import {formatInlineStyle, formatLayoutMetaAsHostStyle} from "./common.ts";
import {chartRendererRegistry} from "../charts/ChartRendererRegistry.ts";

/**
 * `UiChart` is a custom UI component that renders various types of charts
 * (e.g., bar, line, pie) using an underlying charting library (e.g., Chart.js).
 * It acts as an adapter, transforming a generic schema into library-specific chart configurations.
 *
 * This component extends `BaseUiComponent` and leverages Shadow DOM for encapsulation.
 * Data is passed via the `data` attribute, which is parsed into a `Chart` object.
 *
 * @element ui-chart
 * @slot N/A
 */
export class UiChart extends BaseUiComponent {

    /**
     * The parsed data for the chart component, derived from the `data` attribute.
     * It is `null` if no data has been parsed or if parsing failed.
     * @private
     */
    private chartData: SchemaChart | null = null;
    /**
     * The instance of the underlying charting library (e.g., Chart.js Chart object).
     * @private
     */
    private chartInstance: GenericChartInstance | null = null;
    /**
     * The HTML `<canvas>` element where the chart is rendered.
     * @private
     */
    private canvasElement: HTMLCanvasElement | null = null;

    /**
     * Constructs an instance of `UiChart`.
     * The `BaseUiComponent` constructor handles core service initialization and Shadow DOM attachment.
     */
    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({mode: 'open'});
    }

    /**
     * Overrides the default `transitionConfig` from `BaseUiComponent` to define
     * specific CSS classes for chart component enter/exit animations.
     * @public
     */
    public static override transitionConfig: Partial<TransitionConfig> = {
        enter: 'chart-fade-enter',
        enterActive: 'chart-fade-enter-active',
        exit: 'chart-fade-exit',
        exitActive: 'chart-fade-exit-active'
    };

    /**
     * Parses the JSON string from the `data` attribute into a `Chart` object.
     * Includes validation to ensure the `component` type is 'chart'.
     * This method is solely responsible for data parsing, not rendering.
     * @protected
     * @param dataString The JSON string from the `data` attribute.
     */
    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== 'chart') {
                throw new Error('Invalid chart component data: "component" must be "chart".');
            }
            this.chartData = parsed as SchemaChart;
            this.destroyChart();
        } catch (e: unknown) {
            console.error('UiChart: Failed to parse data attribute:', e);
            this.chartData = null;
            this.destroyChart();
        }
    }

    /**
     * Indicates whether the `chartData` has been successfully parsed.
     * @protected
     * @returns `true` if `chartData` is not `null`, `false` otherwise.
     */
    protected hasParsedData(): boolean {
        return this.chartData !== null;
    }

    /**
     * Extends `connectedCallback` from `BaseUiComponent` to trigger initial chart rendering.
     * @override
     */
    override connectedCallback(): void {
        super.connectedCallback();
        requestAnimationFrame(() => this.renderContent());
    }

    /**
     * **(Implemented abstract method)**
     * Renders the chart component. It creates a `<canvas>` element if one doesn't exist,
     * retrieves the appropriate `ChartRenderer` from the registry, and then either
     * initializes a new chart or updates an existing one.
     * @protected
     */
    protected async renderContent(): Promise<void> {
        if (!this.hasParsedData() || !this.chartData) {
            this.shadow.innerHTML = `<p style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ Invalid or missing chart data.</p>`;
            this.destroyChart();
            return;
        }

        if (!this.shadow.querySelector('canvas')) {
            const hostHeight = this.chartData.style?.height || (this.chartData.layout?.span && typeof this.chartData.layout.span === 'string' ? this.chartData.layout.span : '400px'); // Default to 400px if no explicit height from schema

            this.shadow.innerHTML = `
                <style>
                    :host {
                        display: block;
                        box-sizing: border-box;
                        width: 100%;
                        height: ${hostHeight}; /* Apply determined height */
                        min-height: 250px; /* Ensure a minimum height always */
                        border-radius: 8px; /* Consistent rounded corners */
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1); /* Subtle shadow */
                        background-color: #fff; /* White background for charts */
                        ${this.chartData.style ? formatInlineStyle(this.chartData.style) : ''}
                        ${this.chartData.layout ? formatLayoutMetaAsHostStyle(this.chartData.layout) : ''}
                        /* Base transitions for host element */
                        transition: opacity 0.3s ease-out, transform 0.3s ease-out;
                    }
                    /* Transition classes for host element (defined in transition.css usually) */
                    :host(.chart-fade-enter) { opacity: 0; }
                    :host(.chart-fade-enter-active) { opacity: 1; }
                    :host(.chart-fade-exit) { opacity: 1; }
                    :host(.chart-fade-exit-active) { opacity: 0; }

                    canvas {
                        width: 100% !important; /* Ensure canvas takes full width of host */
                        height: 100% !important; /* Ensure canvas takes full height of host */
                        display: block; /* Remove default inline-block spacing */
                        box-sizing: border-box;
                    }
                </style>
                <canvas></canvas>
            `;
            this.canvasElement = this.shadow.querySelector('canvas');
        }

        if (!this.canvasElement) {
            console.error("UiChart: Canvas element not found for rendering.");
            return; // Should not happen if innerHTML assignment above worked
        }

        const chartType = this.chartData['chart-type'];
        const renderer = chartRendererRegistry.get(chartType);

        if (!renderer) {
            this.shadow.innerHTML = `<p style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">⚠️ No renderer found for chart type: '${chartType}'. Please ensure the renderer for this chart type is registered.</p>`;
            this.destroyChart();
            return;
        }

        try {
            // Initialize or update chart instance
            if (this.chartInstance) {
                await renderer.update(this.chartInstance, this.chartData.data, this.chartData.options);
            } else {
                this.chartInstance = await renderer.render({
                    canvas: this.canvasElement,
                    chartType: chartType,
                    chartData: this.chartData.data,
                    chartOptions: this.chartData.options
                });
            }
        } catch (e: unknown) {
            console.error(`UiChart: Error rendering chart type '${chartType}':`, e);
            this.shadow.innerHTML = `<p style="color: red; text-align: center; padding: 1em; font-family: sans-serif;">❌ Error rendering chart. See console for details.</p>`;
            this.destroyChart();
        }
    }

    /**
     * Destroys the current chart instance, if one exists, to prevent memory leaks.
     * @private
     */
    private destroyChart(): void {
        if (this.chartInstance) {
            this.chartInstance.destroy(); // Delegate to underlying library's destroy method
            this.chartInstance = null;
        }
    }
}

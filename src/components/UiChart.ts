import { BaseUiComponent } from "./BaseUiComponent";
import type { Chart } from "../schema";
import {chartRendererRegistry} from "../charts/ChartRendererRegistry.ts";
import type {GenericChartInstance} from "../charts/types.d.ts";

export class UiChart extends BaseUiComponent {
    private chartData: Chart | null = null;
    private chartInstance: GenericChartInstance | null = null;
    private canvasElement: HTMLCanvasElement | null = null;

    constructor() {
        super();
        this.shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    }

    protected parseData(dataString: string): void {
        try {
            const parsed = JSON.parse(dataString);
            if (parsed.component !== 'chart') {
                throw new Error('Invalid chart component data: "component" must be "chart".');
            }
            this.chartData = parsed as Chart;
        } catch (e: unknown) {
            console.error('UiChart: Failed to parse data attribute:', e);
            this.chartData = null;
        }
    }

    protected hasParsedData(): boolean {
        return this.chartData !== null;
    }

    protected async renderContent(): Promise<void> {
        if (!this.hasParsedData() || !this.chartData) {
            this.shadow.innerHTML = `<p style="color: red;">Invalid or missing chart data</p>`;
            this.destroyChart();
            return;
        }

        if (!this.shadow.querySelector('canvas')) {
            this.shadow.innerHTML = `<style> /* ... CSS ... */ </style><canvas></canvas>`;
            this.canvasElement = this.shadow.querySelector('canvas');
        }

        if (!this.canvasElement) return;

        const chartType = this.chartData['chart-type'];
        const renderer = chartRendererRegistry.get(chartType);

        if (!renderer) {
            this.shadow.innerHTML = `<p style="color: red;">No renderer for chart type: ${chartType}</p>`;
            this.destroyChart();
            return;
        }

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
    }

    private destroyChart(): void {
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
    }
}

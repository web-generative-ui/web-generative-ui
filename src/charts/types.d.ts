import type {Chart as SchemaChart} from '../schema.d.ts';

export interface ChartRenderOptions {
    canvas: HTMLCanvasElement;
    chartType: SchemaChart['chart-type'];
    chartData: SchemaChart['data'];
    chartOptions?: SchemaChart['options'];
    // Additional properties for rendering context, e.g., theme
}

// ChartInstance is now generic (TChartInstance) to allow adapters to specify their actual library's type
// It needs common methods expected by UiChart.
export interface GenericChartInstance {
    update(mode?: 'resize' | 'show' | 'hide' | 'none' | 'active' | string): void; // Chart.js update method
    destroy(): void;
    // Add other common properties/methods here if UiChart needs to access them generically
}

// ChartRenderer is also now generic over the specific ChartInstance type it manages
export interface ChartRenderer<TChartInstance extends GenericChartInstance = GenericChartInstance> {
    /** Transforms generic schema data/options into library-specific format. */
    transformData(chartType: SchemaChart['chart-type'], schemaData: SchemaChart['data'], schemaOptions?: SchemaChart['options']): { data: any, options: any };
    /** Initializes and renders the chart for the first time. */
    render(options: ChartRenderOptions): Promise<TChartInstance>;
    /** Updates an existing chart instance. */
    update(instance: TChartInstance, schemaData: SchemaChart['data'], schemaOptions?: SchemaChart['options']): Promise<void>;
}

import type { Chart as SchemaChart } from '../../schema'; // Alias to avoid name collision with chart.js.Chart

export interface ChartRenderOptions {
    canvas: HTMLCanvasElement;
    chartType: SchemaChart['chart-type'];
    chartData: SchemaChart['data'];
    chartOptions?: SchemaChart['options'];
    // Additional properties for rendering context, e.g., theme
}

/**
 * Defines the common interface for a chart instance managed by a ChartRenderer.
 * This ensures that UiChart can interact with any underlying chart library generically.
 */
export interface GenericChartInstance {
    /** Triggers an update/redraw of the chart. */
    update(mode?: 'resize' | 'show' | 'hide' | 'none' | 'active' | string): void; // Chart.js update method
    /** Destroys the chart instance and cleans up resources. */
    destroy(): void;
    // Add other common properties/methods here if UiChart needs to access them generically
    // For Chart.js, 'type' and 'data' are often accessed directly.
    type: string; // The Chart.js chart type (e.g., 'bar', 'line')
    data: any; // The Chart.js data object
    options: any; // The Chart.js options object
    // config: any; // Chart.js's internal configuration, less commonly accessed directly for type.
}

/**
 * Defines the contract for an adapter that renders charts for a specific charting library.
 * It handles the transformation from generic schema data to library-specific formats.
 * @template TChartInstance The specific type of the underlying chart library's instance.
 */
export interface ChartRenderer<TChartInstance extends GenericChartInstance = GenericChartInstance> {
    /**
     * Transforms generic schema data and options into the specific format required by the underlying charting library.
     * @param chartType The type of chart (e.g., 'bar').
     * @param schemaData The data object from the schema.
     * @param schemaOptions The options object from the schema.
     * @returns An object containing `data` and `options` in the library's specific format.
     */
    transformData(chartType: SchemaChart['chart-type'], schemaData: SchemaChart['data'], schemaOptions?: SchemaChart['options']): { data: ChartData<ChartType>, options: ChartOptions<ChartType> }; // Explicitly type generic ChartData/Options
    /**
     * Initializes and renders the chart for the first time on the provided canvas.
     * @param options Configuration for rendering the chart.
     * @returns A Promise that resolves with the initialized chart instance.
     */
    render(options: ChartRenderOptions): Promise<TChartInstance>;
    /**
     * Updates an existing chart instance with new data and options.
     * @param instance The existing chart instance to update.
     * @param chartData The new data object from the schema.
     * @param chartOptions The new options object from the schema.
     * @returns A Promise that resolves when the chart has been updated.
     */
    update(instance: TChartInstance, chartData: SchemaChart['data'], chartOptions?: SchemaChart['options']): Promise<void>;
}

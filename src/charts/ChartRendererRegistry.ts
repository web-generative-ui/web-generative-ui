import type { ChartRenderer, GenericChartInstance } from './types';
import type { Chart as SchemaChart } from '../schema';

/**
 * A central registry for ChartRenderer implementations.
 * It maps schema chart types (e.g., 'bar', 'line') to their corresponding rendering adapters.
 */
class ChartRendererRegistry {
    // Map is now generic over `GenericChartInstance` to accommodate different actual Chart.js instances.
    private renderers = new Map<SchemaChart['chart-type'], ChartRenderer<GenericChartInstance>>();

    /**
     * Registers a ChartRenderer for a specific chart type.
     * @param type The chart type from the schema (e.g., 'bar', 'line').
     * @param renderer The ChartRenderer instance responsible for rendering this type.
     */
    register(type: SchemaChart['chart-type'], renderer: ChartRenderer<GenericChartInstance>): void {
        if (this.renderers.has(type)) {
            console.warn(`ChartRendererRegistry: Renderer for type '${type}' is being re-registered. Overwriting.`);
        }
        this.renderers.set(type, renderer);
    }

    /**
     * Retrieves the ChartRenderer for a given chart type.
     * @param type The chart type from the schema.
     * @returns The ChartRenderer instance, or `undefined` if no renderer is registered for the type.
     */
    get(type: SchemaChart['chart-type']): ChartRenderer<GenericChartInstance> | undefined {
        return this.renderers.get(type);
    }
}
export const chartRendererRegistry = new ChartRendererRegistry();

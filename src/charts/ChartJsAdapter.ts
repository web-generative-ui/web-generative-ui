import {
    type BubbleDataPoint,
    CategoryScale,
    Chart as ChartJs,
    type ChartData,
    type ChartOptions,
    type ChartType,
    Legend,
    type LegendOptions,
    LinearScale,
    LineController,
    LineElement,
    type Point,
    PointElement,
    registerables,
    Title,
    Tooltip
} from 'chart.js';
import type {Chart as SchemaChart} from '../schema';
import type {ChartRenderer, ChartRenderOptions, GenericChartInstance} from './types';

ChartJs.register(
    LineController,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Title,
    Legend,
    Tooltip,
    ...registerables
);


type ChartJsInstance = ChartJs<ChartType, (number | Point | BubbleDataPoint | null)[], unknown> & GenericChartInstance;

export class ChartJsAdapter implements ChartRenderer<ChartJsInstance> {

    transformData(schemaChartType: SchemaChart['chart-type'], schemaData: SchemaChart['data'], schemaOptions?: SchemaChart['options']): { data: ChartData<ChartType, (number | Point | BubbleDataPoint | null)[], unknown>, options: ChartOptions<ChartType> } {

        let actualChartJsType: ChartType;
        const isAreaChart = schemaChartType === 'area';
        if (isAreaChart) {
            actualChartJsType = 'line';
        } else {
            actualChartJsType = schemaChartType as ChartType; // Use schema type directly
        }

        const transformedData: ChartData<ChartType, (number | Point | BubbleDataPoint | null)[], unknown> = {
            labels: schemaData.labels as unknown as unknown[],
            datasets: schemaData.datasets.map(ds => {
                const dataset: any = {
                    label: ds.label,
                    data: ds.data,
                };

                // If it's an area chart, ensure fill is true
                if (isAreaChart && dataset.fill === undefined) {
                    dataset.fill = true;
                }

                if (ds.style) {
                    if (ds.style.backgroundColor) dataset.backgroundColor = ds.style.backgroundColor;
                    if (ds.style.borderColor) dataset.borderColor = ds.style.borderColor;
                    if (ds.style.borderWidth) dataset.borderWidth = Number(ds.style.borderWidth);
                }
                return dataset;
            })
        };

        const baseOptions: ChartOptions<ChartType> = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    enabled: true
                }
            },
        };

        let transformedOptions: ChartOptions<ChartType> = {
            ...baseOptions,
            ...schemaOptions
        };

        // TS18048 fix: Defensive checks for plugins and legend path
        if (actualChartJsType === 'pie' || actualChartJsType === 'doughnut') { // Use actualChartJsType here
            if (!transformedOptions.plugins) {
                transformedOptions.plugins = {};
            }
            if (!transformedOptions.plugins.legend) {
                transformedOptions.plugins.legend = {};
            }
            if ((transformedOptions.plugins.legend as LegendOptions<'pie'>).position === undefined) {
                (transformedOptions.plugins.legend as LegendOptions<'pie'>).position = 'top';
            }
        }

        return { data: transformedData, options: transformedOptions };
    }

    async render(options: ChartRenderOptions): Promise<ChartJsInstance> {
        const { canvas, chartType: schemaChartType, chartData, chartOptions } = options; // Renamed chartType

        // Map schemaChartType 'area' to Chart.js 'line'
        const chartJsType = schemaChartType === 'area' ? 'line' : schemaChartType;

        const { data, options: transformedOptions } = this.transformData(schemaChartType, chartData, chartOptions); // Pass original schemaChartType to transformData for fill logic

        return new ChartJs(canvas, {
            type: chartJsType as ChartType,
            data: data,
            options: transformedOptions as ChartOptions<ChartType>
        }) as ChartJsInstance;
    }

    async update(instance: ChartJsInstance, schemaData: SchemaChart['data'], schemaOptions?: SchemaChart['options']): Promise<void> {
        const chartJsType = instance.type;

        let schemaChartTypeForTransform: SchemaChart['chart-type'];
        if (chartJsType === 'line' && instance.data?.datasets?.[0]?.fill === true) {
            schemaChartTypeForTransform = 'area';
        } else {
            schemaChartTypeForTransform = chartJsType as SchemaChart['chart-type'];
        }

        const { data, options: transformedOptions } = this.transformData(schemaChartTypeForTransform, schemaData, schemaOptions);

        instance.data = data;
        instance.options = transformedOptions;
        instance.update();
    }
}

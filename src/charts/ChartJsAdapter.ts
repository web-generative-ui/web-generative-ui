import {
    type BubbleDataPoint,
    Chart as ChartJs,
    type ChartData,
    type ChartOptions,
    type ChartType,
    type LegendOptions,
    type Point,
    registerables
} from 'chart.js';
import type {Chart as SchemaChart} from '../schema';
import type {ChartRenderer, ChartRenderOptions, GenericChartInstance} from './types.d.ts';
import {chartRendererRegistry} from "./ChartRendererRegistry.ts";

ChartJs.register(...registerables);

type ChartJsInstance = ChartJs<ChartType, (number | Point | BubbleDataPoint | null)[], unknown> & GenericChartInstance;

class ChartJsAdapter implements ChartRenderer<ChartJsInstance> {

    transformData(chartType: SchemaChart['chart-type'], schemaData: SchemaChart['data'], schemaOptions?: SchemaChart['options']): { data: ChartData<ChartType, (number | Point | BubbleDataPoint | null)[]>, options: ChartOptions } {

        const transformedData: ChartData<ChartType, (number | Point | BubbleDataPoint | null)[]> = {
            labels: schemaData.labels as unknown as unknown[],
            datasets: schemaData.datasets.map(ds => {
                const dataset: any = {
                    label: ds.label,
                    data: ds.data,
                };
                if (ds.style) {
                    if (ds.style.backgroundColor) dataset.backgroundColor = ds.style.backgroundColor;
                    if (ds.style.borderColor) dataset.borderColor = ds.style.borderColor;
                    if (ds.style.borderWidth) dataset.borderWidth = Number(ds.style.borderWidth);
                }
                return dataset;
            })
        };

        const baseOptions: ChartOptions = {
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

        const transformedOptions: ChartOptions = {
            ...baseOptions,
            ...schemaOptions
        };

        if (chartType === 'pie' || chartType === 'doughnut') {
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
        const { canvas, chartType, chartData, chartOptions } = options;
        const { data, options: transformedOptions } = this.transformData(chartType, chartData, chartOptions);

        return new ChartJs(canvas, {
            type: chartType as ChartType,
            data: data,
            options: transformedOptions as ChartOptions
        }) as ChartJsInstance;
    }

    async update(instance: ChartJsInstance, schemaData: SchemaChart['data'], schemaOptions?: SchemaChart['options']): Promise<void> {
        const chartType = instance.getContext().type as SchemaChart['chart-type'] | undefined;

        const { data, options: transformedOptions } = this.transformData(chartType as SchemaChart['chart-type'], schemaData, schemaOptions);

        instance.data = data;
        instance.options = transformedOptions;
        instance.update();
    }
}

const chartJsAdapter = new ChartJsAdapter();
chartRendererRegistry.register('bar', chartJsAdapter);
chartRendererRegistry.register('line', chartJsAdapter);
chartRendererRegistry.register('pie', chartJsAdapter);
chartRendererRegistry.register('doughnut', chartJsAdapter);
chartRendererRegistry.register('scatter', chartJsAdapter);
chartRendererRegistry.register('area', chartJsAdapter);
chartRendererRegistry.register('radar', chartJsAdapter);

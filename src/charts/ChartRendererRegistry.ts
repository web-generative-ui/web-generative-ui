import type {Chart as SchemaChart} from "../schema.d.ts";
import type {ChartRenderer} from "./types.d.ts";

class ChartRendererRegistry {
    private renderers = new Map<SchemaChart['chart-type'], ChartRenderer>();

    register(type: SchemaChart['chart-type'], renderer: ChartRenderer) {
        this.renderers.set(type, renderer);
    }

    get(type: SchemaChart['chart-type']): ChartRenderer | undefined {
        return this.renderers.get(type);
    }
}
export const chartRendererRegistry = new ChartRendererRegistry();

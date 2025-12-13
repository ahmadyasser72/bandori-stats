import {
	Chart,
	Colors,
	Filler,
	LineElement,
	PointElement,
	RadarController,
	RadialLinearScale,
	Tooltip,
} from "chart.js";

export const defineRadarChart = (
	config: ConstructorParameters<typeof Chart>[1],
) => ({
	"data-radar-chart": JSON.stringify(config),
});

export const useRadarChart = async (
	canvas: HTMLCanvasElement,
	config: ConstructorParameters<typeof Chart>[1],
) => {
	Chart.register(
		Colors,
		Filler,
		LineElement,
		PointElement,
		RadarController,
		RadialLinearScale,
		Tooltip,
	);

	if (!!config.options?.plugins?.tooltip) {
		config.options.plugins.tooltip.callbacks = {
			label: (context) => {
				// @ts-ignore trust
				return context.raw.tooltip;
			},
		};
	}

	return new Chart(canvas, config);
};

import type { Chart } from "chart.js";

export const useRadarChart = (
	config: ConstructorParameters<typeof Chart>[1],
) => ({
	"data-radar-chart": JSON.stringify(config),
});

export const registerRadarChart = async () => {
	const {
		Chart,
		Colors,
		Filler,
		LineElement,
		PointElement,
		RadarController,
		RadialLinearScale,
		Tooltip,
	} = await import("chart.js");

	Chart.register(
		Colors,
		Filler,
		LineElement,
		PointElement,
		RadarController,
		RadialLinearScale,
		Tooltip,
	);

	return Chart;
};

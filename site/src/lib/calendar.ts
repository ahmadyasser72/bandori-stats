import {
	Calendar,
	type DateAny,
	type FormatDateString,
	type Options,
} from "vanilla-calendar-pro";

export interface CalendarData<T = unknown, P = {}> {
	date: string;
	selected?: string;
	oldest?: string;
	latest?: string;

	url: string;
	params: P;
	items: Record<FormatDateString, T>;
}

type CalendarDataItem<T> = T extends CalendarData<infer U> ? U : never;
type CalendarDataParams<T> =
	T extends CalendarData<unknown, infer U> ? U : never;

export interface CalendarRouteConfig<T = unknown, P = {}> {
	selector: string;

	/** Called when the user clicks a date */
	onClickDate?: (params: {
		calendar: HTMLElement;
		date: FormatDateString | undefined;
		data: CalendarData<T, P>;
	}) => void;

	/**
	 * Render custom content into a date cell's button.
	 * Called for every cell — return early if no content for that date.
	 */
	renderDateCell?: (params: {
		calendar: HTMLElement;
		it: T;
		button: HTMLButtonElement;
	}) => void;

	/** Generate popup HTML for dates that have data */
	popups?: (params: { calendar: HTMLElement; it: T }) => string;
}

export const initCalendar = <T extends CalendarData>(
	config: CalendarRouteConfig<CalendarDataItem<T>, CalendarDataParams<T>>,
) => {
	const init = (element?: unknown) => {
		if (!(element instanceof HTMLElement) || !element.matches(config.selector))
			return;

		element.classList.remove("skeleton");
		const data = JSON.parse(element.dataset.calendar!) as CalendarData<
			CalendarDataItem<T>,
			CalendarDataParams<T>
		>;
		const selected = (() => {
			const date = new Date(data.date);
			return { month: date.getMonth(), year: date.getFullYear() };
		})();

		const handleMonthChange = (self: Calendar) => {
			const { selectedMonth: month, selectedYear: year } = self.context;
			if (month === selected.month && year === selected.year) return;

			window.htmx.ajax("get", data.url, {
				source: element,
				target: element,
				swap: "outerHTML",
				values: {
					...data.params,
					date: `${year}-${String(month + 1).padStart(2, "0")}-01`,
					...(data.selected && { selected: data.selected }),
				},
			});
		};

		new Calendar(element, {
			disableToday: true,
			dateMin: data.oldest as DateAny,
			dateMax: data.latest as DateAny,
			displayDisabledDates: true,
			disableAllDates: true,
			enableDates: Object.keys(data.items),

			onClickDate: (self) => {
				const [date] = self.context.selectedDates;
				config.onClickDate?.({ calendar: element, date, data });
				data.selected = date;
			},

			selectedDates: data.selected ? [data.selected] : undefined,
			selectedMonth: selected.month as Options["selectedMonth"],
			selectedYear: selected.year,
			onClickArrow: handleMonthChange,
			onClickMonth: handleMonthChange,
			onClickYear: handleMonthChange,

			onCreateDateEls: config.renderDateCell
				? (_, dateElement) => {
						const date = dateElement.dataset.vcDate as FormatDateString;
						const it = data.items[date];
						if (!it || (Array.isArray(it) && it.length === 0)) return;

						const button = dateElement.querySelector(
							"[data-vc-date-btn]",
						) as HTMLButtonElement;
						button.classList.add("flex-col");
						const day = button.innerText;
						button.innerHTML = "";
						button.innerHTML += `<span>${day}</span>`;

						config.renderDateCell!({ calendar: element, it, button });
					}
				: undefined,

			popups: config.popups
				? Object.fromEntries(
						Object.entries(data.items).map(([date, it]) => [
							date,
							{ html: config.popups!({ calendar: element, it }) },
						]),
					)
				: undefined,
		}).init();
	};

	init(document.querySelector<HTMLElement>(config.selector));
	window.htmx.onLoad((node) => init(node));
};

export const dismissCalendarPopover = (
	calendar: HTMLElement,
	placeholder: string,
	date?: string,
) => {
	const popover = calendar.closest("[popover]");
	if (!(popover instanceof HTMLElement) || !popover.id) return;
	popover.hidePopover();

	const triggerLabel = document
		.querySelector(`[popovertarget="${popover.id}"]`)
		?.querySelector("span");
	if (triggerLabel) triggerLabel.innerText = date ?? placeholder;
};

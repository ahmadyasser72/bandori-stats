import { useEffect, useRef, useState } from "preact/hooks";
import { Calendar } from "vanilla-calendar-pro";

interface DurationCalendarProps {
	url: URL;
	dateMin: Date;
	dateMax: Date;
}

export const DurationCalendar = ({
	url,
	dateMin,
	dateMax,
}: DurationCalendarProps) => {
	const ref = useRef<HTMLDivElement>(null);
	const [calendar, setCalendar] = useState<Calendar | null>(null);

	useEffect(() => {
		if (!ref.current) return;
		setCalendar(
			new Calendar(ref.current, {
				dateMin,
				dateMax,
				selectionDatesMode: "multiple-ranged",
				onClickDate: async ({ context }) => {
					if (context.selectedDates.length < 2) return;

					const [from, to] = context.selectedDates;
					const search = new URLSearchParams(url.searchParams);
					search.set("duration", `${from}:${to}`);

					await window.htmx.ajax("get", `${url.pathname}?${search}`, {
						source: ref.current?.parentElement!,
						target: "main",
						swap: "after",
					});
					(ref.current!.closest("[popover]") as HTMLElement).hidePopover();
				},
			}),
		);
	}, [ref]);

	useEffect(() => {
		if (!calendar) return;
		calendar.init();
	}, [calendar]);

	return <div class="vc" ref={ref}></div>;
};

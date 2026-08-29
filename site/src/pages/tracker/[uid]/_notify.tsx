import { actions } from "astro:actions";
import { VAPID_PUBLIC_KEY } from "astro:env/client";

import { useRef, useState } from "preact/hooks";

import { stripBB } from "@bandori-stats/bestdori/helpers";
import type { TrackerSnapshot } from "@bandori-stats/database/schema";

interface NotifyWhenContainerProps {
	snapshot: Pick<
		TrackerSnapshot,
		"uid" | "name" | "trackingFor" | "trackingId" | "point" | "rank"
	>;
}

export const NotifyWhenContainer = (props: NotifyWhenContainerProps) => (
	<div class="mt-4">
		<NotifyWhenPlayAgain {...props} />
		<NotifyWhenPointAbove {...props} />
		<NotifyWhenBoated {...props} />
	</div>
);

const NotifyWhenPlayAgain = ({ snapshot }: NotifyWhenContainerProps) => {
	const inputRef = useRef<HTMLInputElement>(null);

	return (
		<NotifyWhen
			inputRef={inputRef}
			label="Plays again"
			on="play-again"
			snapshot={snapshot}
		>
			{(setValue) => (
				<input
					class="btn join-item flex-1 overflow-clip text-xs break-all not-checked:btn-outline"
					type="checkbox"
					aria-label={stripBB(snapshot.name)}
					onInput={(event) => setValue(event.currentTarget.checked ? 1 : 0)}
					ref={inputRef}
					required
				/>
			)}
		</NotifyWhen>
	);
};

const NotifyWhenPointAbove = ({ snapshot }: NotifyWhenContainerProps) => {
	const inputRef = useRef<HTMLInputElement>(null);

	return (
		<NotifyWhen
			inputRef={inputRef}
			label="Points go above"
			on="point"
			snapshot={snapshot}
		>
			{(setValue) => (
				<input
					class="input join-item"
					type="number"
					min={snapshot.point}
					onInput={(event) => setValue(Number(event.currentTarget.value))}
					placeholder={snapshot.point.toLocaleString()}
					ref={inputRef}
					required
				/>
			)}
		</NotifyWhen>
	);
};

const NotifyWhenBoated = ({ snapshot }: NotifyWhenContainerProps) => {
	const inputRef = useRef<HTMLSelectElement>(null);

	return (
		<NotifyWhen
			inputRef={inputRef}
			label="Is boated from"
			on="boated-from"
			snapshot={snapshot}
		>
			{(setValue) => (
				<select
					class="select join-item"
					onChange={(event) => setValue(Number(event.currentTarget.value))}
					ref={inputRef}
					required
				>
					{Array.from(
						{ length: 10 - snapshot.rank + 1 },
						(_, idx) => snapshot.rank + idx,
					).map((rank) => (
						<option value={rank} key={rank} selected={rank === snapshot.rank}>
							{rank === snapshot.rank
								? `Rank #${rank} (current)`
								: `Rank #${rank}`}
						</option>
					))}
				</select>
			)}
		</NotifyWhen>
	);
};

interface NotifyWhenProps extends NotifyWhenContainerProps {
	on: "play-again" | "point" | "boated-from";
	label: string;
	inputRef: preact.RefObject<HTMLInputElement | HTMLSelectElement>;
	children: (setValue: (value: number) => void) => preact.ComponentChildren;
}

const NotifyWhen = ({
	snapshot,
	label,
	on,
	inputRef,
	children,
}: NotifyWhenProps) => {
	const [errorText, setErrorText] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [subscribed, setSubscribed] = useState(false);
	const [value, setValue] = useState<number | "">(
		on === "boated-from" ? snapshot.rank : "",
	);

	const subscribe = async () => {
		if (subscribed) return;

		const input = inputRef.current;
		if (input && !input.checkValidity()) {
			input.reportValidity();
			return;
		} else if (!value) return;

		setErrorText("");
		setSubmitting(true);
		try {
			const subscription = await getSubscription();
			const { error } = await actions.tracker.notifyMe({
				subscription: subscription as never,
				target: snapshot,
				on: { target: on, value },
			});

			if (error) {
				setErrorText(error.message);
				return;
			}

			setSubscribed(true);
			if (import.meta.env.PROD) {
				umami.track("tracker-notify-subscribe", {
					kind: snapshot.trackingFor,
					player: stripBB(snapshot.name),
					on,
					value,
				});
			}
		} catch (error) {
			if (error instanceof Error) setErrorText(error.message);
			throw error;
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<fieldset class="fieldset w-xs">
			<legend class="fieldset-legend">{label}</legend>

			<div class="join w-full">
				{children(setValue)}

				<button
					class="btn join-item btn-secondary"
					disabled={submitting}
					onClick={subscribe}
				>
					{submitting
						? "Submitting..."
						: subscribed
							? "Subscribed!"
							: "Subscribe"}
				</button>
			</div>

			<p class="label text-error">{errorText}</p>
		</fieldset>
	);
};

const getSubscription = async () => {
	navigator.serviceWorker.register("/sw.js");
	return navigator.serviceWorker.ready.then((registration) =>
		registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: VAPID_PUBLIC_KEY,
		}),
	);
};

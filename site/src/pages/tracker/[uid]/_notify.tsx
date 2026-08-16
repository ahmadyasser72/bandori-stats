import { actions } from "astro:actions";
import { VAPID_PUBLIC_KEY } from "astro:env/client";

import { useState } from "preact/hooks";

import type { TrackerSnapshot } from "@bandori-stats/database/schema";

interface NotifyWhenFormProps {
	snapshot: Pick<
		TrackerSnapshot,
		"uid" | "trackingFor" | "trackingId" | "point"
	>;
}

export const NotifyWhenForm = (props: NotifyWhenFormProps) => (
	<>
		<NotifyWhenPointAbove {...props} />
	</>
);

const NotifyWhenPointAbove = ({ snapshot }: NotifyWhenFormProps) => {
	const [errorText, setErrorText] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [subscribed, setSubscribed] = useState(false);
	const [pointAbove, setPointAbove] = useState(0);
	const subscribe = async (event: Event) => {
		if (subscribed) return;

		const input = (event.target as HTMLButtonElement)
			.previousElementSibling as HTMLInputElement;
		if (!input.checkValidity()) return input.reportValidity();
		setErrorText("");

		setSubmitting(true);
		try {
			const subscription = await getSubscription();
			const { error } = await actions.trackerNotify({
				subscription: subscription as never,
				target: snapshot,
				when: { point: pointAbove },
			});

			if (error) setErrorText(error.message);
			else setSubscribed(true);
		} catch (error) {
			if (error instanceof Error) setErrorText(error.message);
			throw error;
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Points goes above</legend>
			<div class="join">
				<input
					class="input join-item"
					type="number"
					min={snapshot.point}
					onInput={(event) => setPointAbove(Number(event.currentTarget.value))}
					placeholder={snapshot.point.toLocaleString()}
					required
				/>
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

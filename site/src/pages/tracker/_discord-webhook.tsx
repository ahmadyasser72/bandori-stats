import { actions } from "astro:actions";
import { DISCORD_INVITE_LINK } from "astro:env/client";

import { useRef, useState } from "preact/hooks";

import type { GbpMetadata } from "@bandori-stats/database/schema";

interface DiscordWebhookProps {
	target: Pick<GbpMetadata, "kind" | "id">;
}

export const DiscordWebhook = ({ target }: DiscordWebhookProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [errorText, setErrorText] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [subscribed, setSubscribed] = useState(false);
	const [value, setValue] = useState("");

	const subscribe = async () => {
		if (subscribed) return;

		const input = inputRef.current;
		if (input && !input.checkValidity()) {
			input.reportValidity();
			return;
		} else if (!value) return;

		const url = new URL(value);
		if (!url.host.match(/discord(?:app)?\.com$/)) {
			setErrorText("Webhook URL must be from Discord!");
			return;
		} else if (
			!url.pathname.match(/^\/api\/webhooks\/(\d+)\/([a-zA-Z0-9_-]+)$/)
		) {
			setErrorText("Webhook URL is invalid!");
			return;
		}

		setErrorText("");
		setSubmitting(true);
		try {
			const payload = { target, url: value };
			const { error } = await actions.tracker.discordWebhook(payload);

			if (error) {
				setErrorText(error.message);
				return;
			}

			setSubscribed(true);
			if (import.meta.env.PROD) {
				umami.track("tracker-subscribe-discord-webhook", { kind: target.kind });
			}
		} catch (error) {
			if (error instanceof Error) setErrorText(error.message);
			throw error;
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<fieldset class="fieldset w-full sm:w-md">
			<legend class="fieldset-legend">Subscribe to hourly/daily tracker</legend>

			<p>
				Join the{" "}
				<a class="link" href={DISCORD_INVITE_LINK} target="_blank">
					Discord server
				</a>{" "}
				to see an example.
			</p>
			<div class="join mt-2 w-full">
				<label class="floating-label join-item w-full">
					<input
						class="input"
						type="url"
						onInput={(event) => setValue(event.currentTarget.value)}
						placeholder="https://discord.com/api/webhooks..."
						ref={inputRef}
						required
					/>
					<span>Discord Webhook URL</span>
				</label>

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

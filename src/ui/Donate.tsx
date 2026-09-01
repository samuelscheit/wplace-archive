import { AnchorHTMLAttributes } from "react";

function DonateButton({ button, type, method, ...props }: AnchorHTMLAttributes<any> & { method?: string; button?: boolean }) {
	const Component = button ? "button" : "a";

	return (
		<Component
			target="_blank"
			{...props}
			rel="noreferrer"
			onClick={(e) => {
				// @ts-ignore
				globalThis?.plausible?.("donate_button", {
					props: {
						method: method,
					},
				});

				props.onClick?.(e);
			}}
			className={
				"inline-flex items-center justify-center gap-2 self-start rounded px-3 py-1.5 text-sm font-medium text-neutral-50 shadow cursor-pointer " +
				props.className
			}
		/>
	);
}

export function ExternalLink(props: AnchorHTMLAttributes<any>) {
	return <a {...props} target="_blank" rel="noreferrer" className={"text-cyan-800 font-medium " + props.className} />;
}

export function Donate({
	closeDonate,
	openBankTransfer,
	openCrypto,
	openWeChat,
}: {
	closeDonate: () => void;
	openBankTransfer: () => void;
	openCrypto: () => void;
	openWeChat: () => void;
}) {
	return (
		<div
			className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center backdrop-blur-sm"
			role="presentation"
			onClick={closeDonate}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="donation-modal-title"
				className="bg-white/95 text-neutral-900 max-w-lg w-[92%] rounded-lg shadow-xl p-6 space-y-3 max-h-[90vh] overflow-y-auto"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 id="donation-modal-title" className="text-lg font-semibold">
							Choose how you’d like to support
						</h2>
						<p className="text-sm text-neutral-600">
							Every contribution helps to keep the archive online and lets me create snapshots more often.
						</p>
					</div>
					<button
						type="button"
						onClick={closeDonate}
						className="text-neutral-500 hover:text-neutral-700 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
						aria-label="Close donation dialog"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" className="size-4" aria-hidden="true">
							<path
								fill="currentColor"
								d="M310.6 361.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L160 301.3 54.6 406.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L114.7 256 9.4 150.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 210.7l105.4-105.4c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L205.3 256l105.3 105.4z"
							/>
						</svg>
					</button>
				</div>

				<div className="flex flex-row gap-2 text-white flex-wrap items-stretch">
					<DonateButton href="https://www.paypal.me/samuelscheit" style={{ backgroundColor: "#0070e0" }} method="paypal">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-4">
							<path
								fill="currentColor"
								d="M111.9 295.9c-3.5 19.2-17.4 108.7-21.5 134-.3 1.8-1 2.5-3 2.5l-74.6 0c-7.6 0-13.1-6.6-12.1-13.9L59.3 46.6c1.5-9.6 10.1-16.9 20-16.9 152.3 0 165.1-3.7 204 11.4 60.1 23.3 65.6 79.5 44 140.3-21.5 62.6-72.5 89.5-140.1 90.3-43.4 .7-69.5-7-75.3 24.2zM357.6 152c-1.8-1.3-2.5-1.8-3 1.3-2 11.4-5.1 22.5-8.8 33.6-39.9 113.8-150.5 103.9-204.5 103.9-6.1 0-10.1 3.3-10.9 9.4-22.6 140.4-27.1 169.7-27.1 169.7-1 7.1 3.5 12.9 10.6 12.9l63.5 0c8.6 0 15.7-6.3 17.4-14.9 .7-5.4-1.1 6.1 14.4-91.3 4.6-22 14.3-19.7 29.3-19.7 71 0 126.4-28.8 142.9-112.3 6.5-34.8 4.6-71.4-23.8-92.6z"
							/>
						</svg>
						PayPal
					</DonateButton>
					<DonateButton href="https://buymeacoffee.com/samuelscheit" style={{ backgroundColor: "#52a447" }} method="buymeacoffee">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-4">
							<path
								fill="white"
								d="M0 128l0 32 512 0 0-32c0-35.3-28.7-64-64-64L64 64C28.7 64 0 92.7 0 128zm0 80L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-176-512 0zM64 360c0-13.3 10.7-24 24-24l48 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-48 0c-13.3 0-24-10.7-24-24zm144 0c0-13.3 10.7-24 24-24l64 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-64 0c-13.3 0-24-10.7-24-24z"
							/>
						</svg>
						Credit Card
					</DonateButton>
					<DonateButton href="https://www.patreon.com/samuelscheit" style={{ backgroundColor: "#F96854" }} method="patreon">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-4">
							<path
								fill="currentColor"
								d="M490 153.8c-.1-65.4-51-119-110.7-138.3-74.2-24-172-20.5-242.9 12.9-85.8 40.5-112.8 129.3-113.8 217.8-.8 72.8 6.4 264.4 114.6 265.8 80.3 1 92.3-102.5 129.5-152.3 26.4-35.5 60.5-45.5 102.4-55.9 72-17.8 121.1-74.7 121-150l-.1 0z"
							/>
						</svg>
						Patreon
					</DonateButton>
					<DonateButton href="https://github.com/sponsors/samuelscheit" style={{ backgroundColor: "#000" }} method="github">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-4">
							<path
								fill="currentColor"
								d="M173.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3 .3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5 .3-6.2 2.3zm44.2-1.7c-2.9 .7-4.9 2.6-4.6 4.9 .3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM252.8 8c-138.7 0-244.8 105.3-244.8 244 0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1 100-33.2 167.8-128.1 167.8-239 0-138.7-112.5-244-251.2-244zM105.2 352.9c-1.3 1-1 3.3 .7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3 .3 2.9 2.3 3.9 1.6 1 3.6 .7 4.3-.7 .7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3 .7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3 .7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9s4.3 3.3 5.6 2.3c1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"
							/>
						</svg>
						GitHub
					</DonateButton>
					<DonateButton
						href="weixin://f2f0rDQ70Abyvo1lrYLWspwEaazwrU6NgzFdu6uCGfuGJsc"
						style={{ backgroundColor: "#0e9dec" }}
						method="wechat"
						onClick={openWeChat}
						aria-haspopup="dialog"
						aria-controls="wechat-modal" // @ts-ignore
						target="_self"
					>
						<svg width="800px" height="800px" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" className="size-4">
							<g fill="currentColor">
								<path d="M200.803 111.88c-24.213 1.265-45.268 8.605-62.362 25.188-17.271 16.754-25.155 37.284-23 62.734-9.464-1.172-18.084-2.462-26.753-3.192-2.994-.252-6.547.106-9.083 1.537-8.418 4.75-16.488 10.113-26.053 16.092 1.755-7.938 2.891-14.889 4.902-21.575 1.479-4.914.794-7.649-3.733-10.849-29.066-20.521-41.318-51.232-32.149-82.85 8.483-29.25 29.315-46.989 57.621-56.236 38.635-12.62 82.054.253 105.547 30.927 8.485 11.08 13.688 23.516 15.063 38.224zm-111.437-9.852c.223-5.783-4.788-10.993-10.74-11.167-6.094-.179-11.106 4.478-11.284 10.483-.18 6.086 4.475 10.963 10.613 11.119 6.085.154 11.186-4.509 11.411-10.435zm58.141-11.171c-5.974.11-11.022 5.198-10.916 11.004.109 6.018 5.061 10.726 11.204 10.652 6.159-.074 10.83-4.832 10.772-10.977-.051-6.032-4.981-10.79-11.06-10.679z" />

								<path d="M255.201 262.83c-7.667-3.414-14.7-8.536-22.188-9.318-7.459-.779-15.3 3.524-23.104 4.322-23.771 2.432-45.067-4.193-62.627-20.432-33.397-30.89-28.625-78.254 10.014-103.568 34.341-22.498 84.704-14.998 108.916 16.219 21.129 27.24 18.646 63.4-7.148 86.284-7.464 6.623-10.15 12.073-5.361 20.804.884 1.612.985 3.653 1.498 5.689zm-87.274-84.499c4.881.005 8.9-3.815 9.085-8.636.195-5.104-3.91-9.385-9.021-9.406-5.06-.023-9.299 4.318-9.123 9.346.166 4.804 4.213 8.69 9.059 8.696zm56.261-18.022c-4.736-.033-8.76 3.844-8.953 8.629-.205 5.117 3.772 9.319 8.836 9.332 4.898.016 8.768-3.688 8.946-8.562.19-5.129-3.789-9.364-8.829-9.399z" />
							</g>
						</svg>
						WeChat
					</DonateButton>
					<DonateButton
						method="bank_transfer"
						type="button"
						onClick={openBankTransfer}
						button
						style={{ backgroundColor: "#8247e5" }}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-4">
							<path
								fill="currentColor"
								d="M271.9 20.2c-9.8-5.6-21.9-5.6-31.8 0l-224 128c-12.6 7.2-18.8 22-15.1 36S17.5 208 32 208l32 0 0 208 0 0-51.2 38.4C4.7 460.4 0 469.9 0 480 0 497.7 14.3 512 32 512l448 0c17.7 0 32-14.3 32-32 0-10.1-4.7-19.6-12.8-25.6l-51.2-38.4 0-208 32 0c14.5 0 27.2-9.8 30.9-23.8s-2.5-28.8-15.1-36l-224-128zM400 208l0 208-64 0 0-208 64 0zm-112 0l0 208-64 0 0-208 64 0zm-112 0l0 208-64 0 0-208 64 0zM256 96a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"
							/>
						</svg>
						Bank transfer
					</DonateButton>
					<DonateButton method="crypto" onClick={openCrypto} button style={{ backgroundColor: "#f7931a" }}>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-4">
							<path
								fill="currentColor"
								d="M8 256a248 248 0 1 1 496 0 248 248 0 1 1 -496 0zm354.3-35.3c4.9-33-20.2-50.7-54.6-62.6l11.1-44.7-27.2-6.8-10.9 43.5c-7.2-1.8-14.5-3.5-21.8-5.1l10.9-43.8-27.2-6.8-11.2 44.7c-5.9-1.3-11.7-2.7-17.4-4.1l0-.1-37.5-9.4-7.2 29.1s20.2 4.6 19.8 4.9c11 2.8 13 10 12.7 15.8l-12.7 50.9c.8 .2 1.7 .5 2.8 .9-.9-.2-1.9-.5-2.9-.7l-17.8 71.3c-1.3 3.3-4.8 8.4-12.5 6.5 .3 .4-19.8-4.9-19.8-4.9l-13.5 31.1 35.4 8.8c6.6 1.7 13 3.4 19.4 5l-11.3 45.2 27.2 6.8 11.2-44.7c7.2 2 14.4 3.8 21.7 5.6l-11.1 44.5 27.2 6.8 11.3-45.1c46.4 8.8 81.3 5.2 96-36.7 11.8-33.8-.6-53.3-25-66 17.8-4.1 31.2-15.8 34.7-39.9zm-62.2 87.2c-8.4 33.8-65.3 15.5-83.8 10.9l14.9-59.9c18.4 4.6 77.6 13.7 68.8 49zm8.4-87.7c-7.7 30.7-55 15.1-70.4 11.3l13.5-54.3c15.4 3.8 64.8 11 56.8 43z"
							/>
						</svg>
						Crypto
					</DonateButton>
				</div>

				<div className="text-sm text-neutral-500 pt-2">
					You can also write me an email at{" "}
					<ExternalLink href="mailto:wplace@samuelscheit.com">wplace@samuelscheit.com</ExternalLink> <br />
					or a message @samuelscheit on <ExternalLink href="https://discord.com/users/311129357362135041">
						Discord
					</ExternalLink>, <ExternalLink href="https://x.com/SamuelScheit">Twitter</ExternalLink>,{" "}
					<ExternalLink href="https://t.me/samuelscheit">Telegram</ExternalLink>,{" "}
					<ExternalLink href="https://www.linkedin.com/in/samuelscheit/">Linkedin</ExternalLink>
				</div>
			</div>
		</div>
	);
}

export function WeChat({ closeWeChat }: { closeWeChat: () => void }) {
	return (
		<div
			className="absolute inset-0 z-40 bg-black/50 flex items-center justify-center backdrop-blur-sm p-4"
			role="presentation"
			onClick={closeWeChat}
		>
			<div
				id="wechat-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="wechat-modal-title"
				className="bg-white/95 text-neutral-900 max-w-lg w-[92%] rounded-lg shadow-xl p-6 space-y-3 max-h-[90vh] overflow-y-auto"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 id="wechat-modal-title" className="text-lg font-semibold">
							WeChat donation
						</h2>
						<p className="text-sm text-neutral-600">Scan the QR code in WeChat to make a donation.</p>
					</div>
					<button
						type="button"
						onClick={closeWeChat}
						className="text-neutral-500 hover:text-neutral-700 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
						aria-label="Close WeChat dialog"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" className="size-4" aria-hidden="true">
							<path
								fill="currentColor"
								d="M310.6 361.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L160 301.3 54.6 406.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L114.7 256 9.4 150.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 210.7l105.4-105.4c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L205.3 256l105.3 105.4z"
							/>
						</svg>
					</button>
				</div>

				<img
					src="/wechat.webp"
					alt="WeChat donation QR code"
					className="block mx-auto max-h-[70vh] max-w-full w-auto rounded border border-neutral-200 object-contain"
				/>
			</div>
		</div>
	);
}

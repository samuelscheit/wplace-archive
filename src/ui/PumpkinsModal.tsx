import { useCallback, useEffect, useMemo, useRef, useState } from "react";


export function PumpkinsModal({ onClose, openAbout }: { onClose: () => void; openAbout: () => void }) {

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onClose();
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	return (
		<div
			className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center backdrop-blur-sm"
			role="presentation"
			onClick={onClose}
		>
			<div
				role="dialog"
				id="pumpkins-modal"
				aria-modal="true"
				aria-labelledby="pumpkins-modal-title"
				className="bg-white/95 text-neutral-900 max-w-xl w-[92%] rounded-lg shadow-xl p-6 space-y-4 max-h-[100vh] overflow-hidden overflow-y-auto"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 id="pumpkins-modal-title" className="text-lg font-semibold">
							Pumpkins 🎃
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-neutral-500 hover:text-neutral-700 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-neutral-400 cursor-pointer"
						aria-label="Close pumpkins dialog"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" className="size-4" aria-hidden="true">
							<path
								fill="currentColor"
								d="M310.6 361.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L160 301.3 54.6 406.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L114.7 256 9.4 150.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 210.7l105.4-105.4c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L205.3 256l105.3 105.4z"
							/>
						</svg>
					</button>
				</div>

				<div className="text-sm text-neutral-600">
					Thank you so much for all your kind messages and support! I'm glad I could help you all with finding the pumpkins.
					<br />
					<br />
					A huge thank you goes to all the wonderful donors who supported the project. Thanks to you the server was able to keep
					up with the crowds and handled over 112M+ requests, 104k+ visitors and served 11TB+ of data.
					<br />
					<br />
					Special thanks go to{" "}
					<a className="notranslate text-blue-900" href="https://zapto.zip/">
						zapto
					</a>{" "}
					for the discord integration,
					<br />
					to{" "}
					<a className="notranslate text-blue-900" href="https://github.com/ntanthedev">
						Đào Nhật Tân
					</a>{" "}
					who added the display for already visited pumpkins,
					<br />
					and to{" "}
					<a className="notranslate text-blue-900" href="https://xnacly.me/">
						xnacly
					</a>{" "}
					for improving the performance of the pumpking search by more than 2x to 1100 tiles per second.
					<br />
					<br />
					If you like the project and want to support it further, you can help fund the server costs by donating, sponsoring storage space, or contributing on GitHub.
					<div className="flex justify-center items-center mt-4">
					<button
						type="button"
						onClick={()=>{
							onClose()
							openAbout()
						}}
						className="inline-flex items-center gap-2 rounded bg-blue-500/70 px-4 py-2 text-sm font-semibold text-neutral-100 shadow-md backdrop-blur hover:bg-blue-600/70 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-4" aria-hidden="true">
							<path
								fill="white"
								d="M241 87.1l15 20.7 15-20.7C296 52.5 336.2 32 378.9 32 452.4 32 512 91.6 512 165.1l0 2.6c0 112.2-139.9 242.5-212.9 298.2-12.4 9.4-27.6 14.1-43.1 14.1s-30.8-4.6-43.1-14.1C139.9 410.2 0 279.9 0 167.7l0-2.6C0 91.6 59.6 32 133.1 32 175.8 32 216 52.5 241 87.1z"
							/>
						</svg>
						About Wplace Archive
					</button>
					</div>
				</div>
			</div>
		</div>
	);
}

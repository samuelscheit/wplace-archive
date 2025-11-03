import { Map } from "maplibre-gl";
import { ExternalLink } from "./Donate";

export function About({
	closeAbout,
	openDonate,
	mapRef,
}: {
	closeAbout: () => void;
	openDonate: () => void;
	openBankTransfer: () => void;
	mapRef: React.MutableRefObject<Map | null>;
}) {
	return (
		<div
			className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center backdrop-blur-sm"
			role="presentation"
			onClick={closeAbout}
		>
			<div
				id="about-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="about-modal-title"
				className="bg-white/95 text-neutral-900 max-w-md w-[90%] rounded-lg shadow-xl p-6 space-y-4 max-h-screen overflow-y-auto"
				onClick={(event) => event.stopPropagation()}
			>
				<div id="google_translate_element" className="absolute top-0 left-0 right-0 z-10 bg-white hidden"></div>
				<div className="flex items-start justify-between gap-4">
					<h2 id="about-modal-title" className="text-lg font-semibold">
						About Wplace archive
					</h2>
					<button
						type="button"
						onClick={closeAbout}
						className="text-neutral-500 hover:text-neutral-700 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-neutral-400 cursor-pointer"
						aria-label="Close about dialog"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" className="size-4" aria-hidden="true">
							<path
								fill="currentColor"
								d="M310.6 361.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L160 301.3 54.6 406.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L114.7 256 9.4 150.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 210.7l105.4-105.4c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3L205.3 256l105.3 105.4z"
							/>
						</svg>
					</button>
				</div>
				<div className="space-y-4">
					<img
						src="/samuelscheit.jpg"
						alt="Picture of Samuel Scheit"
						className="size-24 rounded-full mx-auto float-right mb-1 ml-1"
					/>
					<p>Hi I'm Samuel 👋</p>
					<p>
						I created the wplace archive to <span className="bold">preserve</span> the entire wplace map{" "}
						<span className="bold">history</span> <span className="bold">without zoom limits</span>.
					</p>

					<div>
						Behind the scenes every snapshot takes <span className="bold"> 12 hours </span> to render and needs{" "}
						<span className="bold">~24 GB</span>. I host this on a <span className="bold">$24/month server</span> with{" "}
						<span className="bold">500 GB disk space</span> (<span className="bold">84% used</span>). Special thanks to Hayden
						who helps out with additional storage space.
					</div>

					<div>
						I'm currently paying <span className="codeblock">$24</span> a month to keep this project online with the help of{" "}
						<span className="codeblock">22</span> donaters.
					</div>

					<div>
						If you like the archive and would like to help to keep it online, please consider donating. It would help me a lot
						to cover the costs. Thank you very much :)
					</div>

					<div>
						Also <span className="bold">huge thanks</span> to the <span className="bold">supporters</span> (
						<span className="bg-gray-500/10 ">
							Nicolas R., Anton B., Paweł A., Liliana B., Soli, Kilen N., Alidoof, Dhu S., Alex N., Noam B.,
							WatermelonEnjoyer, Marjon S., Christian K., TheQueenOfNowhere, Skycloud, Brian R., Lu z., Yehkai C.,
							Technocratic, ahaxd, Harper N.,
						</span>
						) who make preserving wplace possible and thank you to{" "}
						<a
							href="https://github.com/murolem/wplace-archives/"
							target="_blank"
							rel="noreferrer"
							className="text-cyan-800 italic bold"
						>
							Vladislav Suchkov
						</a>{" "}
						who backups the entire world map every three hours.
					</div>

					<div className="flex justify-center pt-2 flex-row gap-2">
						<button
							type="button"
							onClick={openDonate}
							className="inline-flex items-center gap-2 rounded bg-red-500/70 px-4 py-2 text-sm font-semibold text-neutral-100 shadow-md backdrop-blur hover:bg-red-600/70 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
						>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-4" aria-hidden="true">
								<path
									fill="white"
									d="M241 87.1l15 20.7 15-20.7C296 52.5 336.2 32 378.9 32 452.4 32 512 91.6 512 165.1l0 2.6c0 112.2-139.9 242.5-212.9 298.2-12.4 9.4-27.6 14.1-43.1 14.1s-30.8-4.6-43.1-14.1C139.9 410.2 0 279.9 0 167.7l0-2.6C0 91.6 59.6 32 133.1 32 175.8 32 216 52.5 241 87.1z"
								/>
							</svg>
							Donate
						</button>
						{globalThis?.navigator?.share && (
							<button
								onClick={() => {
									if (!globalThis.navigator.share) return;
									const m = mapRef.current;
									if (!m) return;

									globalThis.navigator
										.share({
											url: window.location.href,
										})
										.catch((error) => {
											console.error("Error sharing", error);
										});
								}}
								className="inline-flex items-center gap-2 rounded bg-blue-600/70 px-4 py-2 text-sm font-semibold text-neutral-100 shadow-md backdrop-blur hover:bg-blue-700/70 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
							>
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-4" aria-hidden="true">
									<path
										fill="white"
										d="M307.8 18.4c-12 5-19.8 16.6-19.8 29.6l0 80-112 0c-97.2 0-176 78.8-176 176 0 113.3 81.5 163.9 100.2 174.1 2.5 1.4 5.3 1.9 8.1 1.9 10.9 0 19.7-8.9 19.7-19.7 0-7.5-4.3-14.4-9.8-19.5-9.4-8.8-22.2-26.4-22.2-56.7 0-53 43-96 96-96l96 0 0 80c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l160-160c12.5-12.5 12.5-32.8 0-45.3l-160-160c-9.2-9.2-22.9-11.9-34.9-6.9z"
									/>
								</svg>
								Share
							</button>
						)}
					</div>

					<div className="text-center text-xs text-neutral-500 flex flex-col gap-2">
						<span>
							Made with ❤️ by{" "}
							<a href="https://samuelscheit.com" target="_blank" rel="noreferrer" className="text-cyan-800 italic bold">
								Samuel Scheit
							</a>
						</span>
						<div className=" text-neutral-500">
							You can also write me an email at{" "}
							<ExternalLink href="mailto:wplace@samuelscheit.com">wplace@samuelscheit.com</ExternalLink> <br />
							or a message @samuelscheit on{" "}
							<ExternalLink href="https://discord.com/users/311129357362135041">Discord</ExternalLink>,{" "}
							<ExternalLink href="https://x.com/SamuelScheit">Twitter</ExternalLink>,{" "}
							<ExternalLink href="https://t.me/samuelscheit">Telegram</ExternalLink>,{" "}
							<ExternalLink href="https://www.linkedin.com/in/samuelscheit/">Linkedin</ExternalLink>
						</div>
						<div className="text-center text-[0.6rem] text-neutral-500">
							Source code on{" "}
							<a
								href="https://github.com/samuelscheit/wplace-archive"
								target="_blank"
								rel="noreferrer"
								className="text-slate-600 italic bold"
							>
								GitHub
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

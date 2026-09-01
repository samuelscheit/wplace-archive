// @ts-nocheck
import { useState } from "react";

const bankDetails = {
	USD: {
		accountNumber: "214860669595",
		routingNumber: "101019628",
		symbol: "$",
		flag: "🇺🇸",
	},
	EUR: {
		iban: "BE47 9054 1683 5780",
		bic: "TRWIBEB1XXX",
		symbol: "€",
		flag: "🇪🇺",
	},
	GBP: {
		accountNumber: "35592849",
		routingNumber: "230801",
		symbol: "£",
		flag: "🇬🇧",
	},
	JPY: {
		iban: "GB60 TRWI 2308 0135 5928 49",
		bic: "TRWIGB2LXXX",
		symbol: "¥",
		flag: "🇯🇵",
	},
	CNY: {
		iban: "GB60 TRWI 2308 0135 5928 49",
		bic: "TRWIGB2LXXX",
		symbol: "¥",
		flag: "🇨🇳",
	},
};

export function BankTransfer({ closeBankTransfer }: { closeBankTransfer: () => void }) {
	const [selectedCurrency, setSelectedCurrency] = useState<keyof typeof bankDetails>("USD");

	const currentDetails = bankDetails[selectedCurrency];

	return (
		<div
			className="absolute inset-0 z-30 bg-black/20 flex items-center justify-center backdrop-blur-sm"
			role="presentation"
			onClick={closeBankTransfer}
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
							Bank Transfer Details
						</h2>
					</div>
					<button
						type="button"
						onClick={closeBankTransfer}
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

				<div className="flex space-x-1 bg-neutral-100 p-1 rounded-lg">
					{Object.keys(bankDetails).map((currency) => (
						<button
							type="button"
							onClick={() => setSelectedCurrency(currency as any)}
							className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
								selectedCurrency === currency
									? "bg-white text-neutral-900 shadow-sm"
									: "text-neutral-600 hover:text-neutral-900"
							}`}
						>
							{bankDetails[currency].flag} {currency} {bankDetails[currency].symbol}
						</button>
					))}
				</div>

				<div className="mt-2">
					<div className="overflow-x-auto rounded border border-neutral-200">
						<table className="w-full text-sm">
							<tbody className="divide-y divide-neutral-200">
								<tr>
									<td className="bg-neutral-50 px-3 py-2 font-medium text-neutral-700">Name</td>
									<td className="px-3 py-2">
										<span className="font-mono select-all notranslate">Samuel Vincenz Scheit</span>
									</td>
								</tr>
								{selectedCurrency === "USD" || selectedCurrency === "GBP" ? (
									<>
										<tr>
											<td className="bg-neutral-50 px-3 py-2 font-medium text-neutral-700">Account Number</td>
											<td className="px-3 py-2">
												<span className="font-mono select-all notranslate">{currentDetails.accountNumber}</span>
											</td>
										</tr>
										<tr>
											<td className="bg-neutral-50 px-3 py-2 font-medium text-neutral-700">
												{selectedCurrency === "USD" ? "Routing number" : "Sort code"}
											</td>
											<td className="px-3 py-2">
												<span className="font-mono select-all notranslate">{currentDetails.routingNumber}</span>
											</td>
										</tr>
									</>
								) : (
									<>
										<tr>
											<td className="bg-neutral-50 px-3 py-2 font-medium text-neutral-700">IBAN</td>
											<td className="px-3 py-2">
												<span className="font-mono select-all notranslate">{currentDetails.iban}</span>
											</td>
										</tr>
										<tr>
											<td className="bg-neutral-50 px-3 py-2 font-medium text-neutral-700">BIC</td>
											<td className="px-3 py-2">
												<span className="font-mono select-all notranslate">{currentDetails.bic}</span>
											</td>
										</tr>
									</>
								)}
								<tr>
									<td className="bg-neutral-50 px-3 py-2 font-medium text-neutral-700">Reason for payment</td>
									<td className="px-3 py-2">
										<span className="font-mono select-all">Donation for wplace archive</span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					<div className="mt-3 text-sm text-black/70">
						If your currency is not listed, you can still send a bank transfer in any currency and your bank will handle the
						conversion.
					</div>
				</div>
			</div>
		</div>
	);
}

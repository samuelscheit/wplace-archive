export type PumpkinEntry = {
	key: string;
	lat: number;
	lng: number;
	tileX: number;
	tileY: number;
	offsetX: number;
	offsetY: number;
	event?: boolean;
	foundDate: Date;
	foundRaw?: string;
};

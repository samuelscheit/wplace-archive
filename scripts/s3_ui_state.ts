import { observable, observe } from "mobx";
import { configure } from "mobx";

export const state = observable(
	{
		deleting: {} as Record<
			string,
			{
				name: string;
				start: number;
				found?: number;
				deleted?: number;
				fetchingList?: boolean;
				fetchingDelete?: boolean;
				finished?: boolean;
				pages?: number;
			}
		>,
		listReleases: undefined as
			| undefined
			| {
					releases?: number;
					page?: number;
					finished?: boolean;
					toDelete?: number;
					toSync?: number;
			  },
		downloadReleases: {} as Record<
			string,
			{
				name: string;
				start: number;
				assets: number;
				currentFile?: string;
				skippingCurrentFile?: boolean;
				fetchingList?: boolean;
				fetchingDownload?: boolean;
				finished?: boolean;
				queueRunning?: number;
				queueSize?: number;
				queueTar?: number;
				downloaded: number;
				downloadBytes?: number;
				totalBytes?: number;
				pages: number;
				extracted: number;
				uploaded: number;
			}
		>,
	},
	{},
	{
		deep: true,
	},
);

configure({ enforceActions: "never" });
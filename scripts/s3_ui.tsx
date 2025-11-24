import React, { useState, useEffect } from "react";
import { Box, render, Text } from "ink";
import { observer } from "mobx-react";
import { Spinner } from "@inkjs/ui";
import { state } from "./s3_ui_state";

const IntlTimeDiff = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

const Counter = observer(() => {
	const { listReleases } = state;

	const deleting = Object.values(state.deleting).filter((item) => !item.finished);

	const downloadingAll = Object.values(state.downloadReleases);
	const downloading = downloadingAll.filter((item) => !item.finished);
	const downloaded = downloadingAll.filter((item) => item.finished);

	return (
		<Box flexDirection="column" gap={1}>
			{listReleases && !listReleases?.finished && (
				<Box gap={1}>
					<Box gap={1}>
						<Text bold inverse color="cyan">
							Fetching Releases
						</Text>
						<Spinner />
					</Box>
					<Box gap={1}>
						<Text color="magenta">Page</Text>
						<Text bold color="magentaBright">
							{listReleases.page ?? 0}
						</Text>
					</Box>
					<Box gap={1}>
						<Text color="blue">Releases</Text>
						<Text bold color="blueBright">
							{listReleases.releases ?? 0}
						</Text>
					</Box>
					<Box gap={1}>
						<Text color="red">To Delete</Text>
						<Text bold color="redBright">
							{listReleases.toDelete ?? 0}
						</Text>
					</Box>
					<Box gap={1}>
						<Text color="green">To Sync</Text>
						<Text bold color="greenBright">
							{listReleases.toSync ?? 0}
						</Text>
					</Box>
				</Box>
			)}

			{deleting.length > 0 && (
				<Box flexDirection="column">
					<Box gap={1}>
						<Text bold inverse color="green">
							Deleting {deleting.length} releases
						</Text>
						<Spinner />
					</Box>
					<Box flexDirection="column">
						{deleting.map((item) => {
							const diff = Date.now() - item.start;
							const elapsed = IntlTimeDiff.format(-Math.round(diff / 1000), "seconds");
							const tps = item.deleted && diff > 0 ? (item.deleted / diff) * 1000 : 0;

							return (
								<Box key={item.name} gap={2}>
									<Text bold inverse color="black">
										{item.name}
									</Text>
									<Box gap={1}>
										<Text color="blue">Found</Text>
										<Text bold color="blueBright">
											{item.found ?? 0}
										</Text>
									</Box>
									<Box gap={1}>
										<Text color="red">Deleted</Text>
										<Text bold color="redBright">
											{item.deleted ?? 0}
										</Text>
									</Box>
									<Box gap={1}>
										<Text color="magenta">Pages</Text>
										<Text bold color="magentaBright">
											{item.pages ?? 0}
										</Text>
									</Box>

									<Box gap={1}>
										<Text color="green">Since</Text>
										<Text bold color="greenBright">
											{elapsed}
										</Text>
									</Box>
									<Box gap={1}>
										<Text bold color="greenBright">
											{tps.toFixed(1)}
										</Text>
										<Text color="green">Tiles per sec</Text>
									</Box>
									{item.fetchingList && <Spinner label={`fetching list...`} />}
									{item.fetchingDelete && <Spinner label={`deleting...`} />}
								</Box>
							);
						})}
					</Box>
				</Box>
			)}

			{downloadingAll.length > 0 && (
				<Box flexDirection="column">
					<Box gap={1}>
						<Text bold inverse color="green">
							Downloaded {downloaded.length}/{downloadingAll.length} releases
						</Text>
						<Spinner />
					</Box>
					{downloading.map((item) => {
						const diff = Date.now() - item.start;
						const elapsed = IntlTimeDiff.format(-Math.round(diff / 1000), "seconds");

						const percent = item.totalBytes ? ((item.downloadBytes ?? 0) / item.totalBytes) * 100 : undefined;

						return (
							<Box key={item.name} gap={2}>
								<Text bold inverse color="black">
									{item.name}
								</Text>
								{!!item.fetchingDownload && <Spinner />}
								<Box gap={1}>
									<Text color="blue">{item.pages > 0 ? "Tiles" : "Assets"}</Text>
									<Text bold color="blueBright">
										{item.assets ?? 0}
									</Text>
								</Box>
								<Box gap={1}>
									<Text color="green">Downloaded</Text>
									<Text bold color="greenBright">
										{item.downloaded ?? 0}
									</Text>
								</Box>
								{item.pages > 0 && (
									<Box gap={1}>
										<Text color="magenta">Pages</Text>
										<Text bold color="magentaBright">
											{item.pages}
										</Text>
									</Box>
								)}

								<Box gap={1}>
									<Text color="green">Since</Text>
									<Text bold color="greenBright">
										{elapsed}
									</Text>
								</Box>
								{!!item.fetchingList && <Spinner label={`fetching list...`} />}

								{!!item.totalBytes && !!item.downloadBytes && !!percent && (
									<Box gap={1}>
										<Text color="cyan">Downloaded</Text>
										<Text bold color="cyanBright">
											{(item.downloadBytes / 1024 / 1024).toFixed(1)}mb / {(item.totalBytes / 1024 / 1024).toFixed(1)}
											mb ({percent.toFixed(0)}%)
										</Text>
									</Box>
								)}

								<Box gap={1}>
									<Text color="cyan">Queue</Text>
									<Text bold color="cyanBright">
										{item.queueRunning ?? 0} ({item.queueSize ?? 0} pending, {item.queueTar ?? 0} tar)
									</Text>
								</Box>

								<Box gap={1}>
									<Text color="magenta">Extracted</Text>
									<Text bold color="magentaBright">
										{item.extracted ?? 0}
									</Text>
								</Box>

								<Box gap={1}>
									<Text color="blue">Uploaded</Text>
									<Text bold color="blueBright">
										{item.uploaded ?? 0}
									</Text>
								</Box>

								{!!item.currentFile && (
									<Box gap={1}>
										<Text color="yellow">File</Text>
										<Text bold color="yellowBright">
											{(item.skippingCurrentFile ? `Skip ${item.currentFile}` : item.currentFile).padEnd(49, "")}
										</Text>
									</Box>
								)}
							</Box>
						);
					})}
				</Box>
			)}
		</Box>
	);
});

render(<Counter />);

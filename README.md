# WPlace - World Archive

## Map: [wplace.samuelscheit.com](https://wplace.samuelscheit.com/)

A project to scrape, archive and visualize the entire https://wplace.live map.

The map is divided into 2048x2048 tiles, each with a dimension of 1000x1000 pixels.
Each base tile is stored as a PNG file in `public/tiles/11` during archive generation, then `scripts/vips.py` builds the lower zoom levels.
Full-world archiving runs on the self-hosted Linux runner with IPv6 freebind.

## Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Run a small local archive test with `npm run archive:world -- --start-x=0 --start-y=0 --width=1 --height=1 --out=/tmp/wplace-tiles --clean=true --rps=1 --concurrency=1`
4. For full-world CI runs, set the `WPLACE_IPV6_SUBNET` secret to the routed IPv6 subnet on the self-hosted runner.

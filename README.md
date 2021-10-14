# Credits

This project is forked from https://github.com/tardis-dev/serum-vial

<br/>
<br/>

[![Docker version](https://img.shields.io/docker/v/microwavedcola/mango-vial/latest?label=Docker&color=05aac5)](https://hub.docker.com/r/microwavedcola/mango-vial)

# mango-vial: real-time WS market data API for Mango Perp Markets

<br/>

## Getting started

Start a local instance
```
npm run start:debug
```


Run the code snippet below in the browser Dev Tools directly or in Node.js (requires installation of `ws` lib.

```js
const ws = new WebSocket('ws://localhost:8000/v1/ws')

ws.onmessage = (message) => {
  console.log(JSON.parse(message.data))
}

ws.onopen = () => {
  const subscribeL2 = {
    op: 'subscribe',
    channel: 'level2',
    markets: ['BTC-PERP']
  }

  ws.send(JSON.stringify(subscribeL2))
}
```

<br/>
<br/>

Since by default mango-vial uses [`confirmed` commitment level](https://docs.solana.com/developing/clients/jsonrpc-api#configuring-state-commitment) for getting accounts notification from RPC node, it may sometimes feel slightly lagged when it comes to order book updates vs default DEX UI which uses [`recent/processed` commitment](https://docs.solana.com/developing/clients/jsonrpc-api#configuring-state-commitment).

<br/>
<br/>

## Installation

---

# IMPORTANT NOTE

For the best mango-vial data reliability it's advised to [set up a dedicated Solana RPC node](https://docs.solana.com/running-validator) and connect `mango-vial` to it instead of default `https://solana-api.projectserum.com` which may rate limit or frequently restart Websocket RPC connections since it's a public node used by many.

---

<br/>
<br/>

### npx <sub>(requires Node.js >= 15 and git installed on host machine)</sub>

Installs and starts mango-vial server running on port `8000`.

```sh
npx mango-vial
```

If you'd like to switch to different Solana RPC node endpoint like for example local one, change port or run with debug logs enabled, just add one of the available CLI options.

```sh
npx mango-vial --endpoint http://localhost:8090 --ws-endpoint-port 8899 --log-level debug --port 8900
```

Alternatively you can install mango-vial globally.

```sh
npm install -g mango-vial
mango-vial
```

<br/>

#### CLI options

| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; name &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | default                                                                                                                                                             | description                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `port`                                                                                                                                                                                                                                                                                                  | 8000                                                                                                                                                                | Port to bind server on                                                                                                                                                                             |
| `endpoint`                                                                                                                                                                                                                                                                                              | https://solana-api.projectserum.com                                                                                                                                 | Solana RPC node endpoint that mango-vial uses as a data source                                                                                                                                     |
| `ws-endpoint-port`                                                                                                                                                                                                                                                                                      | -                                                                                                                                                                   | Optional Solana RPC WS node endpoint port that mango-vial uses as a data source (if different than REST endpoint port) source                                                                      |
| `log-level`                                                                                                                                                                                                                                                                                             | info                                                                                                                                                                | Log level, available options: debug, info, warn and error                                                                                                                                          |
| `minions-count`                                                                                                                                                                                                                                                                                         | 1                                                                                                                                                                   | [Minions worker threads](#architecture) count that are responsible for broadcasting normalized WS messages to connected clients                                                                    |
| `commitment`                                                                                                                                                                                                                                                                                            | confirmed                                                                                                                                                           | [Solana commitment level](https://docs.solana.com/developing/clients/jsonrpc-api#configuring-state-commitment) to use when communicating with RPC node, available options: confirmed and processed |
| `markets-json`                                                                                                                                                                                                                                                                                          | `@project-serum/serum` [markets.json](https://github.com/project-serum/mango-ts/blob/master/packages/serum/src/markets.json) file, but only non depreciated markets | path to custom market.json definition file if one wants to run mango-vial for custom markets                                                                                                       |

<br/>

Run `npx mango-vial --help` to see all available startup options.

<br/>
<br/>

### Docker

Pulls and runs latest version of [`microwavedcola/mango-vial` Docker Image](https://hub.docker.com/r/microwavedcola/mango-vial) on port `8000`.

```sh
docker run -p 8000:8000 -d microwavedcola/mango-vial:latest
```

If you'd like to switch to different Solana RPC node endpoint, change port or run with debug logs enabled, just specify those via one of the available env variables.

```sh
docker run -p 8000:8000 -e "SV_LOG_LEVEL=debug" -d microwavedcola/mango-vial:latest
```

<br/>

#### ENV Variables

| &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; name &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | default                                                                                                                                                             | description                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SV_PORT`                                                                                                                                                                                                                                                                                               | 8000                                                                                                                                                                | Port to bind server on                                                                                                                                                                             |
| `SV_ENDPOINT`                                                                                                                                                                                                                                                                                           | https://solana-api.projectserum.com                                                                                                                                 | Solana RPC node endpoint that mango-vial uses as a data source                                                                                                                                     |
| `SV_WS_ENDPOINT_PORT`                                                                                                                                                                                                                                                                                   | -                                                                                                                                                                   | Optional Solana RPC WS node endpoint port that mango-vial uses as a data source (if different than REST endpoint port) source                                                                      |
| `SV_LOG_LEVEL`                                                                                                                                                                                                                                                                                          | info                                                                                                                                                                | Log level, available options: debug, info, warn and error                                                                                                                                          |
| `SV_MINIONS_COUNT`                                                                                                                                                                                                                                                                                      | 1                                                                                                                                                                   | [Minions worker threads](#architecture) count that are responsible for broadcasting normalized WS messages to connected clients                                                                    |
| `SV_COMMITMENT`                                                                                                                                                                                                                                                                                         | confirmed                                                                                                                                                           | [Solana commitment level](https://docs.solana.com/developing/clients/jsonrpc-api#configuring-state-commitment) to use when communicating with RPC node, available options: confirmed and processed |
| `SV_MARKETS_JSON`                                                                                                                                                                                                                                                                                       | `@project-serum/serum` [markets.json](https://github.com/project-serum/mango-ts/blob/master/packages/serum/src/markets.json) file, but only non depreciated markets | path to custom market.json definition file if one wants to run mango-vial for custom markets                                                                                                       |

<br/>
<br/>

### SSL/TLS Support

mango-vial supports [SSL/TLS](https://en.wikipedia.org/wiki/Transport_Layer_Security) but it's not enabled by default. In order to enable it you need to set `CERT_FILE_NAME` env var pointing to the certificate file and `KEY_FILE_NAME` pointing to private key of that certificate.

<br/>
<br/>

## WebSocket API

WebSocket API provides real-time market data feeds of Serum DEX and uses a bidirectional protocol which encodes all messages as JSON objects.

- each WebSocket client is required to actively send native WebSocket [pings](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#pings_and_pongs_the_heartbeat_of_websockets) to the server with interval less than 30 seconds, otherwise connection may be dropped due to inactivity

- message compression is enabled for clients supporting [`permessage-deflate`](https://tools.ietf.org/html/rfc7692)

<br/>

### Endpoint URL

- **[ws://localhost:8000/v1/ws](ws://localhost:8000/v1/ws)** - assuming mango-vial runs locally on default port without SSL enabled

- **[wss://api.mango-vial.dev/v1/ws](wss://api.mango-vial.dev/v1/ws)** - demo mango-vial server endpoint

<br/>

### Subscribing to data feeds

To begin receiving real-time market data feed messages, you must first send a subscribe message to the server indicating [channels](#supported-channels--corresponding-message-types) and [markets](#supported-markets) for which you want the data for.

If you want to unsubscribe from channel and markets, send an unsubscribe message. The structure is equivalent to subscribe messages except `op` field which should be set to `"op": "unsubscribe"`.

<br/>

#### Subscribe/unsubscribe message format

- see [supported channels & corresponding data messages types](#supported-channels--corresponding-message-types)
- see [supported markets](#supported-markets)

```ts
{
  "op": "subscribe" | "unsubscribe",
  "channel": "level2" | "level1",
  "markets": string[]
}
```

##### sample `subscribe` message

```json
{
  "op": "subscribe",
  "channel": "level2",
  "markets": ["BTC-PERP"]
}
```

<br/>

#### Subscription confirmation message format

Once a subscription (or unsubscription) request is processed by the server, it will push `subscribed` (or `unsubscribed`) confirmation message or `error` if received request message was invalid.

```ts
{
"type": "subscribed" | "unsubscribed",
"channel": "level2" | "level1",
"markets": string[],
"timestamp": string
}
```

##### sample `subscribed` confirmation message

```json
{
  "type": "subscribed",
  "channel": "level2",
  "markets": ["BTC-PERP"],
  "timestamp": "2021-03-23T17:06:30.010Z"
}
```

<br/>

#### Error message format

Error message is pushed for invalid subscribe/unsubscribe messages - non existing market, invalid channel name etc.

```ts
{
  "type": "error",
  "message": "string,
  "timestamp": "string
}
```

##### sample `error` message

```json
{
  "type": "error",
  "message": "Invalid channel provided: 'levels1'.",
  "timestamp": "2021-03-23T17:13:31.010Z"
}
```

<br/>
<br/>

### Supported channels & corresponding message types

When subscribed to the channel, server will push the data messages as specified below.

- `level1`

  - [`quote`](#quote)

- `level2`

  - [`l2snapshot`](#l2snapshot)
  - [`l2update`](#l2update)

<br/>
<br/>

### Supported markets

Markets supported by mango-vial server can be queried via [`GET /markets`](#get-markets) HTTP endpoint (`[].name` field).

<br/>
<br/>

### Data messages

- `type` is determining message's data type so it can be handled appropriately

- `timestamp` when message has been received from node RPC API in [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) format with milliseconds, for example: "2021-03-23T17:03:03.994Z"

- `slot` is a [Solana's slot](https://docs.solana.com/terminology#slot) number for which message has produced

- `version` of Serum DEX program layout (DEX version)

- `price` and `size` are provided as strings to preserve precision

<br/>

### `quote`

Pushed real-time for any change in best bid/ask price or size for a given market (decoded from the `bids` and `asks` accounts).

- `bestAsk` and `bestBid` are tuples where first item is a price and second is a size of the best bid/ask level

```ts
{
  "type": "quote",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "bestAsk": [price: string, size: string] | undefined,
  "bestBid": [price: string, size: string] | undefined
}
```

#### sample `quote` message

```json
{
  "type": "quote",
  "market": "BTC-PERP",
  "timestamp": "2021-03-24T07:11:57.186Z",
  "slot": 70544253,
  "version": 3,
  "bestAsk": ["55336.1", "5.0960"],
  "bestBid": ["55285.6", "7.5000"]
}
```

<br/>

### `l2snapshot`

Entire up-to-date order book snapshot with orders aggregated by price level pushed immediately after successful subscription confirmation.

- `asks` and `bids` arrays contain tuples where first item of a tuple is a price level and second one is a size of the resting orders at that price level

- it can be pushed for an active connection as well when underlying server connection to the RPC node has been restarted, in such scenario locally maintained order book should be re-initialized with a new snapshot

- together with [`l2update`](#l2update) messages it can be used to maintain local up-to-date full order book state

```ts
{
  "type": "l2snapshot",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "asks": [price: string, size: string][],
  "bids": [price: string, size: string][]
}
```

#### sample `l2snapshot` message

```json
{
  "type": "l2snapshot",
  "market": "BTC-PERP",
  "timestamp": "2021-03-24T09:00:53.087Z",
  "slot": 70555623,
  "version": 3,
  "asks": [
    ["56463.3", "8.6208"],
    ["56474.3", "5.8632"],
    ["56496.4", "3.7627"]
  ],
  "bids": [
    ["56386.0", "4.8541"],
    ["56370.1", "6.8054"],
    ["56286.3", "8.6631"]
  ]
}
```

<br/>

### `l2update`

Pushed real-time for any change to the order book for a given market with updated price levels and sizes since the previous update (decoded from the `bids` and `asks` accounts).

- together with [`l2snapshot`](#l2snapshot), `l2update` messages can be used to maintain local up-to-date full order book state

- `asks` and `bids` arrays contain updates which are provided as a tuples where first item is an updated price level and second one is an updated size of the resting orders at that price level (absolute value, not delta)

- if size is set to `0` it means that such price level does not exist anymore and shall be removed from locally maintained order book

```ts
{
  "type": "l2update",
  "market": string,
  "timestamp": string,
  "slot": number,
  "version": number,
  "asks": [price: string, size: string][],
  "bids": [price: string, size: string][]
}
```

#### sample `l2update` message

```json
{
  "type": "l2update",
  "market": "BTC-PERP",
  "timestamp": "2021-03-24T09:00:55.586Z",
  "slot": 70555627,
  "version": 3,
  "asks": [["56511.5", "7.5000"]],
  "bids": [
    ["56421.6", "0.0000"],
    ["56433.6", "5.9475"]
  ]
}
```

<br/>

###

<br/>
<br/>

## HTTP API

### GET `/markets`

Returns Mango Perp markets list supported by  mango-vial instance (it can be updated by providing custom markets.json file).

<br/>

### Endpoint URL

- [http://localhost:8000/v1/markets](http://localhost:8000/v1/markets) - assuming mango-vial runs locally on default port without SSL enabled

- [https://api.mango-vial.dev/v1/markets](https://api.mango-vial.dev/v1/markets) - demo mango-vial server endpoint

<br/>

### Response format

```ts
{
  "name": string,
  "address": string,
  "programId": string,
}[]
```

#### sample response

```json
[
  {
    "name": "BTC-PERP",
    "address": "A8YFbxQYFVqKZaoYJLLUVcQiWP7G2MeEgW5wsAQgMvFw",
    "programId": "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
  }
]
```

<br/>
<br/>

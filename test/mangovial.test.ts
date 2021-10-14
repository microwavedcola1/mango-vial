import fetch from 'node-fetch'
import WebSocket from 'ws'
import { bootServer, DataMessage, MangoPerpMarket, stopServer, SubRequest, SuccessResponse } from '../dist'
import { wait } from '../dist/helpers'

const PORT = 8989
const TIMEOUT = 180 * 1000
const WS_ENDPOINT = `ws://localhost:${PORT}/v1/ws`

async function fetchMarkets() {
  const response = await fetch(`http://localhost:${PORT}/v1/markets`)

  return (await response.json()) as MangoPerpMarket[]
}

describe('serum-vial', () => {
  beforeAll(async () => {
    await bootServer({
      port: PORT,
      commitment: 'confirmed',
      markets: [
        {
          address: 'DtEcjPLyD4YtTBB4q8xwFZ9q49W89xZCZtJyrGebi5t8',
          name: 'BTC-PERP',
          programId: 'mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68'
        }
      ],
      minionsCount: 1,
      nodeEndpoint: process.env.NODE_ENDPOINT as string,
      wsEndpointPort: undefined
    })
  }, TIMEOUT)

  afterAll(async () => {
    await stopServer()
  }, TIMEOUT)

  test(
    'HTTP GET /markets',
    async () => {
      const markets = await fetchMarkets()

      expect(markets).toMatchSnapshot()
    },
    TIMEOUT
  )

  test(
    'WS level1 data stream',
    async () => {
      const wsClient = new SimpleWebsocketClient(WS_ENDPOINT)
      const markets = await fetchMarkets()

      const subscribeRequest: SubRequest = {
        op: 'subscribe',
        channel: 'level1',
        markets: markets.map((m) => m.name)
      }

      await wsClient.send(subscribeRequest)
      let l1MessagesCount = 0
      let receivedSubscribed = false
      let receivedQuoteMessage = false

      for await (const message of wsClient.stream()) {
        if (message.type === 'subscribed') {
          receivedSubscribed = true
        }

        if (message.type === 'quote') {
          receivedQuoteMessage = true
        }

        l1MessagesCount++
        if (l1MessagesCount == 10) {
          break
        }
      }

      expect(l1MessagesCount).toBe(10)
      expect(receivedSubscribed).toBe(true)
      expect(receivedQuoteMessage).toBe(true)
    },
    TIMEOUT
  )

  test(
    'WS level2 data stream',
    async () => {
      const wsClient = new SimpleWebsocketClient(WS_ENDPOINT)
      const markets = await fetchMarkets()
      let receivedSubscribed = false
      let receivedSnapshot = false

      const subscribeRequest: SubRequest = {
        op: 'subscribe',
        channel: 'level2',
        markets: markets.map((m) => m.name)
      }

      await wsClient.send(subscribeRequest)
      let l2MessagesCount = 0

      for await (const message of wsClient.stream()) {
        if (message.type === 'subscribed') {
          receivedSubscribed = true
        }

        if (message.type === 'l2snapshot') {
          receivedSnapshot = true
        }

        l2MessagesCount++
        if (l2MessagesCount == 10) {
          break
        }
      }

      expect(l2MessagesCount).toBe(10)
      expect(receivedSnapshot).toBe(true)
      expect(receivedSubscribed).toBe(true)
    },
    TIMEOUT
  )
  class SimpleWebsocketClient {
    private readonly _socket: WebSocket

    constructor(url: string) {
      this._socket = new WebSocket(url)
    }

    public async send(payload: any) {
      while (this._socket.readyState !== WebSocket.OPEN) {
        await wait(100)
      }
      this._socket.send(JSON.stringify(payload))
    }

    public async *stream() {
      const realtimeMessagesStream = (WebSocket as any).createWebSocketStream(this._socket, {
        readableObjectMode: true
      }) as AsyncIterableIterator<Buffer>

      for await (let messageBuffer of realtimeMessagesStream) {
        const message = JSON.parse(messageBuffer as any)
        yield message as DataMessage | SuccessResponse
      }
    }
  }
})

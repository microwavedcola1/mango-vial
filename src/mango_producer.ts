import { Config, getMarketByBaseSymbolAndKind, GroupConfig, MangoClient } from '@blockworks-foundation/mango-client'
import { Commitment, Connection } from '@solana/web3.js'
import { isMainThread, workerData } from 'worker_threads'
import { MangoPerpMarket } from '.'
import { MessageType } from './consts'
import { DataMapper } from './data_mapper'
import {
  decimalPlaces,
  loadPerpMarket,
  partitionDetectedChannel,
  mangoDataChannel,
  mangoProducerReadyChannel
} from './helpers'
import { logger } from './logger'
import { RPCClient } from './rpc_client'

if (isMainThread) {
  const message = 'Exiting. Worker is not meant to run in main thread'
  logger.log('error', message)

  throw new Error(message)
}

process.on('unhandledRejection', (err) => {
  throw err
})

// MangoProducer responsibility is to:
// - connect to Mango Node RPC API via WS and subscribe to single Mango perp market
// - map received data to normalized data messages and broadcast those

export class MangoProducer {
  constructor(
    private readonly _options: {
      nodeEndpoint: string
      wsEndpointPort: number | undefined
      marketName: string
      commitment: string
      markets: MangoPerpMarket[]
    }
  ) {}

  public async run(onData: OnDataCallback) {
    let started = false
    logger.log('info', `Mango producer starting for ${this._options.marketName} market...`)

    const marketMeta = this._options.markets.find((m) => m.name == this._options.marketName)!

    // don't use Solana web3.js Connection but custom rpcClient so we have more control and insight what is going on
    const rpcClient = new RPCClient({
      nodeEndpoint: this._options.nodeEndpoint,
      commitment: this._options.commitment,
      wsEndpointPort: this._options.wsEndpointPort
    })

    const market = await loadPerpMarket(this._options.marketName)

    const priceDecimalPlaces = decimalPlaces(market.tickSize)
    const sizeDecimalPlaces = decimalPlaces(market.minOrderSize)

    const dataMapper = new DataMapper({
      symbol: this._options.marketName,
      market,
      priceDecimalPlaces,
      sizeDecimalPlaces,
      onPartitionDetected: () => {
        partitionDetectedChannel.postMessage('partition-detected')
        rpcClient.reset()
      }
    })

    partitionDetectedChannel.onmessage = () => {
      rpcClient.reset()
    }

    for await (const notification of rpcClient.streamAccountsNotification(market, this._options.marketName)) {
      if (started === false) {
        logger.log('info', `Mango producer started for ${this._options.marketName} market...`)
        started = true
        mangoProducerReadyChannel.postMessage('ready')
      }

      if (notification.reset) {
        dataMapper.reset()
      } else {
        const messagesForSlot = [...dataMapper.map(notification)]
        if (messagesForSlot.length > 0) {
          onData(messagesForSlot)
        }
      }
    }
  }
}

const mangoProducer = new MangoProducer(workerData)

mangoProducer.run((envelopes) => {
  mangoDataChannel.postMessage(envelopes)
})

export type MessageEnvelope = {
  type: MessageType
  market: string
  publish: boolean
  payload: string
  timestamp: string
}

type OnDataCallback = (envelopes: MessageEnvelope[]) => void

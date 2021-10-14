import {
  Config,
  getMarketByBaseSymbolAndKind,
  GroupConfig,
  MangoClient,
  PerpMarket
} from '@blockworks-foundation/mango-client'
import { Connection, Commitment } from '@solana/web3.js'
import didYouMean from 'didyoumean2'
import { MangoPerpMarket } from '.'

export const wait = (delayMS: number) => new Promise((resolve) => setTimeout(resolve, delayMS))

export function getDidYouMean(input: string, allowedValues: readonly string[]) {
  let tip = ''

  if (typeof input === 'string') {
    let result = didYouMean(input, allowedValues, {})
    if (result !== null) {
      tip = ` Did you mean '${result}'?`
    }
  }
  return tip
}

export function getAllowedValuesText(allowedValues: readonly string[]) {
  return `Allowed values: ${allowedValues.map((val) => `'${val}'`).join(', ')}.`
}

export function* batch<T>(items: T[], batchSize: number) {
  for (let i = 0; i < items.length; i += batchSize) {
    yield items.slice(i, i + batchSize)
  }
}

// https://stackoverflow.com/questions/9539513/is-there-a-reliable-way-in-javascript-to-obtain-the-number-of-decimal-places-of?noredirect=1&lq=1

export function decimalPlaces(n: number) {
  // Make sure it is a number and use the builtin number -> string.
  var s = '' + +n
  // Pull out the fraction and the exponent.
  var match = /(?:\.(\d+))?(?:[eE]([+\-]?\d+))?$/.exec(s)
  // NaN or Infinity or integer.
  // We arbitrarily decide that Infinity is integral.
  if (!match) {
    return 0
  }
  // Count the number of digits in the fraction and subtract the
  // exponent to simulate moving the decimal point left by exponent places.
  // 1.234e+2 has 1 fraction digit and '234'.length -  2 == 1
  // 1.234e-2 has 5 fraction digit and '234'.length - -2 == 5

  return Math.max(
    0, // lower limit.
    (match[1] == '0' ? 0 : (match[1] || '').length) - // fraction length
      (+match[2]! || 0)
  ) // exponent
}

export class CircularBuffer<T> {
  private _buffer: T[] = []
  private _index: number = 0
  constructor(private readonly _bufferSize: number) {}

  append(value: T) {
    const isFull = this._buffer.length === this._bufferSize
    let poppedValue
    if (isFull) {
      poppedValue = this._buffer[this._index]
    }
    this._buffer[this._index] = value
    this._index = (this._index + 1) % this._bufferSize

    return poppedValue
  }

  *items() {
    for (let i = 0; i < this._buffer.length; i++) {
      const index = (this._index + i) % this._buffer.length
      yield this._buffer[index]!
    }
  }

  get count() {
    return this._buffer.length
  }

  clear() {
    this._buffer = []
    this._index = 0
  }
}

const { BroadcastChannel } = require('worker_threads')

export const minionReadyChannel = new BroadcastChannel('MinionReady') as BroadcastChannel
export const mangoProducerReadyChannel = new BroadcastChannel('MangoProducerReady') as BroadcastChannel
export const mangoDataChannel = new BroadcastChannel('MangoData') as BroadcastChannel
export const mangoMarketsChannel = new BroadcastChannel('MangoMarkets') as BroadcastChannel
export const cleanupChannel = new BroadcastChannel('Cleanup') as BroadcastChannel
export const partitionDetectedChannel = new BroadcastChannel('PartitionDetected') as BroadcastChannel

export async function executeAndRetry<T>(
  operation: (attempt: number) => Promise<T>,
  { maxRetries }: { maxRetries: number }
): Promise<T> {
  let attempts = 0
  while (true) {
    attempts++
    try {
      return await operation(attempts)
    } catch (err) {
      if (attempts > maxRetries) {
        throw err
      }

      await wait(500 * attempts * attempts)
    }
  }
}

export function getDefaultMarkets(): MangoPerpMarket[] {
  const defaultMarkets: MangoPerpMarket[] = []

  const groupName = process.env.GROUP_NAME || 'mainnet.1'
  const mangoGroupConfig: GroupConfig = Config.ids().groups.filter((group) => group.name === groupName)[0]!

  for (const market of mangoGroupConfig.perpMarkets) {
    if (defaultMarkets.some((s) => s.name === market.name)) {
      continue
    }

    defaultMarkets.push({
      name: market.name,
      address: market.publicKey.toBase58(),
      programId: mangoGroupConfig.mangoProgramId.toBase58()
    })
  }

  return defaultMarkets
}

export async function loadPerpMarket(nodeEndpoint: string, marketName: string): Promise<PerpMarket> {
  const groupName = process.env.GROUP_NAME || 'mainnet.1'
  const mangoGroupConfig: GroupConfig = Config.ids().groups.filter((group) => group.name === groupName)[0]!
  const connection = new Connection(nodeEndpoint, 'processed' as Commitment)
  const mangoClient = new MangoClient(connection, mangoGroupConfig.mangoProgramId)
  const mangoGroup = await mangoClient.getMangoGroup(mangoGroupConfig.publicKey)
  const perpMarketConfig = getMarketByBaseSymbolAndKind(mangoGroupConfig, marketName.split('-')[0] as string, 'perp')
  return await mangoGroup.loadPerpMarket(
    connection,
    perpMarketConfig.marketIndex,
    perpMarketConfig.baseDecimals,
    perpMarketConfig.quoteDecimals
  )
}

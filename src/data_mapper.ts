import { BookSide, BookSideLayout, PerpMarket, PerpOrder } from '@blockworks-foundation/mango-client'
import { CircularBuffer } from './helpers'
import { logger } from './logger'
import { AccountsNotificationPayload } from './rpc_client'
import { MessageEnvelope } from './mango_producer'
import { DataMessage, L2, OrderItem, PriceLevel, Quote } from './types'

// DataMapper maps bids, asks and evenQueue accounts data to normalized messages
export class DataMapper {
  private _bidsAccountOrders: OrderItem[] | undefined = undefined
  private _asksAccountOrders: OrderItem[] | undefined = undefined

  private _bidsAccountSlabItems: PerpOrder[] | undefined = undefined
  private _asksAccountSlabItems: PerpOrder[] | undefined = undefined

  // _local* are used only for verification purposes
  private _localBidsOrdersMap: Map<string, OrderItem> | undefined = undefined
  private _localAsksOrdersMap: Map<string, OrderItem> | undefined = undefined

  private _initialized = false
  private _lastSeenSeqNum: number | undefined = undefined

  private _currentL2Snapshot:
    | {
        asks: PriceLevel[]
        bids: PriceLevel[]
      }
    | undefined = undefined

  private _currentQuote:
    | {
        readonly bestAsk: PriceLevel | undefined
        readonly bestBid: PriceLevel | undefined
      }
    | undefined = undefined

  private readonly _version: number
  private _zeroWithPrecision: string

  constructor(
    private readonly _options: {
      readonly symbol: string
      readonly market: PerpMarket
      readonly priceDecimalPlaces: number
      readonly sizeDecimalPlaces: number
      readonly onPartitionDetected: () => void
    }
  ) {
    this._version = 3 // mango-v3
    const zero = 0
    this._zeroWithPrecision = zero.toFixed(this._options.sizeDecimalPlaces)
  }

  public *map({ accountsData, slot }: AccountsNotificationPayload): IterableIterator<MessageEnvelope> {
    // the same timestamp for all messages received in single notification
    const timestamp = new Date().toISOString()

    if (accountsData.asks !== undefined) {
      const newAskPerpOrders = [
        ...new BookSide(undefined!, this._options.market, BookSideLayout.decode(accountsData?.asks)).items()
      ]
      const newAsksOrders = newAskPerpOrders.map(this._mapAskSlabItemToOrder)
      this._asksAccountSlabItems = newAskPerpOrders
      this._asksAccountOrders = newAsksOrders
    }

    if (accountsData.bids !== undefined) {
      const newBidsPerpOrders = [
        ...new BookSide(undefined!, this._options.market, BookSideLayout.decode(accountsData?.bids)).items()
      ]
      const newBidsOrders = newBidsPerpOrders.map(this._mapBidSlabItemToOrder)

      this._bidsAccountSlabItems = newBidsPerpOrders
      this._bidsAccountOrders = newBidsOrders
    }

    // initialize only when we have both asks and bids accounts data
    const shouldInitialize =
      this._initialized === false && this._asksAccountOrders !== undefined && this._bidsAccountOrders !== undefined

    const snapshotHasChanged =
      this._initialized === true && (accountsData.asks !== undefined || accountsData.bids !== undefined)

    if (shouldInitialize || snapshotHasChanged) {
      const publish = this._initialized === false
      this._initialized = true
    }

    if (this._initialized === false) {
      return
    }

    if (this._currentL2Snapshot === undefined) {
      this._currentL2Snapshot = {
        asks: this._mapToL2Snapshot(this._asksAccountSlabItems!),
        bids: this._mapToL2Snapshot(this._bidsAccountSlabItems!)
      }

      const l2SnapshotMessage: L2 = {
        type: 'l2snapshot',
        market: this._options.symbol,
        timestamp,
        slot,
        version: this._version,
        asks: this._currentL2Snapshot.asks,
        bids: this._currentL2Snapshot.bids
      }

      this._currentQuote = {
        bestAsk: this._currentL2Snapshot.asks[0],
        bestBid: this._currentL2Snapshot.bids[0]
      }

      const quoteMessage: Quote = {
        type: 'quote',
        market: this._options.symbol,
        timestamp,
        slot,
        version: this._version,
        bestAsk: this._currentQuote.bestAsk,
        bestBid: this._currentQuote.bestBid
      }

      yield this._putInEnvelope(l2SnapshotMessage, true)
      yield this._putInEnvelope(quoteMessage, true)
    }

    // if account data has not changed, use current snapshot data
    // otherwise map new account data to l2
    const newL2Snapshot = {
      asks:
        accountsData.asks !== undefined
          ? this._mapToL2Snapshot(this._asksAccountSlabItems!)
          : this._currentL2Snapshot.asks,

      bids:
        accountsData.bids !== undefined
          ? this._mapToL2Snapshot(this._bidsAccountSlabItems!)
          : this._currentL2Snapshot.bids
    }

    const newQuote = {
      bestAsk: newL2Snapshot.asks[0],
      bestBid: newL2Snapshot.bids[0]
    }

    const bookIsCrossed =
      newL2Snapshot.asks.length > 0 &&
      newL2Snapshot.bids.length > 0 &&
      // best bid price is >= best ask price
      Number(newL2Snapshot.bids[0]![0]) >= Number(newL2Snapshot.asks[0]![0])

    if (bookIsCrossed) {
      logger.log('warn', 'PartitionDetected: crossed L2 book', {
        market: this._options.symbol,
        quote: newQuote,
        slot
      })

      this._options.onPartitionDetected()

      return
    }

    const asksDiff =
      accountsData.asks !== undefined ? this._getL2Diff(this._currentL2Snapshot.asks, newL2Snapshot.asks) : []

    const bidsDiff =
      accountsData.bids !== undefined ? this._getL2Diff(this._currentL2Snapshot.bids, newL2Snapshot.bids) : []

    if (asksDiff.length > 0 || bidsDiff.length > 0) {
      // since we have a diff it means snapshot has changed
      // so we need to pass new snapshot to minions, just without 'publish' flag
      this._currentL2Snapshot = newL2Snapshot

      const l2Snapshot: L2 = {
        type: 'l2snapshot',
        market: this._options.symbol,
        timestamp,
        slot,
        version: this._version,
        asks: this._currentL2Snapshot.asks,
        bids: this._currentL2Snapshot.bids
      }
      const l2UpdateMessage: L2 = {
        type: 'l2update',
        market: this._options.symbol,
        timestamp,
        slot,
        version: this._version,
        asks: asksDiff,
        bids: bidsDiff
      }

      // first goes update
      yield this._putInEnvelope(l2UpdateMessage, true)
      // then snapshot, as new snapshot already includes update
      yield this._putInEnvelope(l2Snapshot, false)

      const quoteHasChanged =
        this._l2LevelChanged(this._currentQuote!.bestAsk, newQuote.bestAsk) ||
        this._l2LevelChanged(this._currentQuote!.bestBid, newQuote.bestBid)

      if (quoteHasChanged) {
        this._currentQuote = newQuote

        const quoteMessage: Quote = {
          type: 'quote',
          market: this._options.symbol,
          timestamp,
          slot,
          version: this._version,
          bestAsk: this._currentQuote.bestAsk,
          bestBid: this._currentQuote.bestBid
        }

        yield this._putInEnvelope(quoteMessage, true)
      }
    }
  }

  public reset() {
    if (this._initialized === false) {
      return
    }

    this._initialized = false
    this._lastSeenSeqNum = undefined
    this._bidsAccountOrders = undefined
    this._asksAccountOrders = undefined
    this._localBidsOrdersMap = undefined
    this._localAsksOrdersMap = undefined
    this._currentL2Snapshot = undefined
    this._currentQuote = undefined
  }

  private _mapToL2Snapshot(slabItems: PerpOrder[]) {
    const levels: [number, number][] = []

    for (const { price, size } of slabItems) {
      if (levels.length > 0 && levels[levels.length - 1]![0] === price) {
        levels[levels.length - 1]![1] + size
      } else {
        levels.push([price, size])
      }
    }

    return levels.map(this._mapToL2Level)
  }

  private _getL2Diff(currentLevels: PriceLevel[], newLevels: PriceLevel[]): PriceLevel[] {
    const currentLevelsMap = new Map(currentLevels)

    const l2Diff: PriceLevel[] = []

    for (const newLevel of newLevels) {
      const matchingCurrentLevelSize = currentLevelsMap.get(newLevel[0])

      if (matchingCurrentLevelSize !== undefined) {
        const levelSizeChanged = matchingCurrentLevelSize !== newLevel[1]

        if (levelSizeChanged) {
          l2Diff.push(newLevel)
        }
        // remove from current levels map so we know that such level exists in new levels
        currentLevelsMap.delete(newLevel[0])
      } else {
        // completely new price level
        l2Diff.push(newLevel)
      }
    }

    for (const levelToRemove of currentLevelsMap) {
      const l2Delete: PriceLevel = [levelToRemove[0], this._zeroWithPrecision]

      l2Diff.unshift(l2Delete)
    }

    return l2Diff
  }

  private _l2LevelChanged(currentLevel: PriceLevel | undefined, newLevel: PriceLevel | undefined) {
    if (currentLevel === undefined && newLevel === undefined) {
      return false
    }

    if (currentLevel === undefined && newLevel !== undefined) {
      return true
    }

    if (currentLevel !== undefined && newLevel === undefined) {
      return true
    }

    // price has changed
    if (currentLevel![0] !== newLevel![0]) {
      return true
    }

    // size has changed
    if (currentLevel![1] !== newLevel![1]) {
      return true
    }

    return false
  }

  private _mapToL2Level = (level: [number, number]): PriceLevel => {
    const price = level[0].toFixed(this._options.priceDecimalPlaces)
    const size = level[1].toFixed(this._options.sizeDecimalPlaces)

    return [price, size]
  }

  private _putInEnvelope(message: DataMessage, publish: boolean) {
    const envelope: MessageEnvelope = {
      type: message.type,
      market: message.market,
      publish,
      payload: JSON.stringify(message),
      timestamp: message.timestamp
    }

    return envelope
  }

  private _mapAskSlabItemToOrder = (perpOrder: PerpOrder) => {
    return this._mapToOrderItem(perpOrder, false)
  }

  private _mapBidSlabItemToOrder = (perpOrder: PerpOrder) => {
    return this._mapToOrderItem(perpOrder, true)
  }

  private _mapToOrderItem = (perpOrder: PerpOrder, isBids: boolean) => {
    const orderItem: OrderItem = {
      orderId: perpOrder.orderId.toString(),
      clientId: perpOrder.clientId ? perpOrder.clientId.toString() : '',
      side: isBids ? 'buy' : 'sell',
      price: perpOrder.price.toFixed(this._options.priceDecimalPlaces),
      size: perpOrder.size.toFixed(this._options.sizeDecimalPlaces),
      account: perpOrder.owner.toBase58(),
      accountSlot: perpOrder.openOrdersSlot,
      feeTier: 0 // todo
    }

    return orderItem
  }
}

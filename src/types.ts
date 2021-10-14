import { Channel, MessageType, Op } from './consts'

export type EventQueueHeader = {
  seqNum: number
  head: number
  count: number
}

export type SubRequest = {
  readonly op: Op
  readonly channel: Channel
  readonly markets: string[]
}

export interface Message {
  readonly type: MessageType
  readonly timestamp: string
}

export interface DataMessage extends Message {
  readonly market: string
  readonly version: number
  readonly slot: number
}

export interface ErrorResponse extends Message {
  readonly type: 'error'
  readonly message: string
}

export interface SuccessResponse extends Message {
  readonly type: 'subscribed' | 'unsubscribed'
  readonly channel: Channel
  readonly markets: string[]
}

export type PriceLevel = [string, string]

export interface L2 extends DataMessage {
  readonly type: 'l2update' | 'l2snapshot'
  readonly asks: PriceLevel[]
  readonly bids: PriceLevel[]
}

export interface Quote extends DataMessage {
  readonly type: 'quote'
  readonly bestAsk: PriceLevel | undefined
  readonly bestBid: PriceLevel | undefined
}

export type OrderItem = {
  readonly price: string
  readonly size: string
  readonly side: 'buy' | 'sell'
  readonly orderId: string
  readonly clientId: string
  readonly account: string
  readonly accountSlot: number
  readonly feeTier: number
}

export type MangoPerpMarket = {
  address: string
  name: string
  programId: string
}

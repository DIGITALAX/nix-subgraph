/* eslint-disable prefer-const */
import { BigInt, BigDecimal, store, Address, log } from '@graphprotocol/graph-ts'
import {ZERO, ONE} from "./constants";
import {
  Order,
  Token
} from '../../generated/schema'
import {
  OrderAdded,
  Nix as NixContract,
  OrderUpdated,
  OrderDisabled,
  ThankYou,
  OrderExecuted
} from '../../generated/Nix/Nix'
import { ERC721 as ERC721Contract } from '../../generated/Nix/ERC721'
import {loadOrCreateGlobalStat} from "./factory/GlobalStat.factory";
import {loadOrCreateTrade} from "./factory/Trade.factory";

//const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function handleOrderAdded(event: OrderAdded): void {
  let orderId = event.params.token.toHexString().concat("-").concat(event.params.orderIndex.toString());
  // Add the token info
  let token = Token.load(event.params.token.toHexString());
  if(token == null){
    token = new Token(event.params.token.toHexString());
    token.executed = ZERO;
    token.orderIndexes = null;
    token.volumeErc20 = ZERO;
    token.volumeToken = ZERO;
    token.name = null;
    token.symbol = null;
  }
  let nixContract = NixContract.bind(event.address);

  let order = new Order(orderId);
  order.token = token.id;

  let callResult = nixContract.try_getOrder(event.params.token, event.params.orderIndex);
    if (callResult.reverted) {
      log.info('get order reverted', []);
        order.expiry = ZERO;
        order.maker = null;
        order.orderIndex = ZERO;
        order.buyOrSell = null;
        order.anyOrAll = null;
        order.price = ZERO;
        order.taker = null;
        order.tokenIds = null;
        order.tradeCount = ZERO;
        order.tradeMax = ZERO;
        order.royaltyFactor = ZERO;
    } else {
        order.expiry = callResult.value.expiry;
        order.maker = callResult.value.maker.toHexString();
        order.orderIndex = event.params.orderIndex;
        order.buyOrSell = BigInt.fromI32(callResult.value.buyOrSell).isZero() ? "Buy" : "Sell";
        order.anyOrAll = BigInt.fromI32(callResult.value.anyOrAll).isZero() ? "Any" : "All";
        order.price = callResult.value.price;
        order.taker = callResult.value.taker.toHexString();
        order.tokenIds = callResult.value.tokenIds;
        order.tradeCount = callResult.value.tradeCount;
        order.tradeMax = callResult.value.tradeMax;
        order.royaltyFactor = callResult.value.royaltyFactor;
    }

  let tokenResult = nixContract.try_tokens(event.params.token);
  if (tokenResult.reverted) {
    log.info('get token reverted', []);
  } else {
      token.executed = tokenResult.value.value1;
      token.volumeToken = tokenResult.value.value2;
      token.volumeErc20 = tokenResult.value.value3;

      let erc721Contract = ERC721Contract.bind(event.params.token);

       let nameResult = erc721Contract.try_name();
        if (nameResult.reverted) {
          log.info('get token name reverted', []);
        } else {
            token.name = nameResult.value;
        }
       let symbolResult = erc721Contract.try_symbol();
        if (symbolResult.reverted) {
          log.info('get token symbolResult reverted', []);
        } else {
            token.symbol = symbolResult.value;
        }
  }

  order.save();
  token.save();

  let globalStat = loadOrCreateGlobalStat();
  globalStat.numberOfOrdersAdded = globalStat.numberOfOrdersAdded.plus(ONE);
  globalStat.save();
}

export function handleOrderDisabled(event: OrderDisabled): void {
  let orderId = event.params.token.toHexString().concat("-").concat(event.params.orderIndex.toString());

  let order = Order.load(orderId);
  if(order == null){
    log.info('Missing order', []);
  }
  let nixContract = NixContract.bind(event.address);

  let callResult = nixContract.try_getOrder(event.params.token, event.params.orderIndex);
    if (callResult.reverted) {
      log.info('get order reverted- disable handler', []);
    } else {
        order.expiry = callResult.value.expiry;
    }
   order.save();
}

export function handleOrderUpdated(event: OrderUpdated): void {
  let orderId = event.params.token.toHexString().concat("-").concat(event.params.orderIndex.toString());

  let order = Order.load(orderId);
  if(order == null){
    log.info('Missing order', []);
  }
  let nixContract = NixContract.bind(event.address);

  let callResult = nixContract.try_getOrder(event.params.token, event.params.orderIndex);
  if (callResult.reverted) {
      log.info('get order reverted- update handler', []);
  } else {
        order.expiry = callResult.value.expiry;
        order.price = callResult.value.price;
        order.taker = callResult.value.taker.toHexString();
        order.tokenIds = callResult.value.tokenIds;
        order.tradeMax = callResult.value.tradeMax;
        order.royaltyFactor = callResult.value.royaltyFactor;
  }
   order.save();
}

export function handleOrderExecuted(event: OrderExecuted): void {
  let orderId = event.params.token.toHexString().concat("-").concat(event.params.orderIndex.toString());

  let order = Order.load(orderId);
  if(order == null){
    log.info('Missing order', []);
  }
  let nixContract = NixContract.bind(event.address);

  let tradeId = ZERO;
  let callResult = nixContract.try_tradesLength();
   if (callResult.reverted) {
      log.info('trades length unsuccessful', []);
      return;
    } else {
        if(callResult.value.equals(ZERO)){
          return;
        }
        tradeId = callResult.value.minus(ONE);
  }

  let trade = loadOrCreateTrade(tradeId.toString());
  let tradeResult = nixContract.try_getTrade(tradeId);
   if (tradeResult.reverted) {
      log.info('get trade unsuccessful', []);
      return;
    } else {
       trade.taker = tradeResult.value.value0.toHexString();
       trade.royaltyFactor = tradeResult.value.value1;
       trade.blockNumber = tradeResult.value.value2;
       const orders = trade.orders;
       orders.push(trade.id);
       trade.orders = orders;
       trade.save();

       const trades = order.trades;
       trades.push(trade.id);
       order.trades = trades;
       order.save();
  }

  // TODO figure out unique addresses

}

export function handleTip(event: ThankYou): void {
  let globalStat = loadOrCreateGlobalStat();
  globalStat.numberOfOrdersAdded = globalStat.tipLifetimeAccumulatedInWei.plus(event.params.tip);
  globalStat.save();
}



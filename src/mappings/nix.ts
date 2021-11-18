/* eslint-disable prefer-const */
import { BigInt, BigDecimal, store, Address, log } from '@graphprotocol/graph-ts'
import { ZERO, ONE, ZERO_ADDRESS } from './constants'
import {
  NFT,
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
  let tokenAddress = event.params.token.toHexString();
  let orderId = tokenAddress.concat("-").concat(event.params.orderIndex.toString());

  // Add the token info
  let erc721Contract = ERC721Contract.bind(event.params.token);
  let token = Token.load(tokenAddress);
  if(!token){
    token = new Token(tokenAddress);
    token.executed = ZERO;
    token.lastOrderIndex = ZERO;
    token.volumeErc20 = ZERO;
    token.volumeToken = ZERO;
    token.name = null;
    token.symbol = null;
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

        for (let i = 0; i < order.tokenIds!.length; i += 1) {
                if(order.tokenIds![i]) {
                  let uriResult = erc721Contract.try_tokenURI(order.tokenIds![i]);
                  if (uriResult.reverted) {
                    log.info('get token uriResult reverted {}', [order.tokenIds![i].toString()]);
                  } else {
                    const nftId = tokenAddress.concat("-").concat(order.tokenIds![i].toString());
                    const nft = NFT.load(nftId);
                    if (!nft) {
                      const nft = new NFT(nftId);
                      nft.lastSeller = ZERO_ADDRESS.toHexString();
                      nft.lastOrderIndex = event.params.orderIndex;
                      nft.lastRoyaltyFactor = ZERO;
                      nft.lastBuyer = ZERO_ADDRESS.toHexString();
                      nft.lastSalePrice = ZERO;
                      nft.lastTradeIndex = null;
                      nft.token = token.id;
                      nft.tokenId = order.tokenIds![i];
                      nft.totalVolume = ZERO;
                      nft.tradeCount = ZERO;
                      const orders = nft.orders;
                      nft.orders = nft.orders ? orders!.concat([order.id]) : [order.id];

                      nft.save();
                    }
                  }
                }
        }
    }

  order.save();

  token.lastOrderIndex = event.params.orderIndex;

  token.save();

  let globalStat = loadOrCreateGlobalStat();
  let newOrder = ZERO;
  if(globalStat.numberOfOrdersAdded) {
    newOrder = globalStat.numberOfOrdersAdded!;
  }
  if(newOrder) {
    globalStat.numberOfOrdersAdded = newOrder.plus(ONE);
  }
  globalStat.save();
}

export function handleOrderDisabled(event: OrderDisabled): void {
  let orderId = event.params.token.toHexString().concat("-").concat(event.params.orderIndex.toString());

  let order = Order.load(orderId);
  if(order == null){
    log.info('Missing order', []);
    return;
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
  let tokenAddress = event.params.token.toHexString();
  let orderId = tokenAddress.concat("-").concat(event.params.orderIndex.toString());

  let order = Order.load(orderId);
  if(order == null){
    log.info('Missing order', []);
    return;
  }

  let nixContract = NixContract.bind(event.address);
  let erc721Contract = ERC721Contract.bind(event.params.token);
  let token = Token.load(tokenAddress);

  // Needed in case someone changes the order to another token altogether
  if(token == null){
    token = new Token(tokenAddress);
    token.executed = ZERO;
    token.lastOrderIndex = ZERO;
    token.volumeErc20 = ZERO;
    token.volumeToken = ZERO;
    token.name = null;
    token.symbol = null;

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

  let callResult = nixContract.try_getOrder(event.params.token, event.params.orderIndex);
  if (callResult.reverted) {
      log.info('get order reverted- update handler', []);
  } else {
    order.expiry = callResult.value.expiry;
    order.price = callResult.value.price;
    order.taker = callResult.value.taker.toHexString();

    for (let i = 0; i < order.tokenIds!.length; i += 1) {
      const nftId = tokenAddress.concat("-").concat(order.tokenIds![i].toString());
      const nft = NFT.load(nftId);
      if (nft) {
        if (nft.orders) {
          for (let j = 0; j < callResult.value.tokenIds.length; j += 1) {
            let indexOf = nft.orders!.indexOf(order.id);
            if (indexOf != -1) {
              nft.orders = nft.orders!.splice(indexOf, 1);
            }
          }
        }
      }

      order.tokenIds = callResult.value.tokenIds;
      order.tradeMax = callResult.value.tradeMax;
      order.royaltyFactor = callResult.value.royaltyFactor;

      for (let i = 0; i < order.tokenIds!.length; i += 1) {
        const nftId = tokenAddress.concat("-").concat(order.tokenIds![i].toString());
        const nft = NFT.load(nftId);
        if (nft) {
          nft.lastRoyaltyFactor = order.royaltyFactor;
          if (nft.orders) {
            const orders = nft.orders;
            if ((nft.orders!.indexOf(order.id))== -1) {
              nft.orders = orders!.concat([order.id]);
            }
          } else {
            nft.orders = [order.id];
          }
          nft.save();
        } else {
          const nft = new NFT(nftId);
          nft.lastSeller = ZERO_ADDRESS.toHexString();
          nft.lastOrderIndex = event.params.orderIndex;
          nft.lastRoyaltyFactor = ZERO;
          nft.lastBuyer = ZERO_ADDRESS.toHexString();
          nft.lastSalePrice = ZERO;
          nft.lastTradeIndex = null;
          nft.token = token.id;
          nft.tokenId = order.tokenIds![i];
          nft.totalVolume = ZERO;
          nft.tradeCount = ZERO;
          const orders = nft.orders;
          nft.orders = nft.orders ? orders!.concat([order.id]) : [order.id];
          nft.save();
        }
      }
    }
  }

  token.save();
   order.save();
}

export function handleOrderExecuted(event: OrderExecuted): void {
  const tokenAddress = event.params.token.toHexString();
  let orderId = tokenAddress.concat("-").concat(event.params.orderIndex.toString());

  let order = Order.load(orderId);
  if(order == null){
    log.info('Missing order', []);
    return;
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
       if(orders) {
         orders.push(order.id);
       }
       trade.orders = orders;
       trade.save();

       const trades = order.trades;
       if(trades) {
         trades.push(trade.id);
       }
       order.trades = trades;
       order.save();
  }

   let token = Token.load(tokenAddress);
   if(token){
      // Sync up token
      let tokenResult = nixContract.try_tokens(event.params.token);

      if (tokenResult.reverted) {
          log.info('get token reverted', []);
       } else {
          token.executed = tokenResult.value.value1;
          token.volumeToken = tokenResult.value.value2;
          token.volumeErc20 = tokenResult.value.value3;
      }
      token.save();
   }

   // TODO add to the smart contract so that we filter which token ids are being taken
   // THIS ONLY WILL WORK FOR ALL ORDERS
   for (let i = 0; i < order.tokenIds!.length; i += 1) {
     const nftId = tokenAddress.concat("-").concat(order.tokenIds![i].toString());
     const nft = NFT.load(nftId);
     if(nft){
       nft.tradeCount = nft.tradeCount!.plus(ONE);
        for (let i = 0; i < trade.orders!.length; i += 1) {
          const nftOrder = Order.load(trade.orders![i]);
          if(nftOrder){
            let salePriceNft = nftOrder.price!.div(BigInt.fromI32(nftOrder.tokenIds!.length));
            nft.lastSalePrice = salePriceNft;
            nft.totalVolume = nft.totalVolume!.plus(salePriceNft);
            nft.lastOrderIndex = nftOrder.orderIndex;
            nft.lastRoyaltyFactor = nftOrder.royaltyFactor;
            nft.lastTradeIndex = tradeId;
            const trades = nft.trades;
            nft.trades = trades ? trades.concat([trade.id]) : [trade.id];

            let erc721Contract = ERC721Contract.bind(event.params.token);
             let ownerResult = erc721Contract.try_ownerOf(nft.tokenId);
                  if (ownerResult.reverted) {
                    log.info('get token ownerResult reverted {}', [nft.tokenId.toString()]);
                  } else {
                    nft.lastBuyer = ownerResult.value.toHexString();
                  }
             if(order.buyOrSell == "Buy"){
                 nft.lastSeller = event.transaction.from.toHexString();
             } else {
                nft.lastSeller = nftOrder.maker;
             }
          }
        }
        nft.lastTradeIndex = tradeId;

        nft.save()
     }
   }

}

export function handleTip(event: ThankYou): void {
  let globalStat = loadOrCreateGlobalStat();
  let newTip = ZERO;
  if(globalStat.tipLifetimeAccumulatedInWei) {
    newTip = globalStat.tipLifetimeAccumulatedInWei!;
  }
  if(newTip) {
    globalStat.tipLifetimeAccumulatedInWei = newTip.plus(event.params.tip);
  }
  globalStat.save();
}



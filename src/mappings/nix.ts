/* eslint-disable prefer-const */
import { BigInt, BigDecimal, store, Address, log } from '@graphprotocol/graph-ts'
import {
  Order,
  Token
} from '../../generated/schema'
import { OrderAdded, Nix as NixContract } from '../../generated/Nix/Nix'
import { ERC721 as ERC721Contract } from '../../generated/Nix/ERC721'

//const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function handleOrderAdded(event: OrderAdded): void {
  // Add the token info
 let token = Token.load(event.params.token.toHexString());
  if(token == null){
    token = new Token(event.params.token.toHexString());
    token.executed = null;
    token.orderIndexes = null;
    token.volumeErc20 = null;
    token.volumeToken = null;
    token.name = null;
    token.symbol = null;
  }
  let orderId = event.params.token.toHexString().concat("-").concat(event.params.orderIndex.toString());
  let nixContract = NixContract.bind(event.address);

  let order = new Order(orderId);
  order.token = token.id;

  let callResult = nixContract.try_getOrder(event.params.token, event.params.orderIndex);
    if (callResult.reverted) {
      log.info('get order reverted', []);
        order.expiry = null;
        order.maker = null;
        order.orderIndex = null;
        order.buyOrSell = null;
        order.anyOrAll = null;
        order.price = null;
        order.taker = null;
        order.tokenIds = null;
        order.tradeCount = null;
        order.tradeMax = null;
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

}


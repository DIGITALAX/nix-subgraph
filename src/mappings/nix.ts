/* eslint-disable prefer-const */
import { BigInt, BigDecimal, store, Address } from '@graphprotocol/graph-ts'
import {
  Order,
  Token
} from '../../generated/schema'
import { OrderAdded, Nix as NixContract } from '../../generated/Nix/Nix'

//const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function handleOrderAdded(event: OrderAdded): void {
  // Add the token info
 let token = Token.load(event.params.token.toHexString());
  if(token == null){
    token = new Token(event.params.token.toHexString());
    token.executed = null;
    token.orderIndexes = null;
    token.orders = null;
    token.volumeErc20 = null;
    token.volumeToken = null;
  }
  const orderId = event.params.token.toHexString().concat("-").concat(event.params.orderIndex.toString());
 // let nixContract = NixContract.bind(event.params.token);

  let order = new Order(orderId);

  order.token = token.id;
  order.expiry = null;
  order.maker = null;
  order.orderIndex = null;
  order.orderType = null;
  order.orderTypeString = null;
  order.price = null;
  order.taker = null;
  order.tokenIds = null;
  order.tradeCount = null;
  order.tradeMax = null;

  order.save();
  token.save();

}


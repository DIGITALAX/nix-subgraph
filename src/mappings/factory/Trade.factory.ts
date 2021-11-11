import {ZERO} from "../constants";
import { Trade } from '../../../generated/schema'

export function loadOrCreateTrade(id: string): Trade | null {
    let trade = Trade.load(id);

    if (trade == null) {
        trade = new Trade(id);
        trade.blockNumber = ZERO;
        trade.orders = new Array<string>();
        trade.uniqueAddresses = new Array<string>();
        trade.royaltyFactor = ZERO;
        trade.save();
    }

    return trade;
}

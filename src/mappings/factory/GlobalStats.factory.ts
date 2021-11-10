import {ZERO} from "../constants";
import { GlobalStats } from '../../../generated/schema'

export function loadOrCreateGlobalStats(): GlobalStats | null {
    let globalStats = GlobalStats.load('1');

    if (globalStats == null) {
        globalStats = new GlobalStats('1');
        globalStats.tipLifetimeAccumulatedInWei = ZERO;
        globalStats.numberOfOrdersAdded = ZERO;
        globalStats.numberOfTradesExecuted = ZERO;
        globalStats.save();
    }

    return globalStats;
}

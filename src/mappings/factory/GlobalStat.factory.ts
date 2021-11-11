import {ZERO} from "../constants";
import { GlobalStat } from '../../../generated/schema'

export function loadOrCreateGlobalStat(): GlobalStat {
    let globalStat = GlobalStat.load('1');

    if (globalStat == null) {
        globalStat = new GlobalStat('1');
        globalStat.tipLifetimeAccumulatedInWei = ZERO;
        globalStat.numberOfOrdersAdded = ZERO;
        globalStat.numberOfTradesExecuted = ZERO;
        globalStat.save();
    }

    return globalStat;
}

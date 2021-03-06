import Sampler from './Sampler';
import ConfigProvider from '../config/ConfigProvider';
import ConfigNames from '../config/ConfigNames';

const koalas = require('koalas');

/**
 * Count based {@link Sampler} implementation
 * which allows sampling for every specified count period
 */
class CountAwareSampler implements Sampler<null> {

    private countFreq: number;
    private counter: number;

    constructor(countFreq?: number) {
        this.countFreq = ConfigProvider.get<number>(
            ConfigNames.THUNDRA_SAMPLER_COUNTAWARE_COUNTFREQ,
            koalas(countFreq, undefined)); // if countFreq is not valid, it passes undefined to get the default value
        this.counter = 0;
    }

    /**
     * @inheritDoc
     */
    isSampled(): boolean {
        const result = this.counter % this.countFreq === 0;
        this.counter++;
        return result;
    }

}

export default CountAwareSampler;

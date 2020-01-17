import TraceConfig from './TraceConfig';
import MetricConfig from './MetricConfig';
import InvocationConfig from './InvocationConfig';
import { TIMEOUT_MARGIN, envVariableKeys } from '../../Constants';
import LogConfig from './LogConfig';
import Utils from '../utils/Utils';
import AwsXRayConfig from './AwsXRayConfig';
const koalas = require('koalas');

class ThundraConfig {
    static extraConfig: any = {};

    initialConfig: any;
    trustAllCert: boolean;
    warmupAware: boolean;
    apiKey: string;
    disableThundra: boolean;
    traceConfig: TraceConfig;
    metricConfig: MetricConfig;
    invocationConfig: InvocationConfig;
    logConfig: LogConfig;
    xrayConfig: AwsXRayConfig;
    timeoutMargin: number;
    sampleTimedOutInvocations: boolean;
    enableCompositeData: boolean;

    constructor(options: any) {
        this.initialConfig = options ? options : {};
        this.setConfig(this.initialConfig);
    }

    static updateConfig(options: any) {
        const extraConfig = ThundraConfig.extraConfig;
        ThundraConfig.extraConfig = {...extraConfig, ...options};
    }

    refreshConfig() {
        // No extraKeys, no need to update the initialConfig
        if (Object.keys(ThundraConfig.extraConfig).length === 0) {
            return;
        }

        const extraConfig = ThundraConfig.extraConfig;
        const initialConfig = this.initialConfig;
        const finalConfig = {...initialConfig, ...extraConfig};

        this.setConfig(finalConfig);
    }

    setConfig(options: any) {
        this.apiKey = koalas(Utils.getConfiguration(envVariableKeys.THUNDRA_APIKEY), options.apiKey, null);
        this.disableThundra = Utils.getConfiguration(envVariableKeys.THUNDRA_DISABLE)
            ? Utils.getConfiguration(envVariableKeys.THUNDRA_DISABLE) === 'true'
            : options.disableThundra;
        this.timeoutMargin = koalas(parseInt(Utils.getConfiguration(envVariableKeys.THUNDRA_LAMBDA_TIMEOUT_MARGIN), 10),
            options.timeoutMargin, TIMEOUT_MARGIN);
        this.traceConfig = new TraceConfig(options.traceConfig);
        this.metricConfig = new MetricConfig(options.metricConfig);
        this.logConfig = new LogConfig(options.logConfig);
        this.invocationConfig = new InvocationConfig(options.invocationConfig);
        this.xrayConfig = new AwsXRayConfig(options.xrayConfig);

        this.trustAllCert = koalas(options.trustAllCert, false);

        this.warmupAware = Utils.getConfiguration(envVariableKeys.THUNDRA_LAMBDA_WARMUP_AWARE)
            ? Utils.getConfiguration(envVariableKeys.THUNDRA_LAMBDA_WARMUP_AWARE) === 'true'
            : options.warmupAware;

        this.sampleTimedOutInvocations = Utils.getConfiguration(envVariableKeys.THUNDRA_AGENT_LAMBDA_SAMPLE_TIMED_OUT_INVOCATIONS)
            ? Utils.getConfiguration(envVariableKeys.THUNDRA_AGENT_LAMBDA_SAMPLE_TIMED_OUT_INVOCATIONS) === 'true'
            : options.sampleTimedOutInvocations;

        this.enableCompositeData = Utils.getConfiguration(envVariableKeys.THUNDRA_LAMBDA_REPORT_REST_COMPOSITE_ENABLED)
            ? Utils.getConfiguration(envVariableKeys.THUNDRA_LAMBDA_REPORT_REST_COMPOSITE_ENABLED) === 'true'
            : options.enableCompositeData;
    }
}

export default ThundraConfig;

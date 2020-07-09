/*
*
* Calculates duration of the lambda handler function.
*
* Generates trace report data.
*
* Adds the trace report to the Reporter instance if async monitoring is not enabled (environment variable
* thundra_lambda_publish_cloudwatch_enable is not set), otherwise it logs the report for async monitoring.
*
*/

import Utils from './utils/Utils';
import TraceConfig from './config/TraceConfig';
import MonitoringDataType from './data/base/MonitoringDataType';
import ThundraSpan from '../opentracing/Span';
import SpanData from './data/trace/SpanData';
import PluginContext from './PluginContext';
import {
    INTEGRATIONS,
} from '../Constants';
import ThundraLogger from '../ThundraLogger';
import Integration from './integrations/Integration';
import Instrumenter from '../opentracing/instrument/Instrumenter';
import ConfigProvider from '../config/ConfigProvider';
import ConfigNames from '../config/ConfigNames';

const get = require('lodash.get');

export default class Trace {
    hooks: { 'before-invocation': (pluginContext: PluginContext) => void;
            'after-invocation': (pluginContext: PluginContext) => void; };
    config: TraceConfig;
    pluginOrder: number = 1;
    contextKey: string = 'traceData';
    pluginContext: PluginContext;
    integrationsMap: Map<string, Integration>;
    instrumenter: Instrumenter;

    constructor(config: TraceConfig) {
        this.hooks = {
            'before-invocation': this.beforeInvocation,
            'after-invocation': this.afterInvocation,
        };

        this.config = config;
        this.initIntegrations();
        /*
        initGlobalTracer(this.tracer);
        Utils.registerSpanListenersFromConfigurations(this.tracer);
        */
    }

    initIntegrations(): void {
        if (!(this.config.disableInstrumentation || ConfigProvider.get<boolean>(ConfigNames.THUNDRA_TRACE_DISABLE))) {
            this.integrationsMap = new Map<string, Integration>();

            for (const key of Object.keys(INTEGRATIONS)) {
                const clazz = INTEGRATIONS[key];
                if (clazz) {
                    if (!this.integrationsMap.get(key)) {
                        if (!this.config.isConfigDisabled(key)) {
                            const instance = new clazz(this.config);
                            this.integrationsMap.set(key, instance);
                        }
                    }
                }
            }

            this.instrumenter = new Instrumenter(this.config);
            this.instrumenter.hookModuleCompile();
        }
    }

    setPluginContext = (pluginContext: PluginContext) => {
        this.pluginContext = pluginContext;
    }

    report(data: any, execContext: any): void {
        const reports = get(execContext, 'reports', []);
        execContext.reports = [...reports, data];
    }

    beforeInvocation = (execContext: any) => {
        this.destroy();

        const { executor } = this.pluginContext;

        if (executor) {
            executor.startExecution(this.pluginContext, execContext);
        }
    }

    afterInvocation = (execContext: any) => {
        const { apiKey, executor } = this.pluginContext;
        const { tracer, rootSpan } = execContext;

        if (executor) {
            executor.finishExecution(this.pluginContext, execContext);
        }

        const spanList = tracer.getRecorder().getSpanList();
        const isSampled = get(this.config, 'sampler.isSampled', () => true);
        const sampled = isSampled(rootSpan);

        if (sampled) {
            for (const span of spanList) {
                if (span) {
                    if (this.config.runSamplerOnEachSpan && !isSampled(span)) {
                        ThundraLogger.debug(
                            `Filtering span with name ${span.getOperationName()} due to custom sampling configuration`);
                        continue;
                    }

                    const spanData = this.buildSpanData(span, execContext);
                    const spanReportData = Utils.generateReport(spanData, apiKey);
                    this.report(spanReportData, execContext);
                }
            }
        }

        this.destroy();
    }

    buildSpanData(span: ThundraSpan, execContext: any): SpanData {
        const spanData = Utils.initMonitoringData(this.pluginContext, MonitoringDataType.SPAN) as SpanData;

        spanData.id = span.spanContext.spanId;
        spanData.traceId = execContext.traceId;
        spanData.transactionId = execContext.transactionId;
        spanData.parentSpanId = span.spanContext.parentId;
        spanData.spanOrder = span.order;
        spanData.domainName = span.domainName ? span.domainName : '';
        spanData.className = span.className ? span.className : '';
        spanData.serviceName = execContext.rootSpan.operationName;
        spanData.operationName = span.operationName;
        spanData.startTimestamp = span.startTime;
        spanData.duration = span.getDuration();
        spanData.finishTimestamp = span.finishTime;
        spanData.tags = span.tags;
        spanData.logs = span.logs;

        return spanData;
    }

    destroy(): void {
        /*
        if (this.config && !(this.config.disableInstrumentation)) {
            this.tracer.destroy();
            if (typeof this.instrumenter.unhookModuleCompile === 'function') {
                this.instrumenter.unhookModuleCompile();
            }
        }
        this.triggerClassName = undefined;
        */
    }
}

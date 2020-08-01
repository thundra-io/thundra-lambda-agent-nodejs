import * as os from 'os';
import { execSync } from 'child_process';
import MetricData from './data/metric/MetricData';
import Utils from '../utils/Utils';
import ThreadMetric from './data/metric/ThreadMetric';
import MemoryMetric from './data/metric/MemoryMetric';
import IOMetric from './data/metric/IOMetric';
import CPUMetric from './data/metric/CPUMetric';
import MetricConfig from './config/MetricConfig';
import MonitoringDataType from './data/base/MonitoringDataType';
import PluginContext from './PluginContext';
import ThundraLogger from '../ThundraLogger';
import ExecutionContext from '../context/ExecutionContext';

const get = require('lodash.get');

export default class Metric {
    hooks: { 'before-invocation': (execContext: ExecutionContext) => Promise<void>;
            'after-invocation': (execContext: ExecutionContext) => Promise<void>; };
    config: MetricConfig;
    baseMetricData: MetricData;
    pluginOrder: number = 2;
    pluginContext: PluginContext;
    clockTick: number;

    constructor(config: MetricConfig) {
        this.hooks = {
            'before-invocation': this.beforeInvocation,
            'after-invocation': this.afterInvocation,
        };
        this.config = config;
        this.clockTick = parseInt(execSync('getconf CLK_TCK').toString(), 0);
    }

    setPluginContext = (pluginContext: PluginContext) => {
        this.pluginContext = pluginContext;
        this.baseMetricData = Utils.initMonitoringData(this.pluginContext, MonitoringDataType.METRIC) as MetricData;
    }

    beforeInvocation = async (execContext: ExecutionContext) => {
        const sampler = get(this.config, 'sampler', { isSampled: () => true });
        const sampled = sampler.isSampled();

        const { metrics } = execContext;
        metrics.sampled = sampled;

        if (sampled) {
            const [procMetric, procIo] = await Promise.all([Utils.readProcMetricPromise(), Utils.readProcIoPromise()]);

            metrics.initialProcMetric = procMetric;
            metrics.initialProcIo = procIo;
            metrics.startCpuUsage = Utils.getCpuUsage();
        }
    }

    afterInvocation = async (execContext: ExecutionContext) => {
        const { metrics } = execContext;
        if (metrics.sampled) {
            const { apiKey, maxMemory } = this.pluginContext;

            await Promise.all([
                this.addThreadMetricReport(execContext, apiKey),
                this.addMemoryMetricReport(execContext, apiKey, maxMemory),
                this.addCpuMetricReport(execContext, apiKey),
                this.addIoMetricReport(execContext, apiKey),
            ]).catch((err: Error) => {
                ThundraLogger.error('Cannot obtain metric data :' + err);
            });
        }
    }

    addThreadMetricReport = async (execContext: ExecutionContext, apiKey: string) => {
        const { metrics } = execContext;
        const { spanId, traceId, transactionId } = execContext;
        const { threadCount } = metrics.initialProcMetric;

        const threadMetric = new ThreadMetric();
        threadMetric.initWithMetricMonitoringDataValues(this.baseMetricData, traceId, transactionId, spanId);
        threadMetric.id = Utils.generateId();
        threadMetric.metricTimestamp = Date.now();

        threadMetric.metrics = {
            'app.threadCount': threadCount,
        };

        const threadMetricReport = Utils.generateReport(threadMetric, apiKey);
        execContext.report(threadMetricReport);
    }

    addMemoryMetricReport = async (execContext: ExecutionContext, apiKey: string, maxMemory: number) => {
        const { spanId, traceId, transactionId } = execContext;
        const { rss, heapUsed, external } = process.memoryUsage();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();

        const memoryMetric = new MemoryMetric();
        memoryMetric.initWithMetricMonitoringDataValues(this.baseMetricData, traceId, transactionId, spanId);
        memoryMetric.id = Utils.generateId();
        memoryMetric.metricTimestamp = Date.now();

        memoryMetric.metrics = {
            'app.maxMemory': maxMemory * 1024 * 1024,
            'app.usedMemory': heapUsed,
            'app.rss': rss,
            'sys.maxMemory': totalMemory,
            'sys.usedMemory': totalMemory - freeMemory,
            'sys.external': external,
            'sys.freeMemory': freeMemory,
        };

        const memoryMetricReport = Utils.generateReport(memoryMetric, apiKey);
        execContext.report(memoryMetricReport);
    }

    addCpuMetricReport = async (execContext: ExecutionContext, apiKey: string) => {
        const { metrics, spanId, traceId, transactionId } = execContext;
        const endCpuUsage = Utils.getCpuUsage();
        const cpuLoad = Utils.getCpuLoad(metrics.startCpuUsage, endCpuUsage, this.clockTick);

        const cpuMetric = new CPUMetric();
        cpuMetric.initWithMetricMonitoringDataValues(this.baseMetricData, traceId, transactionId, spanId);
        cpuMetric.id = Utils.generateId();
        cpuMetric.metricTimestamp = Date.now();

        cpuMetric.metrics = {
            'app.cpuLoad': cpuLoad.procCpuLoad,
            'sys.cpuLoad': cpuLoad.sysCpuLoad,
        };

        const cpuMetricReport = Utils.generateReport(cpuMetric, apiKey);
        execContext.report(cpuMetricReport);
    }

    addIoMetricReport = async (execContext: ExecutionContext, apiKey: string) => {
        const { metrics, spanId, traceId, transactionId } = execContext;
        const startProcIo = metrics.initialProcIo;
        const endProcIo: any = await Utils.readProcIoPromise();

        const ioMetric = new IOMetric();
        ioMetric.initWithMetricMonitoringDataValues(this.baseMetricData, traceId, transactionId, spanId);
        ioMetric.id = Utils.generateId();
        ioMetric.metricTimestamp = Date.now();

        ioMetric.metrics = {
            'sys.diskReadBytes': endProcIo.readBytes - startProcIo.readBytes,
            'sys.diskWriteBytes': endProcIo.writeBytes - startProcIo.writeBytes,
        };

        const ioMetricReport = Utils.generateReport(ioMetric, apiKey);
        execContext.report(ioMetricReport);
    }
}

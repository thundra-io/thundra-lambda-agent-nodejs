import ThundraLogger from '../../ThundraLogger';
import Resource from '../data/invocation/Resource';
import ThundraSpan from '../../opentracing/Span';
import { SpanTags } from '../../Constants';
import ExecutionContextManager from '../../context/ExecutionContextManager';
const flatten = require('lodash.flatten');

/**
 * Provides/supports API for invocation tracing related operations
 */
class InvocationTraceSupport {

    private constructor() {
    }

    /**
     * Gets {@link Resource}s in the current invocation
     * @param {string} rootSpanId id of the root span
     * @return {Resource[]} the {@link Resource}s in the current invocation
     */
    static getResources(rootSpanId: string = ''): Resource[] {
        try {
            const { tracer } = ExecutionContextManager.get();

            if (!tracer) {
                return undefined;
            }

            const resourcesMap: Map<string, Resource> = new Map<string, Resource>();
            const spans = tracer.getSpanList().
                            filter((span: ThundraSpan) => span.getTag(SpanTags.TOPOLOGY_VERTEX)).
                            filter((span: ThundraSpan) => span.spanContext.spanId !== rootSpanId);

            for (const span of spans) {
                const resourceNames = span.getTag(SpanTags.RESOURCE_NAMES);
                if (resourceNames) {
                    for (const resourceName of resourceNames) {
                        const resourceId = InvocationTraceSupport.generateResourceIdFromSpan(span, resourceName);
                        if (resourceId) {
                            const resource = resourcesMap.get(resourceId);
                            const newResource = new Resource();
                            newResource.init(span);
                            newResource.resourceName = resourceName;
                            resource ? resource.merge(newResource) : resourcesMap.set(resourceId, newResource);
                        }
                    }
                } else {
                    const resourceId = InvocationTraceSupport.generateResourceIdFromSpan(span);
                    if (resourceId) {
                        const resource = resourcesMap.get(resourceId);
                        const newResource = new Resource();
                        newResource.init(span);
                        resource ? resource.merge(newResource) : resourcesMap.set(resourceId, newResource);
                    }
                }
            }

            return Array.from(resourcesMap.values());
        } catch (e) {
            ThundraLogger.error(
                `<InvocationTraceSupport> Error while creating the resources data for invocation:`, e);
        }
    }

    /**
     * Gets the active {@link ThundraSpan} for the current invocation
     * @return {ThundraSpan} the active {@link ThundraSpan} for the current invocation
     */
    static getActiveSpan(): ThundraSpan {
        const { tracer } = ExecutionContextManager.get();

        if (!tracer) {
            return undefined;
        }

        return tracer.getActiveSpan();
    }

    /**
     * Adds the incoming trace link for the invocation
     * @param {string} traceLink the incoming trace link to be added
     */
    static addIncomingTraceLink(traceLink: string): void {
        const { incomingTraceLinks } = ExecutionContextManager.get();
        if (incomingTraceLinks) {
            incomingTraceLinks.push(traceLink);
        }
    }

    /**
     * Adds the incoming trace links for the invocation
     * @param {string[]} traceLinks the incoming trace links to be added
     */
    static addIncomingTraceLinks(traceLinks: string[]): void {
        const { incomingTraceLinks } = ExecutionContextManager.get();
        if (incomingTraceLinks) {
            incomingTraceLinks.push(...traceLinks);
        }
    }

    /**
     * Gets the incoming trace links for the invocation
     * @return {string[]} the incoming trace links
     */
    static getIncomingTraceLinks(): string[] {
        const { incomingTraceLinks } = ExecutionContextManager.get();
        if (!incomingTraceLinks) {
            return [];
        }
        return [...new Set(incomingTraceLinks)].filter((e) => e);
    }

    /**
     * Adds the outgoing trace link for the invocation
     * @param {string} traceLink the outgoing trace link to be added
     */
    static addOutgoingTraceLink(traceLink: string): void {
        const { outgoingTraceLinks } = ExecutionContextManager.get();
        if (outgoingTraceLinks) {
            outgoingTraceLinks.push(traceLink);
        }
    }

    /**
     * Adds the outgoing trace links for the invocation
     * @param {string[]} traceLinks the outgoing trace links to be added
     */
    static addOutgoingTraceLinks(traceLinks: string[]): void {
        const { outgoingTraceLinks } = ExecutionContextManager.get();
        if (outgoingTraceLinks) {
            outgoingTraceLinks.push(...traceLinks);
        }
    }

    /**
     * Gets the outgoing trace links for the invocation
     * @return {string[]} the outgoing trace links
     */
    static getOutgoingTraceLinks(): string[] {
        const { tracer, outgoingTraceLinks } = ExecutionContextManager.get();

        if (!tracer) {
            return [];
        }

        try {
            const spans = tracer.getSpanList();
            const traceLinks = flatten(
                spans.filter((span: ThundraSpan) => span.getTag(SpanTags.TRACE_LINKS))
                    .map((span: ThundraSpan) => span.getTag(SpanTags.TRACE_LINKS)),
            );
            if (outgoingTraceLinks) {
                traceLinks.push(...outgoingTraceLinks);
            }
            return [...new Set<string>(traceLinks)];
        } catch (e) {
            ThundraLogger.error(
                `<InvocationTraceSupport> Error while getting the outgoing trace links for invocation:`, e);
        }
    }

    private static generateResourceIdFromSpan(span: ThundraSpan, resourceName?: string): string {
        if (span.className && span.operationName) {
            if (!resourceName) {
                resourceName = span.operationName;
            }
            let id = `${span.className.toUpperCase()}\$${resourceName}`;
            if (span.getTag(SpanTags.OPERATION_TYPE)) {
                id = id + `\$${span.getTag(SpanTags.OPERATION_TYPE)}`;
            }
            return id;
        }
    }

}

export default InvocationTraceSupport;

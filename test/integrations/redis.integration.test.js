import RedisIntegration from '../../dist/integrations/RedisIntegration';
import ThundraTracer from '../../dist/opentracing/Tracer';
import Redis from './utils/redis.integration.utils';
import ExecutionContextManager from '../../dist/context/ExecutionContextManager';
import ExecutionContext from '../../dist/context/ExecutionContext';

describe('Redis integration', () => {
    let tracer;
    let integration;

    beforeAll(() => {
        tracer = new ThundraTracer();
        ExecutionContextManager.set(new ExecutionContext({ tracer }));
        integration = new RedisIntegration();
    });

    afterEach(() => {
        tracer.destroy();
    });

    test('should instrument Redis calls ', () => {
        const sdk = require('redis');

        return Redis.set(sdk).then((data) => {
            const spanList = tracer.getRecorder().spanList;

            let writeCommandSpan;
            for (const span of spanList) {
                if (span.tags['redis.command.type'] === 'WRITE') {
                    writeCommandSpan = span;
                }
            }

            expect(spanList.length).toBe(4);

            expect(writeCommandSpan.className).toBe('Redis');
            expect(writeCommandSpan.domainName).toBe('Cache');

            expect(writeCommandSpan.tags['operation.type']).toBe('WRITE');
            expect(writeCommandSpan.tags['db.type']).toBe('redis');
            expect(writeCommandSpan.tags['db.instance']).toBe('127.0.0.1');
            expect(writeCommandSpan.tags['db.statement.type']).toBe('WRITE');
            expect(writeCommandSpan.tags['redis.host']).toBe('127.0.0.1');
            expect(writeCommandSpan.tags['redis.port']).toBe('6379');
            expect(writeCommandSpan.tags['redis.command']).toBe('SET');
            expect(writeCommandSpan.tags['redis.command.type']).toBe('WRITE');
            expect(writeCommandSpan.tags['redis.command.args']).toBe('string key,string val');
            expect(writeCommandSpan.tags['topology.vertex']).toEqual(true);
        });
    });
});

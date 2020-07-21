import ExecutionContext from './ExecutionContext';

let contextProvider = require('./globalContextProvider');

export default class ExecutionContextManager {
    static runWithContext(createExecContext: Function, fn: Function) {
        return contextProvider.runWithContext(createExecContext, fn);
    }

    static get(): ExecutionContext {
        return contextProvider.get();
    }

    static set(execCtx: ExecutionContext) {
        return contextProvider.set(execCtx);
    }

    static init() {
        contextProvider.init();
    }

    static setProvider(provider: any) {
        contextProvider = provider;
    }
}

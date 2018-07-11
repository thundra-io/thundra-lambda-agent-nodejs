/*
*
* Wraps the lambda handler function.
*
* Implemented in Hook & Plugin structure. Runs plugins' related functions by executing hooks.
*
* Wraps the original callback and context.
* 
* invoke function calls the original lambda handler with original event, wrapped context and wrapped callback.
* 
* Wrapped context methods (done, succeed, fail) and callback call report function.
* 
* report function uses the Reporter instance to make a single request to send reports if async monitoring is
* not enabled (environment variable thundra_lambda_publish_cloudwatch_enable is not set). After reporting it calls
* original callback/succeed/done/fail.
* 
*/

import uuidv4 from 'uuid/v4';
import Reporter from './reporter';
import {TimeoutError} from './constants';

class ThundraWrapper {
    constructor(self, event, context, callback, func, plugins, pluginContext, apiKey) {
        this.originalThis = self;
        this.originalEvent = event;
        this.originalContext = context;
        this.originalCallback = callback;
        this.originalFunction = func;
        this.plugins = plugins;
        this.pluginContext = pluginContext;
        this.apiKey = apiKey;
        this.reported = false;
        this.reporter = new Reporter(apiKey);
        this.wrappedContext = {
            ...context,
            done: (error, result) => {
                this.report(error, result, () => {
                    this.originalContext.done(error, result)
                });
            },
            succeed: (result) => {
                this.report(null, result, () => {
                    this.originalContext.succeed(result)
                });
            },
            fail: (error) => {
                this.report(error, null, () => {
                    this.originalContext.fail(error)
                });
            }
        };

           this.timeout = this.setupTimeoutHandler(this);
    }


    wrappedCallback = (error, result) => {
        this.report(error, result, () => {
                if (typeof this.originalCallback === 'function') {
                    this.originalCallback(error, result);
                }
            }
        );
    };

    invoke() {
        const beforeInvocationData = {
            originalContext: this.originalContext,
            originalEvent: this.originalEvent,
            reporter: this.reporter,
            contextId: uuidv4(),
            transactionId: uuidv4()
        };

        this.executeHook('before-invocation', beforeInvocationData)
            .then(() => {
                this.pluginContext.requestCount += 1;
                try {
                    return this.originalFunction.call(
                        this.originalThis,
                        this.originalEvent,
                        this.wrappedContext,
                        this.wrappedCallback
                    );
                } catch (error) {
                    this.report(error, null);
                    return error;
                }
            });
    }

    async executeHook(hook, data) {
        await Promise.all(
            this.plugins.map(async plugin => {
                if (plugin.hooks && plugin.hooks[hook]) {
                    return plugin.hooks[hook](data);
                }
            })
        );
    }

    async report(error, result, callback) {
        if (!this.reported) {
            this.reported = true;

            let afterInvocationData = {
                error: error,
                response: result
            };

            if (this.isErrorResponse(result)) {
                afterInvocationData = {
                    error: new Error("Lambda returned with error response."),
                    response: null
                };
            }

            await this.executeHook('after-invocation', afterInvocationData);
            if (process.env.thundra_lambda_publish_cloudwatch_enable !== 'true') {
                await this.reporter.sendReports();
            }
            
            if (this.timeout) {
                clearTimeout(this.timeout);
            }

            if (typeof callback === 'function') {
                callback();
            }
        }
    }

    isErrorResponse(result) {
        let isError = false;
        if (this.isValidResponse(result) && typeof result['body'] === 'string') {
            const statusCode = result.statusCode.toString();
            if (statusCode.startsWith('4') || statusCode.startsWith('5')) {
                isError = true;
            } 
        } else if (this.isValidResponse(result)) {
            isError = true;
        }
        return isError;
    }

    isValidResponse(response) {
        if (!response) {
            return false;
        }
        return response['statusCode'] && typeof response['statusCode']  == 'number' && response['body'] ;
    }

    setupTimeoutHandler(wrapperInstance) {
        const { originalContext, pluginContext } = wrapperInstance;
        const { getRemainingTimeInMillis = () => 0 } = originalContext;
    
        if (pluginContext.timeoutMargin < 1 || getRemainingTimeInMillis() < 10) {
          return undefined;
        }
        const maxEndTime = 299900;
        const configEndTime = Math.max(
          0,
          getRemainingTimeInMillis() - pluginContext.timeoutMargin,
        );
    
        const endTime = Math.min(configEndTime, maxEndTime);
        return setTimeout(() => {
          wrapperInstance.report(new TimeoutError(99, 'Lambda Timeout Exceeded.'), null, null);
        }, endTime);
    }
}

export default ThundraWrapper;



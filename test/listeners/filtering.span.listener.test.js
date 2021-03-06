import FilteringSpanListener from '../../dist/listeners/FilteringSpanListener';
import ErrorInjectorSpanListener from '../../dist/listeners/ErrorInjectorSpanListener';
import StandardSpanFilterer from '../../dist/listeners/StandardSpanFilterer';
import StandardSpanFilter from '../../dist/listeners/StandardSpanFilter';
import ThundraSpan from '../../dist/opentracing/Span';

describe('filtering span listener', () => {
    it('should call function callback if filter matches and not call if it does not', () => {
        // Arrange
        const filteringListener = new FilteringSpanListener();

        filteringListener.listener = new ErrorInjectorSpanListener();

        filteringListener.spanFilterer = new StandardSpanFilterer();

        const filter =  new StandardSpanFilter();
        filter.className = 'HTTP';
        filteringListener.spanFilterer.addFilter(filter);

        const matchingSpan = new ThundraSpan();
        matchingSpan.className = 'HTTP';
        const matchingCallback = jest.fn();

        const nonMatchingSpan = new ThundraSpan();
        nonMatchingSpan.className = 'AWS-SQS';
        const nonMatchingCallback = jest.fn();
        
        //Act
        filteringListener.onSpanInitialized(matchingSpan, this, matchingCallback, [2, 'value']);
        const callbackCalled = filteringListener.onSpanInitialized(nonMatchingSpan, this, nonMatchingCallback, [2, 'value']);
        
        // Assert
        expect(matchingCallback).toBeCalledWith(new Error(filteringListener.listener.DEFAULT_ERROR_MESSAGE));
        expect(callbackCalled).toBe(false);
    });
});

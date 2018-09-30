import ThundraSpan, { SpanEvent } from './Span';
import SpanTreeNode from './SpanTree';
import Stack from './instrument/Stack';

class ThundraRecorder {
    private activeSpan: ThundraSpan;
    private activeSpanStack: Stack<ThundraSpan>;
    private spanList: ThundraSpan[];
    private spanOrder = 1;

    constructor() {
        this.activeSpanStack = new Stack<ThundraSpan>();
        this.spanList = [];
    }

    record(node: ThundraSpan, spanEvent: SpanEvent): void {
        if (spanEvent === SpanEvent.SPAN_START) {
            this.activeSpanStack.push(node);
            this.activeSpan = node;
            node.order = this.spanOrder;
            this.spanOrder++;
        } else if (spanEvent === SpanEvent.SPAN_FINISH) {
            this.activeSpan =  this.activeSpanStack.pop();
            this.spanList.push(node);
        }
    }

    getSpanList(): ThundraSpan[] {
        return this.spanList;
    }

    getActiveSpan(): ThundraSpan {
        return this.activeSpan;
    }

    destroy() {
        this.activeSpanStack.clear();
        this.spanList = [];
        this.spanOrder = 1;
    }
}

export default ThundraRecorder;

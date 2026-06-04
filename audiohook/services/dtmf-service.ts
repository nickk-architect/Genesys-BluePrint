import EventEmitter from 'events';

export class DTMFService {
    private emitter = new EventEmitter();
    private state = 'None';
    private digits = '';

    on(event: string, listener: (...args: any[]) => void): DTMFService { this.emitter?.addListener(event, listener); return this; }
    getState(): string { return this.state; }

    processDigit(digit: string): DTMFService {
        if (this.state === 'Complete') { this.emitter.emit('error', 'DTMF digits already received.'); return this; }
        this.state = 'Processing';
        if (digit === '#') {
            this.state = 'Complete';
            this.emitter.emit('final-digits', this.digits);
            this.digits = '';
            return this;
        }
        this.digits += digit;
        return this;
    }
}
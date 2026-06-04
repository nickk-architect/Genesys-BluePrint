import EventEmitter from 'events';

export class ASRService {
    private emitter = new EventEmitter();
    private state = 'None';
    private byteCount = 0;

    on(event: string, listener: (...args: any[]) => void): ASRService { this.emitter?.addListener(event, listener); return this; }
    getState(): string { return this.state; }

    processAudio(data: Uint8Array): ASRService {
        if (this.state === 'Complete') { this.emitter.emit('error', 'Speech recognition has already completed.'); return this; }
        this.byteCount += data.length;
        if (this.byteCount >= 40000) {
            this.state = 'Complete';
            this.emitter.emit('final-transcript', { text: 'I would like to check my account balance.', confidence: 1.0 });
            this.byteCount = 0;
            return this;
        }
        this.state = 'Processing';
        return this;
    }
}

export class Transcript {
    text: string;
    confidence: number;
    constructor(text: string, confidence: number) { this.text = text; this.confidence = confidence; }
}
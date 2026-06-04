import { JsonStringMap } from '../protocol/core';
import { BotTurnDisposition } from '../protocol/voice-bots';
import { TTSService } from './tts-service';

export class BotService {
    getBotIfExists(connectionUrl: string, inputVariables: JsonStringMap): Promise<BotResource | null> {
        return Promise.resolve(new BotResource());
    }
}

export class BotResource {
    private ttsService = new TTSService();

    getInitialResponse(): Promise<BotResponse> {
        const message = 'Hello and welcome to AudioConnector.';
        return this.ttsService.getAudioBytes(message).then(audioBytes => new BotResponse('match', message).withConfidence(1.0).withAudioBytes(audioBytes));
    }

    getBotResponse(data: string): Promise<BotResponse> {
        const message = 'We are unable to help at this time.';
        return this.ttsService.getAudioBytes(message).then(audioBytes => new BotResponse('match', message).withConfidence(1.0).withEndSession(true).withAudioBytes(audioBytes));
    }
}

export class BotResponse {
    disposition: BotTurnDisposition;
    text: string;
    confidence?: number;
    audioBytes?: Uint8Array;
    endSession?: boolean;

    constructor(disposition: BotTurnDisposition, text: string) { this.disposition = disposition; this.text = text; }
    withConfidence(confidence: number): BotResponse { this.confidence = confidence; return this; }
    withAudioBytes(audioBytes: Uint8Array): BotResponse { this.audioBytes = audioBytes; return this; }
    withEndSession(endSession: boolean): BotResponse { this.endSession = endSession; return this; }
}
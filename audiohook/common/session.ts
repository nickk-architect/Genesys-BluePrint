import { v4 as uuid } from 'uuid';
import { WebSocket } from 'ws';
import { JsonStringMap, MediaParameter } from '../protocol/core';
import { ClientMessage, DisconnectParameters, DisconnectReason, EventParameters, SelectParametersForType, ServerMessage, ServerMessageBase, ServerMessageType } from '../protocol/message';
import { BotTurnDisposition, EventEntityBargeIn, EventEntityBotTurnResponse } from '../protocol/voice-bots';
import { MessageHandlerRegistry } from '../websocket/message-handlers/message-handler-registry';
import { BotService, BotResource, BotResponse } from '../services/bot-service';
import { ASRService, Transcript } from '../services/asr-service';
import { DTMFService } from '../services/dtmf-service';

export class Session {
    private MAXIMUM_BINARY_MESSAGE_SIZE = 64000;
    private disconnecting = false;
    private closed = false;
    private ws;
    private messageHandlerRegistry = new MessageHandlerRegistry();
    private botService = new BotService();
    private asrService: ASRService | null = null;
    private dtmfService: DTMFService | null = null;
    private url;
    private clientSessionId;
    private conversationId: string | undefined;
    private lastServerSequenceNumber = 0;
    private lastClientSequenceNumber = 0;
    private inputVariables: JsonStringMap = {};
    private selectedMedia: MediaParameter | undefined;
    private selectedBot: BotResource | null = null;
    private isCapturingDTMF = false;
    private isAudioPlaying = false;

    constructor(ws: WebSocket, sessionId: string, url: string) {
        this.ws = ws;
        this.clientSessionId = sessionId;
        this.url = url;
    }

    close() { if (this.closed) return; try { this.ws.close(); } catch {} this.closed = true; }
    setConversationId(conversationId: string) { this.conversationId = conversationId; }
    setInputVariables(inputVariables: JsonStringMap) { this.inputVariables = inputVariables; }
    setSelectedMedia(selectedMedia: MediaParameter) { this.selectedMedia = selectedMedia; }
    setIsAudioPlaying(isAudioPlaying: boolean) { this.isAudioPlaying = isAudioPlaying; }

    processTextMessage(data: string) {
        if (this.closed) return;
        const message = JSON.parse(data);
        if (message.seq !== this.lastClientSequenceNumber + 1) { this.sendDisconnect('error', 'Invalid client sequence number.', {}); return; }
        this.lastClientSequenceNumber = message.seq;
        if (message.serverseq > this.lastServerSequenceNumber) { this.sendDisconnect('error', 'Invalid server sequence number.', {}); return; }
        if (message.id !== this.clientSessionId) { this.sendDisconnect('error', 'Invalid ID specified.', {}); return; }
        const handler = this.messageHandlerRegistry.getHandler(message.type);
        if (!handler) return;
        handler.handleMessage(message as ClientMessage, this);
    }

    createMessage<Type extends ServerMessageType, Message extends ServerMessage>(type: Type, parameters: SelectParametersForType<Type, Message>): ServerMessage {
        const message: ServerMessageBase<Type, typeof parameters> = { id: this.clientSessionId as string, version: '2', seq: ++this.lastServerSequenceNumber, clientseq: this.lastClientSequenceNumber, type, parameters };
        return message as ServerMessage;
    }

    send(message: ServerMessage) { this.ws.send(JSON.stringify(message)); }

    sendAudio(bytes: Uint8Array) {
        if (bytes.length <= this.MAXIMUM_BINARY_MESSAGE_SIZE) { this.ws.send(bytes, { binary: true }); }
        else { let p = 0; while (p < bytes.length) { this.ws.send(bytes.slice(p, p + this.MAXIMUM_BINARY_MESSAGE_SIZE), { binary: true }); p += this.MAXIMUM_BINARY_MESSAGE_SIZE; } }
    }

    sendBargeIn() { this.send(this.createMessage('event', { entities: [{ type: 'barge_in', data: {} }] } as SelectParametersForType<'event', EventParameters>)); }

    sendTurnResponse(disposition: BotTurnDisposition, text: string | undefined, confidence: number | undefined) {
        this.send(this.createMessage('event', { entities: [{ type: 'bot_turn_response', data: { disposition, text, confidence } }] } as SelectParametersForType<'event', EventParameters>));
    }

    sendDisconnect(reason: DisconnectReason, info: string, outputVariables: JsonStringMap) {
        this.disconnecting = true;
        this.send(this.createMessage('disconnect', { reason, info, outputVariables } as DisconnectParameters));
    }

    sendClosed() { this.send(this.createMessage('closed', {})); }

    checkIfBotExists(): Promise<boolean> {
        return this.botService.getBotIfExists(this.url, this.inputVariables).then((selectedBot: BotResource | null) => { this.selectedBot = selectedBot; return this.selectedBot != null; });
    }

    processBotStart() {
        if (!this.selectedBot) return;
        this.selectedBot.getInitialResponse().then((response: BotResponse) => {
            if (response.text) this.sendTurnResponse(response.disposition, response.text, response.confidence);
            if (response.audioBytes) this.sendAudio(response.audioBytes);
        });
    }

    processBinaryMessage(data: Uint8Array) {
        if (this.disconnecting || this.closed || !this.selectedBot || this.isCapturingDTMF) return;
        if (this.isAudioPlaying) { this.asrService = null; this.dtmfService = null; return; }
        if (!this.asrService || this.asrService.getState() === 'Complete') {
            this.asrService = new ASRService()
                .on('error', (error: any) => { if (!this.isCapturingDTMF) this.sendDisconnect('error', 'Error during Speech Recognition.', {}); })
                .on('final-transcript', (transcript: Transcript) => {
                    if (this.isCapturingDTMF) return;
                    this.selectedBot?.getBotResponse(transcript.text).then((response: BotResponse) => {
                        if (response.text) this.sendTurnResponse(response.disposition, response.text, response.confidence);
                        if (response.audioBytes) this.sendAudio(response.audioBytes);
                        if (response.endSession) this.sendDisconnect('completed', '', {});
                    });
                });
        }
        this.asrService.processAudio(data);
    }

    processDTMF(digit: string) {
        if (this.disconnecting || this.closed || !this.selectedBot) return;
        if (this.isAudioPlaying) { this.asrService = null; this.dtmfService = null; return; }
        if (!this.isCapturingDTMF) { this.isCapturingDTMF = true; this.asrService = null; }
        if (!this.dtmfService || this.dtmfService.getState() === 'Complete') {
            this.dtmfService = new DTMFService()
                .on('error', (error: any) => { this.sendDisconnect('error', 'Error during DTMF Capture.', {}); })
                .on('final-digits', (digits) => {
                    this.selectedBot?.getBotResponse(digits).then((response: BotResponse) => {
                        if (response.text) this.sendTurnResponse(response.disposition, response.text, response.confidence);
                        if (response.audioBytes) this.sendAudio(response.audioBytes);
                        if (response.endSession) this.sendDisconnect('completed', '', {});
                        this.isCapturingDTMF = false;
                    });
                });
        }
        this.dtmfService.processDigit(digit);
    }
};
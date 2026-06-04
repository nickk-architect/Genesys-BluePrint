import { ClientMessage } from '../../../protocol/message';
import { DTMFMessage } from '../../../protocol/voice-bots';
import { Session } from '../../../common/session';
import { MessageHandler } from '../message-handler';
export class DTMFMessageHandler implements MessageHandler {
    handleMessage(message: ClientMessage, session: Session) {
        const parsedMessage: DTMFMessage = message as DTMFMessage;
        if (!parsedMessage) { session.sendDisconnect('error', 'Invalid request parameters.', {}); return; }
        console.log(`Received a DTMF Message. Digit: ${parsedMessage.parameters.digit}`);
        session.processDTMF(parsedMessage.parameters.digit);
    }
}
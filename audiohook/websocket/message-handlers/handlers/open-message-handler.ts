import { MediaParameter } from '../../../protocol/core';
import { ClientMessage, OpenMessage, ServerMessage } from '../../../protocol/message';
import { Session } from '../../../common/session';
import { MessageHandler } from '../message-handler';
export class OpenMessageHandler implements MessageHandler {
    handleMessage(message: ClientMessage, session: Session) {
        const parsedMessage: OpenMessage = message as OpenMessage;
        if (!parsedMessage) { session.sendDisconnect('error', 'Invalid request parameters.', {}); return; }
        session.setConversationId(parsedMessage.parameters.conversationId);
        console.log('Received an Open Message.');
        let selectedMedia: MediaParameter | null = null;
        parsedMessage.parameters.media.forEach((element: MediaParameter) => { if (element.format === 'PCMU' && element.rate === 8000) selectedMedia = element; });
        if (!selectedMedia) { session.sendDisconnect('error', 'No supported media type was found.', {}); return; }
        session.setSelectedMedia(selectedMedia);
        if (parsedMessage.parameters.inputVariables) session.setInputVariables(parsedMessage.parameters.inputVariables);
        session.checkIfBotExists().then((exists) => {
            if (!exists) { session.sendDisconnect('error', 'The specific Bot does not exist.', {}); return; }
            if (selectedMedia) {
                session.send(session.createMessage('opened', { media: [selectedMedia] }));
                session.processBotStart();
            }
        });
    }
}
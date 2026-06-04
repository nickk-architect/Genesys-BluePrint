import WS, { WebSocket } from 'ws';
import express, { Express, Request } from 'express';
import { verifyRequestSignature } from '../auth/authenticator';
import { Session } from '../common/session';
import { getPort } from '../common/environment-variables';
import { SecretService } from '../services/secret-service';

export class Server {
    private app: Express | undefined;
    private httpServer: any;
    private wsServer: any;
    private sessionMap: Map<WebSocket, Session> = new Map();
    private secretService = new SecretService();

    start() {
        this.app = express();
        this.httpServer = this.app.listen(getPort());
        this.wsServer = new WebSocket.Server({ noServer: true });

        this.httpServer.on('upgrade', (request: Request, socket: any, head: any) => {
            verifyRequestSignature(request, this.secretService).then(verifyResult => {
                if (verifyResult.code !== 'VERIFIED') { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
                this.wsServer.handleUpgrade(request, socket, head, (ws: WebSocket) => { this.wsServer.emit('connection', ws, request); });
            });
        });

        this.wsServer.on('connection', (ws: WebSocket, request: Request) => {
            ws.on('close', () => { this.deleteConnection(ws); });
            ws.on('error', (error: Error) => { ws.close(); });
            ws.on('message', (data: WS.RawData, isBinary: boolean) => {
                if (ws.readyState !== WebSocket.OPEN) return;
                const session = this.sessionMap.get(ws);
                if (!session) {
                    const dummySession = new Session(ws, request.headers['audiohook-session-id'] as string, request.url);
                    dummySession.sendDisconnect('error', 'Session does not exist.', {});
                    return;
                }
                if (isBinary) session.processBinaryMessage(data as Uint8Array);
                else session.processTextMessage(data.toString());
            });
            this.createConnection(ws, request);
        });
    }

    private createConnection(ws: WebSocket, request: Request) {
        if (this.sessionMap.get(ws)) return;
        const session = new Session(ws, request.headers['audiohook-session-id'] as string, request.url);
        this.sessionMap.set(ws, session);
    }

    private deleteConnection(ws: WebSocket) {
        const session = this.sessionMap.get(ws);
        if (!session) return;
        try { session.close(); } catch {}
        this.sessionMap.delete(ws);
    }
}
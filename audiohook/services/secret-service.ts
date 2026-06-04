export class SecretService {
    static secrets = new Map();
    static { SecretService.secrets.set('ApiKey1', 'Secret1'); }
    getSecretForKey(key: string): Uint8Array {
        const secretString = SecretService.secrets.get(key) || '';
        return Buffer.from(secretString);
    }
}
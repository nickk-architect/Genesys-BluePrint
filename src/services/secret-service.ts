import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';

export interface SecretConfig {
    provider: 'env' | 'aws-secrets-manager' | 'file' | 'static';
    aws?: {
        region: string;
        accessKeyId: string;
        secretAccessKey: string;
    };
    file?: {
        path: string;
    };
}

export interface SecretEntry {
    apiKey: string;
    secret: string;
    description?: string;
    expiresAt?: Date;
}

/*
* Enhanced SecretService that supports multiple storage providers:
* - Environment variables
* - AWS Secrets Manager
* - File-based storage (JSON)
* - Static map (for development)
*/
export class SecretService {
    private config: SecretConfig;
    private secretsManager?: AWS.SecretsManager;
    private static staticSecrets = new Map<string, string>();
    private fileSecretsCache: Map<string, SecretEntry> = new Map();
    private lastFileRead = 0;
    private readonly FILE_CACHE_TTL = 30000; // 30 seconds

    constructor() {
        this.config = this.loadConfig();
        this.initializeProvider();
        this.loadInitialSecrets();
    }

    private loadConfig(): SecretConfig {
        const provider = (process.env.SECRET_PROVIDER || 'env') as 'env' | 'aws-secrets-manager' | 'file' | 'static';
        
        const config: SecretConfig = { provider };

        switch (provider) {
            case 'aws-secrets-manager':
                config.aws = {
                    region: process.env.AWS_SECRETS_REGION || 'us-east-1',
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
                };

                if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
                    console.warn('AWS credentials not found, falling back to static secrets');
                    config.provider = 'static';
                }
                break;

            case 'file':
                config.file = {
                    path: process.env.SECRETS_FILE_PATH || path.join(__dirname, '../../secrets.json')
                };
                break;

            case 'env':
            case 'static':
            default:
                // No additional configuration needed
                break;
        }

        return config;
    }

    private initializeProvider(): void {
        switch (this.config.provider) {
            case 'aws-secrets-manager':
                if (this.config.aws) {
                    AWS.config.update({
                        region: this.config.aws.region,
                        accessKeyId: this.config.aws.accessKeyId,
                        secretAccessKey: this.config.aws.secretAccessKey
                    });
                    this.secretsManager = new AWS.SecretsManager();
                }
                break;

            case 'file':
                this.loadFileSecrets();
                break;

            case 'static':
                this.loadStaticSecrets();
                break;

            case 'env':
            default:
                // Environment variables are loaded on-demand
                break;
        }
    }

    private loadInitialSecrets(): void {
        // Load any initial secrets based on environment variables
        const initialSecrets = this.getInitialSecretsFromEnv();
        for (const [key, secret] of initialSecrets) {
            SecretService.staticSecrets.set(key, secret);
        }
    }

    private getInitialSecretsFromEnv(): Map<string, string> {
        const secrets = new Map<string, string>();
        
        // Look for environment variables following the pattern API_KEY_* and SECRET_*
        Object.keys(process.env).forEach(key => {
            if (key.startsWith('API_KEY_')) {
                const apiKeyName = key.replace('API_KEY_', '');
                const secretKey = `SECRET_${apiKeyName}`;
                const secretValue = process.env[secretKey];
                
                if (secretValue) {
                    secrets.set(process.env[key]!, secretValue);
                }
            }
        });

        // Fallback to default keys for development
        if (secrets.size === 0) {
            const defaultApiKey = process.env.DEFAULT_API_KEY || 'ApiKey1';
            const defaultSecret = process.env.DEFAULT_SECRET || 'Secret1';
            secrets.set(defaultApiKey, defaultSecret);
        }

        return secrets;
    }

    private loadStaticSecrets(): void {
        // Load static secrets for development/testing
        SecretService.staticSecrets.set('ApiKey1', 'Secret1');
        SecretService.staticSecrets.set('TestKey', 'TestSecret');
        
        console.log('Loaded static secrets for development');
    }

    private loadFileSecrets(): void {
        if (!this.config.file?.path) {
            console.error('File path not configured for file-based secrets');
            return;
        }

        const now = Date.now();
        
        // Check if we need to reload the file (cache TTL)
        if (now - this.lastFileRead < this.FILE_CACHE_TTL && this.fileSecretsCache.size > 0) {
            return;
        }

        try {
            if (!fs.existsSync(this.config.file.path)) {
                console.warn(`Secrets file not found: ${this.config.file.path}`);
                return;
            }

            const fileContent = fs.readFileSync(this.config.file.path, 'utf8');
            const secretsData = JSON.parse(fileContent);
            
            this.fileSecretsCache.clear();
            
            if (Array.isArray(secretsData.secrets)) {
                secretsData.secrets.forEach((entry: SecretEntry) => {
                    // Check if secret has expired
                    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
                        console.warn(`Secret for API key ${entry.apiKey} has expired`);
                        return;
                    }
                    
                    this.fileSecretsCache.set(entry.apiKey, entry);
                });
            } else {
                // Support simple key-value format
                Object.entries(secretsData).forEach(([apiKey, secret]) => {
                    if (typeof secret === 'string') {
                        this.fileSecretsCache.set(apiKey, { apiKey, secret });
                    }
                });
            }

            this.lastFileRead = now;
            console.log(`Loaded ${this.fileSecretsCache.size} secrets from file`);
            
        } catch (error) {
            console.error('Error loading secrets from file:', error);
        }
    }

    async getSecretForKey(apiKey: string): Promise<Uint8Array> {
        try {
            const secretString = await this.getSecretString(apiKey);
            return Buffer.from(secretString || '');
        } catch (error) {
            console.error(`Error retrieving secret for key ${apiKey}:`, error);
            return Buffer.from('');
        }
    }

    // Synchronous version for backward compatibility
    getSecretForKeySync(apiKey: string): Uint8Array {
        const secretString = this.getSecretStringSync(apiKey);
        return Buffer.from(secretString || '');
    }

    private async getSecretString(apiKey: string): Promise<string | null> {
        switch (this.config.provider) {
            case 'aws-secrets-manager':
                return await this.getAWSSecret(apiKey);
            
            case 'file':
                return this.getFileSecret(apiKey);
            
            case 'env':
                return this.getEnvSecret(apiKey);
            
            case 'static':
            default:
                return this.getStaticSecret(apiKey);
        }
    }

    private getSecretStringSync(apiKey: string): string | null {
        switch (this.config.provider) {
            case 'file':
                return this.getFileSecret(apiKey);
            
            case 'env':
                return this.getEnvSecret(apiKey);
            
            case 'static':
            default:
                return this.getStaticSecret(apiKey);
        }
    }

    private async getAWSSecret(apiKey: string): Promise<string | null> {
        if (!this.secretsManager) {
            console.error('AWS Secrets Manager not initialized');
            return null;
        }

        try {
            // Try to get secret by exact name first
            let secretName = apiKey;
            
            // If not found, try with a prefix
            const secretPrefix = process.env.AWS_SECRET_PREFIX || 'audiohook/';
            if (!secretName.startsWith(secretPrefix)) {
                secretName = `${secretPrefix}${apiKey}`;
            }

            const result = await this.secretsManager.getSecretValue({
                SecretId: secretName
            }).promise();

            if (result.SecretString) {
                try {
                    // Try to parse as JSON first
                    const secretData = JSON.parse(result.SecretString);
                    return secretData.secret || secretData.value || result.SecretString;
                } catch {
                    // If not JSON, return as string
                    return result.SecretString;
                }
            }

            return null;
        } catch (error) {
            console.error(`AWS Secrets Manager error for key ${apiKey}:`, error);
            return null;
        }
    }

    private getFileSecret(apiKey: string): string | null {
        this.loadFileSecrets(); // Refresh cache if needed
        
        const entry = this.fileSecretsCache.get(apiKey);
        return entry?.secret || null;
    }

    private getEnvSecret(apiKey: string): string | null {
        // First try direct lookup
        const directSecret = process.env[`SECRET_FOR_${apiKey}`];
        if (directSecret) {
            return directSecret;
        }

        // Try pattern matching
        for (const [envKey, envValue] of Object.entries(process.env)) {
            if (envKey.startsWith('API_KEY_') && envValue === apiKey) {
                const secretKey = envKey.replace('API_KEY_', 'SECRET_');
                return process.env[secretKey] || null;
            }
        }

        return null;
    }

    private getStaticSecret(apiKey: string): string | null {
        return SecretService.staticSecrets.get(apiKey) || null;
    }

    // Method to add secrets at runtime (useful for testing)
    addSecret(apiKey: string, secret: string): void {
        SecretService.staticSecrets.set(apiKey, secret);
    }

    // Method to validate configuration
    async validateConfiguration(): Promise<boolean> {
        try {
            console.log(`Validating secret service configuration (provider: ${this.config.provider})`);
            
            switch (this.config.provider) {
                case 'aws-secrets-manager':
                    if (!this.secretsManager) {
                        console.error('AWS Secrets Manager not properly initialized');
                        return false;
                    }
                    // Try to list secrets to validate permissions
                    await this.secretsManager.listSecrets({ MaxResults: 1 }).promise();
                    break;
                
                case 'file':
                    if (!this.config.file?.path) {
                        console.error('File path not configured');
                        return false;
                    }
                    if (!fs.existsSync(this.config.file.path)) {
                        console.warn(`Secrets file does not exist: ${this.config.file.path}`);
                        return false;
                    }
                    break;
                
                case 'env':
                case 'static':
                    // Always valid
                    break;
            }
            
            console.log('Secret service configuration is valid');
            return true;
        } catch (error) {
            console.error('Secret service validation failed:', error);
            return false;
        }
    }

    // Method to get configuration info
    getConfigInfo(): any {
        const info = {
            provider: this.config.provider,
            secretsCount: 0
    };

        switch (this.config.provider) {
            case 'static':
                info.secretsCount = SecretService.staticSecrets.size;
                break;
            case 'file':
                info.secretsCount = this.fileSecretsCache.size;
                break;
            case 'env':
                info.secretsCount = this.getInitialSecretsFromEnv().size;
                break;
        }

        return info;
    }
}
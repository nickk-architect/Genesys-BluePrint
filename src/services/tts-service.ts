import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TTSConfig {
    provider: 'aws' | 'whisper' | 'dummy';
    aws?: {
        region: string;
        accessKeyId: string;
        secretAccessKey: string;
        voice: string;
        outputFormat: 'pcm' | 'mp3' | 'ogg_vorbis';
        sampleRate: string;
        textType: 'text' | 'ssml';
    };
    whisper?: {
        modelPath?: string;
        voice?: string;
        speed?: number;
        temperature?: number;
    };
}

export class TTSService {
    private config: TTSConfig;
    private polly?: AWS.Polly;
    private static silence: number[] = [];

    constructor() {
        this.config = this.loadConfig();
        this.initializeProvider();
    }

    private loadConfig(): TTSConfig {
        const provider = (process.env.TTS_PROVIDER || 'dummy') as 'aws' | 'whisper' | 'dummy';
        
        const config: TTSConfig = { provider };

        if (provider === 'aws') {
            config.aws = {
                region: process.env.AWS_TTS_REGION || 'us-east-1',
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
                voice: process.env.AWS_TTS_VOICE || 'Joanna',
                outputFormat: (process.env.AWS_TTS_OUTPUT_FORMAT as 'pcm' | 'mp3' | 'ogg_vorbis') || 'pcm',
                sampleRate: process.env.AWS_TTS_SAMPLE_RATE || '8000',
                textType: (process.env.AWS_TTS_TEXT_TYPE as 'text' | 'ssml') || 'text'
            };

            if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
                throw new Error('AWS credentials are required for AWS TTS');
            }
        }

        if (provider === 'whisper') {
            config.whisper = {
                modelPath: process.env.WHISPER_MODEL_PATH,
                voice: process.env.WHISPER_VOICE || 'alloy',
                speed: parseFloat(process.env.WHISPER_SPEED || '1.0'),
                temperature: parseFloat(process.env.WHISPER_TEMPERATURE || '0.7')
            };
        }

        return config;
    }

    private initializeProvider(): void {
        switch (this.config.provider) {
            case 'aws':
                if (this.config.aws) {
                    AWS.config.update({
                        region: this.config.aws.region,
                        accessKeyId: this.config.aws.accessKeyId,
                        secretAccessKey: this.config.aws.secretAccessKey
                    });
                    this.polly = new AWS.Polly();
                }
                break;
            case 'whisper':
                // Vérifier si whisper est installé
                this.verifyWhisperInstallation();
                break;
            case 'dummy':
                this.initializeDummyProvider();
                break;
        }
    }

    private initializeDummyProvider(): void {
        if (TTSService.silence.length === 0) {
            // 5 seconds of silence at 8kHz
            for (let x = 0; x < 40000; x++) {
                TTSService.silence[x] = 0;
            }
        }
    }

    private async verifyWhisperInstallation(): Promise<void> {
        try {
            await execAsync('which whisper');
        } catch (error) {
            console.warn('Whisper not found in PATH. Make sure OpenAI Whisper is installed.');
        }
    }

    async getAudioBytes(text: string): Promise<Uint8Array> {
        try {
            switch (this.config.provider) {
                case 'aws':
                    return await this.getAWSAudioBytes(text);
                case 'whisper':
                    return await this.getWhisperAudioBytes(text);
                case 'dummy':
                default:
                    return this.getDummyAudioBytes();
            }
        } catch (error) {
            console.error(`TTS Error with provider ${this.config.provider}:`, error);
            // Fallback to dummy in case of error
            return this.getDummyAudioBytes();
        }
    }

    private async getAWSAudioBytes(text: string): Promise<Uint8Array> {
        if (!this.polly || !this.config.aws) {
            throw new Error('AWS Polly not properly initialized');
        }

        const params: AWS.Polly.SynthesizeSpeechInput = {
            Text: text,
            OutputFormat: this.config.aws.outputFormat,
            VoiceId: this.config.aws.voice as AWS.Polly.VoiceId,
            SampleRate: this.config.aws.sampleRate,
            TextType: this.config.aws.textType
        };

        console.log(`Synthesizing speech with AWS Polly: "${text.substring(0, 50)}..."`);
        
        const result = await this.polly.synthesizeSpeech(params).promise();
        
        if (!result.AudioStream) {
            throw new Error('No audio stream received from AWS Polly');
        }

        let audioBuffer: Uint8Array;
        
        if (result.AudioStream instanceof Buffer) {
            audioBuffer = new Uint8Array(result.AudioStream);
        } else if (result.AudioStream instanceof Uint8Array) {
            audioBuffer = result.AudioStream;
        } else {
            // For other stream types
            const chunks: Buffer[] = [];
            const stream = result.AudioStream as NodeJS.ReadableStream;
            
            return new Promise((resolve, reject) => {
                stream.on('data', (chunk) => chunks.push(chunk));
                stream.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve(new Uint8Array(buffer));
                });
                stream.on('error', reject);
            });
        }

        // Convert to PCM if needed
        if (this.config.aws.outputFormat !== 'pcm') {
            return await this.convertToPCM(audioBuffer, this.config.aws.outputFormat);
        }

        return audioBuffer;
    }

    private async getWhisperAudioBytes(text: string): Promise<Uint8Array> {
        if (!this.config.whisper) {
            throw new Error('Whisper not properly configured');
        }

        console.log(`Synthesizing speech with Whisper: "${text.substring(0, 50)}..."`);

        // Create a temporary file for the text
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const textFile = path.join(tempDir, `tts_${Date.now()}.txt`);
        const audioFile = path.join(tempDir, `tts_${Date.now()}.wav`);

        try {
            // Write text to file
            fs.writeFileSync(textFile, text);

            // Build whisper command
            let command = `whisper-tts`;
            
            if (this.config.whisper.modelPath) {
                command += ` --model "${this.config.whisper.modelPath}"`;
            }
            
            if (this.config.whisper.voice) {
                command += ` --voice ${this.config.whisper.voice}`;
            }
            
            if (this.config.whisper.speed) {
                command += ` --speed ${this.config.whisper.speed}`;
            }
            
            if (this.config.whisper.temperature) {
                command += ` --temperature ${this.config.whisper.temperature}`;
            }

            command += ` --output "${audioFile}" "${textFile}"`;

            // Execute whisper command
            await execAsync(command);

            // Read the generated audio file
            if (!fs.existsSync(audioFile)) {
                throw new Error('Whisper failed to generate audio file');
            }

            const audioBuffer = fs.readFileSync(audioFile);
            
            // Convert WAV to PCM (remove WAV header)
            const pcmData = this.wavToPCM(new Uint8Array(audioBuffer));
            
            return pcmData;

        } finally {
            // Cleanup temporary files
            if (fs.existsSync(textFile)) {
                fs.unlinkSync(textFile);
            }
            if (fs.existsSync(audioFile)) {
                fs.unlinkSync(audioFile);
            }
        }
    }

    private getDummyAudioBytes(): Promise<Uint8Array> {
        console.log('Using dummy TTS (5 seconds of silence)');
        return Promise.resolve(Uint8Array.from(TTSService.silence));
    }

    private async convertToPCM(audioBuffer: Uint8Array, sourceFormat: string): Promise<Uint8Array> {
        // This is a simplified conversion. In a production environment,
        // you might want to use a more robust audio processing library like ffmpeg
        console.log(`Converting ${sourceFormat} to PCM...`);
        
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const inputFile = path.join(tempDir, `input_${Date.now()}.${sourceFormat}`);
        const outputFile = path.join(tempDir, `output_${Date.now()}.pcm`);

        try {
            // Write input file
            fs.writeFileSync(inputFile, audioBuffer);

            // Use ffmpeg to convert to PCM
            const command = `ffmpeg -i "${inputFile}" -f s16le -ar 8000 -ac 1 "${outputFile}"`;
            await execAsync(command);

            // Read converted file
            const pcmBuffer = fs.readFileSync(outputFile);
            return new Uint8Array(pcmBuffer);

        } finally {
            // Cleanup
            if (fs.existsSync(inputFile)) {
                fs.unlinkSync(inputFile);
            }
            if (fs.existsSync(outputFile)) {
                fs.unlinkSync(outputFile);
            }
        }
    }

    private wavToPCM(wavBuffer: Uint8Array): Uint8Array {
        // Basic WAV to PCM conversion (removes 44-byte WAV header)
        if (wavBuffer.length < 44) {
            throw new Error('Invalid WAV file: too short');
        }
        
        // Check if it's a valid WAV file
        const riff = String.fromCharCode(...wavBuffer.slice(0, 4));
        const wave = String.fromCharCode(...wavBuffer.slice(8, 12));
        
        if (riff !== 'RIFF' || wave !== 'WAVE') {
            throw new Error('Invalid WAV file format');
        }
        
        // Return PCM data (skip 44-byte header)
        return wavBuffer.slice(44);
    }

    // Méthode pour tester la configuration
    async testConfiguration(): Promise<boolean> {
        try {
            const testText = "Hello, this is a test.";
            const audioBytes = await this.getAudioBytes(testText);
            console.log(`TTS test successful with ${this.config.provider}. Generated ${audioBytes.length} bytes.`);
            return true;
        } catch (error) {
            console.error(`TTS test failed with ${this.config.provider}:`, error);
            return false;
        }
    }

    // Getter pour obtenir la configuration actuelle
    getConfig(): TTSConfig {
        return { ...this.config };
    }
}
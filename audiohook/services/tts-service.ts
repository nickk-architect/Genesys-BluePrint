export class TTSService {
    static silence: number[] = [];
    static { for (let x = 0; x < 40000; x++) { TTSService.silence[x] = 0; } }
    getAudioBytes(data: string): Promise<Uint8Array> { return Promise.resolve(Uint8Array.from(TTSService.silence)); }
}
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { WebSocket, RawData } from 'ws';
import { VOICE_MAX_OUTPUT_TOKENS } from '../common/constants/response.constants';

export type ProviderEvent = { type: string; response?: { id: string; usage?: Record<string, unknown>; output?: Array<{ content?: Array<{ transcript?: string }> }> } };
export type VoiceControl = { enable: () => Promise<void>; close: () => void; healthy: () => boolean };
const decode = (raw: RawData) => (Array.isArray(raw) ? Buffer.concat(raw) : Buffer.isBuffer(raw) ? raw : Buffer.from(raw)).toString('utf8');

@Injectable()
export class RealtimeProvider {
  constructor(private readonly config: ConfigService) {}
  private headers() { return { Authorization: `Bearer ${this.config.getOrThrow<string>('OPENAI_API_KEY')}` }; }

  async create(sdp: string, model: string, voice: string, instructions: string, userId: string) {
    const form = new FormData();
    form.set('sdp', sdp);
    form.set('session', JSON.stringify({ type: 'realtime', model, instructions,
      output_modalities: ['audio'], max_output_tokens: VOICE_MAX_OUTPUT_TOKENS, tools: [], tracing: null,
      audio: { input: { transcription: null, turn_detection: null }, output: { voice } },
    }));
    // Intentionally no retries: an ambiguous POST must not allocate a second call.
    const response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST', headers: { ...this.headers(), 'OpenAI-Safety-Identifier': createHash('sha256').update(userId).digest('hex') },
      body: form, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new ServiceUnavailableException({ code: 'VOICE_PROVIDER_UNAVAILABLE', message: `Voice provider could not create the call (${response.status}).` });
    const location = response.headers.get('location');
    const callId = location?.split('/').pop();
    if (!callId || !/^rtc_[a-zA-Z0-9_-]+$/.test(callId)) throw new Error('Provider call identifier missing; no audio answer was delivered.');
    return { callId, sdp: await response.text() };
  }

  async hangup(callId: string) {
    const response = await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
      method: 'POST', headers: this.headers(), signal: AbortSignal.timeout(5000),
    });
    // 404 means the authenticated project no longer has this call. Never interpret
    // network failures, authentication errors or 5xx as proof of termination.
    if (!response.ok && response.status !== 404) throw new Error(`Provider termination failed (${response.status}).`);
  }

  async attach(callId: string, onEvent: (event: ProviderEvent) => void, onLost: () => void): Promise<VoiceControl> {
    const socket = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`, { headers: this.headers(), handshakeTimeout: 5000 });
    let closed = false;
    let lastPong = Date.now();
    socket.on('pong', () => { lastPong = Date.now(); });
    socket.on('error', () => { if (!closed) onLost(); });
    socket.on('close', () => { if (!closed) onLost(); });
    socket.on('message', (raw) => {
      try { onEvent(JSON.parse(decode(raw)) as ProviderEvent); } catch { onLost(); }
    });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      });
    } catch (error) { closed = true; socket.terminate(); throw error; }
    const ping = setInterval(() => {
      if (Date.now() - lastPong > 8000) { onLost(); return; }
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    }, 2000);
    return {
      healthy: () => !closed && socket.readyState === WebSocket.OPEN && Date.now() - lastPong < 8000,
      close: () => { closed = true; clearInterval(ping); socket.terminate(); },
      enable: () => new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { socket.off('message', listener); reject(new Error('Voice activation timed out.')); }, 4000);
        const listener = (raw: RawData) => {
          const event = JSON.parse(decode(raw)) as { type: string; session?: { audio?: { input?: { turn_detection?: { create_response?: boolean } } } } };
          if (event.type === 'session.updated' && event.session?.audio?.input?.turn_detection?.create_response === true) {
            clearTimeout(timer); socket.off('message', listener); resolve();
          }
        };
        socket.on('message', listener);
        socket.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
        socket.send(JSON.stringify({ type: 'session.update', session: { type: 'realtime', audio: { input: {
          turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true, silence_duration_ms: 600 },
        } } } }));
      }),
    };
  }
}

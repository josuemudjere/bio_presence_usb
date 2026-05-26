/**
 * Service de communication série avec le capteur biométrique NodeMCU v1.0 (ESP8266)
 * Connexion : USB → port série (115200 baud)
 *
 * ─── Protocole ───────────────────────────────────────────────────────────────
 *  Browser → NodeMCU (texte terminé par \n) :
 *    CMD:SCAN\n     → démarrer un scan de présence
 *    CMD:ENROLL\n   → démarrer un enrôlement
 *    CMD:CANCEL\n   → annuler l'opération en cours
 *
 *  NodeMCU → Browser (lignes JSON) :
 *    {"event":"ready"}
 *    {"event":"finger_placed"}
 *    {"event":"match","id":"0001"}
 *    {"event":"no_match"}
 *    {"event":"enrolled","id":"0001"}
 *    {"event":"error","message":"..."}
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Types Web Serial (non fournis par TypeScript par défaut) ─────────────────
declare global {
  interface Navigator {
    serial?: {
      requestPort(options?: {
        filters?: { usbVendorId?: number; usbProductId?: number }[];
      }): Promise<WebSerialPort>;
      getPorts(): Promise<WebSerialPort[]>;
    };
  }
  interface WebSerialPort {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
  }
}

// ── Types internes ────────────────────────────────────────────────────────────
type SensorEvent =
  | { event: 'ready' }
  | { event: 'finger_placed' }
  | { event: 'match'; id: string }
  | { event: 'no_match' }
  | { event: 'enrolled'; id: string }
  | { event: 'error'; message: string };

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';
type ConnectionListener = (state: ConnectionState) => void;

// ── Service ──────────────────────────────────────────────────────────────────
class SerialSensorService {
  private port: WebSerialPort | null = null;
  private rawReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private rawWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

  private _state: ConnectionState = 'disconnected';
  private listeners = new Set<ConnectionListener>();

  private lineBuffer = '';
  private pendingResolve: ((id: string) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;
  private readLoopRunning = false;

  // ── État ──────────────────────────────────────────────────────────────────
  get state(): ConnectionState {
    return this._state;
  }

  get isConnected(): boolean {
    return this._state === 'connected';
  }

  /** S'abonner aux changements d'état de connexion. Retourne une fonction de nettoyage. */
  onConnectionChange(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(s: ConnectionState): void {
    this._state = s;
    this.listeners.forEach((l) => l(s));
  }

  // ── Connexion ─────────────────────────────────────────────────────────────
  async connect(): Promise<void> {
    if (!navigator.serial) {
      throw new Error(
        'Web Serial API non disponible. Utilisez Chrome ou Edge (pas Firefox/Safari).'
      );
    }

    if (this._state !== 'disconnected') return;
    this.setState('connecting');

    try {
      // Dialogue natif de sélection du port USB
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });

      this.rawReader = this.port.readable.getReader();
      this.rawWriter = this.port.writable.getWriter();

      this.setState('connected');
      this.startReadLoop();
    } catch (err) {
      this.setState('disconnected');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.cancelPending(new Error('Capteur déconnecté manuellement.'));
    try {
      await this.rawReader?.cancel();
      this.rawReader = null;
      await this.rawWriter?.close();
      this.rawWriter = null;
      await this.port?.close();
      this.port = null;
    } catch {
      // ignorer les erreurs de fermeture
    }
    this.lineBuffer = '';
    this.setState('disconnected');
  }

  // ── Boucle de lecture ─────────────────────────────────────────────────────
  private async startReadLoop(): Promise<void> {
    if (this.readLoopRunning) return;
    this.readLoopRunning = true;
    const decoder = new TextDecoder();

    try {
      while (this.rawReader) {
        const { value, done } = await this.rawReader.read();
        if (done) break;

        this.lineBuffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = this.lineBuffer.indexOf('\n')) !== -1) {
          const line = this.lineBuffer.slice(0, idx).trim();
          this.lineBuffer = this.lineBuffer.slice(idx + 1);
          if (line) this.handleLine(line);
        }
      }
    } catch {
      // connexion perdue
    } finally {
      this.readLoopRunning = false;
      if (this._state === 'connected') {
        this.setState('disconnected');
        this.cancelPending(new Error('Connexion au capteur perdue.'));
      }
    }
  }

  private handleLine(line: string): void {
    let evt: SensorEvent;
    try {
      evt = JSON.parse(line) as SensorEvent;
    } catch {
      return;
    }

    switch (evt.event) {
      case 'match':
      case 'enrolled':
        this.pendingResolve?.(evt.id);
        this.clearPending();
        break;
      case 'no_match':
        this.pendingReject?.(new Error('Empreinte non reconnue.'));
        this.clearPending();
        break;
      case 'error':
        this.pendingReject?.(new Error(evt.message ?? 'Erreur capteur.'));
        this.clearPending();
        break;
      default:
        break;
    }
  }

  private clearPending(): void {
    this.pendingResolve = null;
    this.pendingReject = null;
  }

  private cancelPending(err: Error): void {
    this.pendingReject?.(err);
    this.clearPending();
  }

  // ── Commandes ─────────────────────────────────────────────────────────────
  private async sendCommand(command: string): Promise<void> {
    if (!this.rawWriter) throw new Error('Capteur non connecté.');
    const encoder = new TextEncoder();
    await this.rawWriter.write(encoder.encode(`CMD:${command}\n`));
  }

  /**
   * Lance un scan et retourne l'ID d'empreinte retourné par le NodeMCU.
   * La promesse se résout quand le NodeMCU envoie {"event":"match","id":"..."} ou {"event":"enrolled","id":"..."}
   */
  scan(mode: 'attendance' | 'enrollment', timeoutMs = 30_000): Promise<string> {
    if (!this.isConnected) {
      return Promise.reject(new Error('Capteur non connecté. Connectez le NodeMCU via USB d\'abord.'));
    }
    if (this.pendingResolve) {
      return Promise.reject(new Error('Un scan est déjà en cours.'));
    }

    return new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.cancelPending(new Error('Temps d\'attente dépassé. Placez votre doigt sur le capteur.'));
      }, timeoutMs);

      this.pendingResolve = (id) => { clearTimeout(timer); resolve(id); };
      this.pendingReject = (err) => { clearTimeout(timer); reject(err); };

      const cmd = mode === 'enrollment' ? 'ENROLL' : 'SCAN';
      this.sendCommand(cmd).catch((err: unknown) => {
        clearTimeout(timer);
        this.clearPending();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }
}

/** Instance singleton partagée dans toute l'application */
export const serialSensor = new SerialSensorService();

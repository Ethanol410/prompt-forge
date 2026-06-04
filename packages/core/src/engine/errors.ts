export type EngineErrorCode = 'empty_intent';

/** Erreur de validation/entrée du moteur de génération. */
export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

import type { ProviderMode } from '../env';
import type { RequestedConcern, ScoredConcern, SkinAnalysisResult } from '../domain/skin';
import type { MakeupTaskEffects } from '../domain/tryon';

/**
 * Provider boundary. The application never sees a raw YouCam payload: adapters
 * return normalised values, failures with a plain-language message and
 * guidance, and diagnostics that contain only statuses, timings, counts and
 * field shapes (never keys, signed URLs or values).
 */

export type ProviderPhase = 'submitting' | 'processing' | 'downloading';

export type ProviderImage = { data: Buffer; mimeType: 'image/jpeg'; fileName: string };

export type ProviderFailure = {
  ok: false;
  /** Provider error code when one was returned (e.g. error_src_face_too_small), else our own code. */
  code: string;
  /** Safe to show to the person. */
  message: string;
  /** What the person can do about it. */
  guidance: string | null;
  retryable: boolean;
  taskId: string | null;
  diagnostics: Record<string, unknown>;
};

export type CommonRequest = {
  image: ProviderImage;
  signal?: AbortSignal;
  onPhase?: (phase: ProviderPhase, detail: { taskId?: string }) => void;
};

export type MaskImage = { concern: ScoredConcern; data: Buffer; mimeType: 'image/png' | 'image/jpeg' };

export type SkinAnalysisSuccess = {
  ok: true;
  /** maskArtifactId is always null here; the service fills it once masks are stored. */
  result: SkinAnalysisResult;
  masks: MaskImage[];
  taskId: string | null;
  latencyMs: number;
  diagnostics: Record<string, unknown>;
};

export interface SkinAnalysisProvider {
  readonly mode: ProviderMode;
  readonly label: string;
  analyze(req: CommonRequest & { concerns: readonly RequestedConcern[] }): Promise<SkinAnalysisSuccess | ProviderFailure>;
}

export type MakeupSuccess = {
  ok: true;
  output: Buffer;
  taskId: string | null;
  latencyMs: number;
  diagnostics: Record<string, unknown>;
};

export interface MakeupProvider {
  readonly mode: ProviderMode;
  readonly label: string;
  render(req: CommonRequest & { effects: MakeupTaskEffects }): Promise<MakeupSuccess | ProviderFailure>;
}

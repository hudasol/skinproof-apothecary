import { z } from 'zod';

/**
 * Runtime schemas for YouCam responses, written from the OpenAPI bundles
 * (docs/API-VERIFICATION.md). Unknown extra fields are allowed; the fields we
 * depend on are checked. Shared File, task and credit shapes were verified
 * live by TryOn on 2026-10-18.
 */

export const ErrorBodySchema = z
  .object({ status: z.number().optional(), error: z.string().optional(), error_code: z.string().optional() })
  .loose();

export const FileCreateResponseSchema = z
  .object({
    status: z.number().optional(),
    data: z
      .object({
        files: z
          .array(
            z
              .object({
                file_id: z.string().min(1),
                requests: z
                  .array(
                    z
                      .object({
                        url: z.url(),
                        method: z.string().optional(),
                        headers: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
                      })
                      .loose(),
                  )
                  .min(1),
              })
              .loose(),
          )
          .min(1),
      })
      .loose(),
  })
  .loose();

export const TaskCreateResponseSchema = z
  .object({ status: z.number().optional(), data: z.object({ task_id: z.string().min(1) }).loose() })
  .loose();

export const TaskStatusResponseSchema = z
  .object({
    status: z.number().optional(),
    data: z
      .object({
        task_status: z.string().min(1),
        // Verified live (TryOn): while a task runs, results and error can be null.
        results: z.unknown().optional(),
        error: z.string().nullable().optional(),
        error_message: z.string().nullable().optional(),
        failure_reason: z.string().nullable().optional(),
      })
      .loose(),
  })
  .loose();
export type TaskStatusResponse = z.infer<typeof TaskStatusResponseSchema>;

/** Makeup result: OpenAPI and live shape is { url }; the prose shows [ { download_url } ]. */
export const MakeupResultsSchema = z.union([
  z.object({ url: z.url() }).loose(),
  z.array(z.object({ download_url: z.url().optional(), url: z.url().optional() }).loose()).min(1),
]);

export function extractMakeupResultUrl(raw: unknown): { url: string; shape: string } | null {
  const parsed = MakeupResultsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const r = parsed.data;
  if (!Array.isArray(r)) return { url: r.url, shape: 'object_url' };
  const first = r[0];
  if (first?.download_url) return { url: first.download_url, shape: 'array_download_url' };
  if (first?.url) return { url: first.url, shape: 'array_url' };
  return null;
}

const score = z.number().finite().nullable().optional();

/** Skin Analysis result for format=json: data.results.output[]. */
export const SkinOutputItemSchema = z
  .object({
    type: z.string().min(1),
    region: z.string().nullable().optional(),
    raw_score: score,
    ui_score: score,
    score,
    skin_type: z.string().nullable().optional(),
    mask_urls: z.array(z.string()).nullable().optional(),
  })
  .loose();
export type SkinOutputItem = z.infer<typeof SkinOutputItemSchema>;

export const SkinResultsSchema = z.object({ output: z.array(z.unknown()) }).loose();

export const CreditResponseSchema = z
  .object({
    status: z.number().optional(),
    results: z.array(
      z
        .object({ type: z.string(), amount_dec: z.number().optional(), amount: z.number().optional(), expiry: z.number().optional() })
        .loose(),
    ),
  })
  .loose();

/** Structure of a value with every leaf replaced by its type: safe to log. */
export function shapeOf(value: unknown, depth = 0): unknown {
  if (value === null) return 'null';
  if (Array.isArray(value)) return depth > 3 ? 'array' : value.length ? [shapeOf(value[0], depth + 1)] : [];
  if (typeof value === 'object') {
    if (depth > 3) return 'object';
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, shapeOf(v, depth + 1)]));
  }
  return typeof value;
}

type Help = { message: string; guidance: string | null; retryable: boolean };

const PHOTO = 'Use a front-facing photo in even light, with your face filling most of the frame and nothing covering it.';

/** Documented engine error codes, in plain language, with what the person can do. */
export const ENGINE_ERRORS: Record<string, Help> = {
  error_below_min_image_size: { message: 'The photo is too small for skin analysis.', guidance: 'Use a photo at least 480 pixels on its shorter side.', retryable: false },
  error_exceed_max_image_size: { message: 'The photo is larger than the service accepts.', guidance: 'Try a smaller photo.', retryable: false },
  exceed_max_filesize: { message: 'The photo file is larger than the service accepts.', guidance: 'Try a photo under 10 MB.', retryable: false },
  error_src_face_too_small: { message: 'Your face is too small in the photo.', guidance: 'Move closer, or crop the photo so your face fills more than 60% of its width.', retryable: false },
  error_src_face_out_of_bound: { message: 'Part of your face is outside the photo.', guidance: 'Make sure your whole face, forehead to chin, is inside the frame.', retryable: false },
  error_lighting_dark: { message: 'The photo is too dark to analyse.', guidance: 'Face a window or a soft light and try again.', retryable: false },
  error_no_face: { message: 'No face was found in the photo.', guidance: PHOTO, retryable: false },
  error_pose: { message: 'The face angle could not be read.', guidance: 'Look straight into the camera with your head level.', retryable: false },
  error_face_parsing: { message: 'The face could not be mapped clearly.', guidance: PHOTO, retryable: false },
  error_face_position_invalid: { message: 'The whole face must be visible.', guidance: PHOTO, retryable: false },
  error_face_position_too_small: { message: 'Your face is too small in the photo.', guidance: 'Move closer to the camera.', retryable: false },
  error_face_position_out_of_boundary: { message: 'Your face is too large or partly outside the photo.', guidance: 'Step back a little so your whole face fits.', retryable: false },
  error_face_angle_invalid: { message: 'The head is turned too far.', guidance: 'Face the camera directly, within about 10°.', retryable: false },
  error_decode_image: { message: 'The service could not read the photo.', guidance: 'Try another JPEG or PNG photo.', retryable: false },
  error_download_image: { message: 'The service could not fetch the photo.', guidance: null, retryable: true },
  error_nsfw_content_detected: { message: 'The service declined this photo.', guidance: 'Use a plain, front-facing portrait.', retryable: false },
  exceed_nsfw_retry_limits: { message: 'The service declined this photo.', guidance: 'Use a plain, front-facing portrait.', retryable: false },
  error_inference: { message: 'The service’s model failed on this photo.', guidance: 'Try again, or try another photo.', retryable: true },
  error_upload: { message: 'The service could not store its result.', guidance: null, retryable: true },
  invalid_parameter: { message: 'The service rejected a parameter.', guidance: null, retryable: false },
  unknown_internal_error: { message: 'The service reported an internal error.', guidance: 'Try again in a minute.', retryable: true },
};

/** Submit-time error codes (HTTP 4xx bodies). */
export const SUBMIT_ERRORS: Record<string, Help> = {
  CreditInsufficiency: { message: 'The YouCam account behind this site has no units left.', guidance: 'This is a problem on our side, not with your photo.', retryable: false },
  InvalidApiKey: { message: 'The site’s YouCam API key was rejected.', guidance: 'This is a problem on our side, not with your photo.', retryable: false },
  InactiveApiKey: { message: 'The site’s YouCam API key is inactive.', guidance: 'This is a problem on our side, not with your photo.', retryable: false },
  ExpiredApiKey: { message: 'The site’s YouCam API key has expired.', guidance: 'This is a problem on our side, not with your photo.', retryable: false },
  InvalidParameters: { message: 'The service rejected the request.', guidance: null, retryable: false },
  BadRequest: { message: 'The service rejected the request.', guidance: null, retryable: false },
  InvalidStyle: { message: 'The service rejected the makeup style.', guidance: null, retryable: false },
  InvalidStyleGroup: { message: 'The service rejected the makeup style group.', guidance: null, retryable: false },
  InvalidTaskId: { message: 'The service no longer recognises this task.', guidance: 'Start again.', retryable: false },
  TaskTimeout: { message: 'The service says the task expired.', guidance: 'Try again.', retryable: true },
};

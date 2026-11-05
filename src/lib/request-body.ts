/**
 * src/lib/request-body.ts
 *
 * Bounded request-body reader, shared by every route that must cap a body.
 *
 * Why this exists: `request.text()` and `request.json()` resolve only once the
 * whole body has been buffered, so a size check performed afterwards runs too
 * late — the oversized payload has already been materialized in memory, and a
 * chunked request without `Content-Length` never hits the cheap header
 * pre-flight. This reader counts the raw UTF-8 bytes as they arrive and stops
 * at the cap.
 *
 * Contract:
 *   - the cap is inclusive: exactly `maxBytes` is accepted, one byte more is not;
 *   - memory holds at most `maxBytes` of decoded text plus the single chunk that
 *     crossed the cap (that chunk is counted but never decoded or appended);
 *   - the stream is cancelled as soon as the cap is crossed, so the producer is
 *     not drained;
 *   - the reader lock is always released, on success, overflow and error;
 *   - a stream error is re-thrown to the caller, which keeps its existing
 *     error-response contract (the interview routes answer 400).
 */

/** Minimal shape needed from `NextRequest`; keeps this module framework-free. */
export type BodySource = {
  readonly body: ReadableStream<Uint8Array> | null;
};

export type BoundedBodyResult =
  | { tooLarge: true }
  | { tooLarge: false; text: string };

/**
 * Read a request body while enforcing `maxBytes`.
 *
 * Bytes are counted on the raw chunks, never on the decoded string, so the
 * limit cannot be bypassed with multi-byte UTF-8 and never depends on the
 * declared `Content-Length`.
 */
export async function readBodyWithLimit(
  request: BodySource,
  maxBytes: number,
): Promise<BoundedBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError(
      `maxBytes must be a non-negative safe integer, received ${String(maxBytes)}.`,
    );
  }

  const body = request.body;
  if (!body) return { tooLarge: false, text: "" };

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let totalBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        // Stop here: the remainder is discarded instead of being buffered.
        await reader.cancel().catch(() => undefined);
        return { tooLarge: true };
      }

      // `stream: true` keeps a partial multi-byte sequence in the decoder until
      // the next chunk completes it, so split characters reassemble correctly.
      text += decoder.decode(value, { stream: true });
    }

    // Flush any bytes still held by the streaming decoder.
    text += decoder.decode();
    return { tooLarge: false, text };
  } catch (err) {
    // A broken/aborted body stream must not leave the request half-locked.
    await reader.cancel().catch(() => undefined);
    throw err;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // A read is still pending: the stream is already unusable, nothing to release.
    }
  }
}

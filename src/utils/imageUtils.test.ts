import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLogoFile,
  estimateDataUrlSizeBytes,
  formatByteSize,
  ALLOWED_LOGO_MIME_TYPES,
} from './imageUtils';

test('validateLogoFile accepts PNG, JPG, JPEG, and WEBP formats', () => {
  const fakePng = { type: 'image/png', size: 500_000 } as File;
  const fakeJpg = { type: 'image/jpeg', size: 1_200_000 } as File;
  const fakeWebp = { type: 'image/webp', size: 800_000 } as File;
  const fakePdf = { type: 'application/pdf', size: 100_000 } as File;
  const fakeGif = { type: 'image/gif', size: 200_000 } as File;

  assert.equal(validateLogoFile(fakePng).isValid, true);
  assert.equal(validateLogoFile(fakeJpg).isValid, true);
  assert.equal(validateLogoFile(fakeWebp).isValid, true);
  assert.equal(validateLogoFile(fakePdf).isValid, false);
  assert.equal(validateLogoFile(fakeGif).isValid, false);
});

test('validateLogoFile rejects files exceeding maximum size limit', () => {
  const normalFile = { type: 'image/png', size: 2 * 1024 * 1024 } as File;
  const oversizedFile = { type: 'image/png', size: 15 * 1024 * 1024 } as File;

  assert.equal(validateLogoFile(normalFile).isValid, true);
  const resultOver = validateLogoFile(oversizedFile);
  assert.equal(resultOver.isValid, false);
  assert.match(resultOver.error || '', /demasiado pesado/i);
});

test('estimateDataUrlSizeBytes accurately computes base64 byte length', () => {
  assert.equal(estimateDataUrlSizeBytes(''), 0);

  // 1x1 transparent png data url
  const sampleDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const size = estimateDataUrlSizeBytes(sampleDataUrl);
  assert.ok(size > 50 && size < 120);

  // Raw base64 string
  const rawBase64 = 'AAAA';
  assert.equal(estimateDataUrlSizeBytes(rawBase64), 3);
});

test('formatByteSize formats bytes, kilobytes and megabytes cleanly', () => {
  assert.equal(formatByteSize(512), '512 B');
  assert.equal(formatByteSize(1024), '1.0 KB');
  assert.equal(formatByteSize(35 * 1024), '35.0 KB');
  assert.equal(formatByteSize(1.5 * 1024 * 1024), '1.50 MB');
});

test('ALLOWED_LOGO_MIME_TYPES contains exact required formats', () => {
  assert.ok(ALLOWED_LOGO_MIME_TYPES.includes('image/png'));
  assert.ok(ALLOWED_LOGO_MIME_TYPES.includes('image/jpeg'));
  assert.ok(ALLOWED_LOGO_MIME_TYPES.includes('image/webp'));
});

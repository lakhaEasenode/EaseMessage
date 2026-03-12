const SIGNATURES = {
    'image/jpeg': { offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
    'image/png': { offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] },
    'video/mp4': { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // "ftyp"
    'application/pdf': { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // "%PDF"
};

/**
 * Validate that a file buffer's magic bytes match its declared MIME type.
 * @param {Buffer} buffer - The file buffer
 * @param {string} declaredMimeType - The MIME type from the upload header
 * @returns {{ valid: boolean, detectedType: string|null }}
 */
function validateMagicBytes(buffer, declaredMimeType) {
    const sig = SIGNATURES[declaredMimeType];
    if (!sig) {
        return { valid: false, detectedType: null };
    }

    const { offset, bytes } = sig;
    if (buffer.length < offset + bytes.length) {
        return { valid: false, detectedType: null };
    }

    const matches = bytes.every((b, i) => buffer[offset + i] === b);
    return {
        valid: matches,
        detectedType: matches ? declaredMimeType : null,
    };
}

module.exports = { validateMagicBytes };

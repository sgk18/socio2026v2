import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Generate QR code data for a registration
 * @param {string} registrationId - The registration ID
 * @param {string} eventId - The event ID
 * @param {string} participantEmail - The participant's email
 * @returns {Object} QR code payload with security hash
 */
export function generateQRCodeData(registrationId, eventId, participantEmail) {
  const timestamp = Date.now();
  const expiryTime = timestamp + (30 * 24 * 60 * 60 * 1000); // 30 days from now
  
  // Create a HMAC for security verification
  const dataToHash = `${registrationId}:${eventId}:${participantEmail}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', process.env.QR_SECRET || 'default-secret')
    .update(dataToHash)
    .digest('hex');
  
  return {
    registrationId,
    eventId,
    participantEmail,
    timestamp,
    expiryTime,
    hash: hmac
  };
}

/**
 * Generate QR code image as base64 data URL
 * @param {Object} qrData - The QR code data payload
 * @returns {Promise<string>} Base64 data URL of QR code image
 */
export async function generateQRCodeImage(qrData) {
  try {
    // If qrData has a gated_verify_url, use that as the QR content (Gated gate-entry QR)
    // If qrData has a simple_qr string, use that (Christ member QR)
    // Otherwise, stringify the full object (legacy SOCIO attendance QR)
    let qrString;
    let qrColor = '#154CB3'; // Default brand blue

    if (qrData.gated_verify_url) {
      qrString = qrData.gated_verify_url;
      qrColor = '#092987'; // Gated Deep Blue for outsider gate passes
    } else if (qrData.simple_qr) {
      qrString = qrData.simple_qr;
    } else {
      qrString = JSON.stringify(qrData);
    }

    const qrCodeOptions = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: qrColor,
        light: '#FFFFFF'
      },
      width: 256
    };
    
    const dataUrl = await QRCode.toDataURL(qrString, qrCodeOptions);
    return dataUrl;
  } catch (error) {
    throw new Error('Failed to generate QR code image: ' + error.message);
  }
}

/**
 * Verify QR code data integrity and validity
 * @param {Object} qrData - The QR code data payload
 * @returns {Object} Validation result with status and message
 */
export function verifyQRCodeData(qrData) {
  try {
    const { registrationId, eventId, participantEmail, timestamp, expiryTime, hash } = qrData;
    
    // Check required fields
    if (!registrationId || !eventId || !participantEmail || !timestamp || !hash) {
      return { valid: false, message: 'Invalid QR code data: missing required fields' };
    }
    
    // Prepare data for hashing
    const dataToHash = `${registrationId}:${eventId}:${participantEmail}:${timestamp}`;
    
    // 1. Check Modern HMAC (Highest Priority)
    const hmacHash = crypto.createHmac('sha256', process.env.QR_SECRET || 'default-secret')
      .update(dataToHash)
      .digest('hex');
    
    if (hash === hmacHash) {
      if (Date.now() > expiryTime) {
        console.warn(`[QR] HMAC valid but EXPIRED. Reg: ${registrationId}, Expiry: ${new Date(expiryTime).toISOString()}`);
        return { valid: false, message: 'QR code has expired' };
      }
      return { valid: true, message: 'QR code is valid (HMAC verified)' };
    }

    // 2. Check Legacy Hash (Fallback)
    const legacyHash = crypto.createHash('sha256')
      .update(dataToHash + (process.env.QR_SECRET || 'default-secret'))
      .digest('hex');
    
    if (hash === legacyHash) {
      console.log(`[QR] Legacy hash verified. Reg: ${registrationId}`);
      return { valid: true, message: 'QR code is valid (Legacy verified)' };
    }
    
    console.error(`[QR] Verification failed. Reg: ${registrationId}. Hash received: ${hash.substring(0, 8)}... Expected HMAC: ${hmacHash.substring(0, 8)}... Expected Legacy: ${legacyHash.substring(0, 8)}...`);
    return { valid: false, message: 'Invalid QR code: security verification failed' };
  } catch (error) {
    console.error(`[QR] Parsing error:`, error);
    return { valid: false, message: 'Invalid QR code format' };
  }
}

/**
 * Parse QR code string data
 * @param {string|Object} qrString - The QR code string or already parsed object
 * @returns {Object} Parsed QR data or null if invalid
 */
export function parseQRCodeData(qrString) {
  if (typeof qrString === 'object' && qrString !== null) {
    return qrString;
  }
  
  try {
    return JSON.parse(qrString);
  } catch (error) {
    return null;
  }
}
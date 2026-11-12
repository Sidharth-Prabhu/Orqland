"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SENSITIVE_INFO_PATTERNS = void 0;
exports.detectSensitiveContent = detectSensitiveContent;
/**
 * Prohibited Sensitive Information regex patterns (DLP)
 * Covers credit/debit card numbers, CVV, OTP/PIN, Bank Account / IBAN / IFSC,
 * passwords / credentials, SSN, Aadhaar card, and Passport.
 */
exports.SENSITIVE_INFO_PATTERNS = [
    // Credit / Debit Card numbers (13-19 digits with optional spaces/dashes)
    /\b(?:\d[ -]*?){13,19}\b/,
    // CVV / CVC (3-4 digits labeled as cvv/cvc)
    /\b(?:cvv|cvc|security\s*code)\s*[:=]?\s*\d{3,4}\b/i,
    // OTPs / PINs / Verification Codes (e.g. "otp is 123456", "otp: 1234", "pin is 4321")
    /\b(?:otp|one[- ]?time[- ]?pass(?:code|word)?|pin|verification\s*code|auth\s*code)\b(?:\s*(?:is|was|:|=|-)+)?\s*\d{4,8}\b/i,
    // Bank Account Numbers, IBAN, Routing numbers, IFSC
    /\b(?:account|acct|iban|routing|ifsc|swift|bank\s*a\/c)\s*(?:no|number|#)?\s*(?:is|was|:|=|-)?\s*[0-9A-Z]{6,34}\b/i,
    // Passwords / Credentials (e.g. "password is secret", "password: abc", "pwd = 123")
    /\b(?:password|passwd|pwd|passcode|secret\s*key)\b(?:\s*(?:is|was|:|=|-)+)?\s*\S{4,}\b/i,
    // National Identity Documents (SSN, Aadhaar 12-digit, Passport)
    /\b\d{3}-\d{2}-\d{4}\b/, // US SSN
    /\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/, // Indian Aadhaar card
    /\b[A-Z][0-9]{7,8}\b/, // Passport number format
];
/**
 * Shared DLP detection function for both client UX warnings and server-side hard enforcement.
 */
function detectSensitiveContent(text) {
    if (!text) {
        return { hasSensitiveData: false, isBlocked: false };
    }
    for (const pattern of exports.SENSITIVE_INFO_PATTERNS) {
        if (pattern.test(text)) {
            return {
                hasSensitiveData: true,
                isBlocked: true,
                reason: 'Sensitive credentials, financial details, or identity document detected.',
                warning: 'Orqland Safety Notice: Never share passwords, OTPs, card numbers, or confidential documents through chat.',
            };
        }
    }
    // Non-blocking phone number warning
    const phonePattern = /(?:(?:\+|00)\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?[6-9]\d{9}\b|\b(?:\d{3}[-.\s]?){3}\d\b/;
    if (phonePattern.test(text)) {
        return {
            hasSensitiveData: true,
            isBlocked: false,
            warning: 'Contact Safety Notice: Please avoid sharing personal mobile numbers in chat.',
        };
    }
    return { hasSensitiveData: false, isBlocked: false };
}
//# sourceMappingURL=dlp.js.map
/**
 * Prohibited Sensitive Information regex patterns (DLP)
 * Covers credit/debit card numbers, CVV, OTP/PIN, Bank Account / IBAN / IFSC,
 * passwords / credentials, SSN, Aadhaar card, and Passport.
 */
export declare const SENSITIVE_INFO_PATTERNS: RegExp[];
export interface DlpDetectionResult {
    hasSensitiveData: boolean;
    isBlocked: boolean;
    reason?: string;
    warning?: string;
}
/**
 * Shared DLP detection function for both client UX warnings and server-side hard enforcement.
 */
export declare function detectSensitiveContent(text: string): DlpDetectionResult;
//# sourceMappingURL=dlp.d.ts.map
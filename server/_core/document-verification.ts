import Tesseract from 'tesseract.js';
import * as db from '../db';

/**
 * Document Verification using OCR
 * Extracts text from ID documents and validates against loan application data
 */

export interface ExtractedIDData {
  fullName?: string;
  dateOfBirth?: string;
  address?: string;
  idNumber?: string;
  expirationDate?: string;
  state?: string;
  extractedText?: string;
}

export interface VerificationResult {
  success: boolean;
  confidenceScore: number; // 0-100
  flags: VerificationFlag[];
  extractedData: ExtractedIDData;
  autoApproved: boolean;
  message: string;
}

export interface VerificationFlag {
  field: string;
  severity: 'warning' | 'error';
  message: string;
  expected?: string;
  actual?: string;
}

/**
 * Extract text from document image using OCR
 */
export async function extractTextFromDocument(
  imagePath: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    console.log('[OCR] Starting text extraction from:', imagePath);
    
    const result = await Tesseract.recognize(imagePath, 'eng', {
      logger: (info) => {
        if (info.status === 'recognizing text') {
          console.log(`[OCR] Progress: ${Math.round(info.progress * 100)}%`);
        }
      },
    });

    console.log('[OCR] Text extraction complete');
    return {
      success: true,
      text: result.data.text,
    };
  } catch (error: any) {
    console.error('[OCR] Text extraction failed:', error);
    return {
      success: false,
      error: error.message || 'OCR processing failed',
    };
  }
}

/**
 * Parse driver's license or ID card data from extracted text
 */
export function parseIDDocument(text: string): ExtractedIDData {
  const data: ExtractedIDData = {
    extractedText: text,
  };

  // Clean and normalize text
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);

  // Extract name (usually first significant line or after "NAME")
  const namePatterns = [
    /(?:NAME|LN|LAST NAME)[:\s]*(.*?)(?:\n|$)/i,
    /^([A-Z]+\s+[A-Z]+(?:\s+[A-Z]+)?)\s*$/m,
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.fullName = match[1].trim();
      break;
    }
  }

  // Extract Date of Birth (various formats)
  const dobPatterns = [
    /(?:DOB|DATE OF BIRTH|BIRTH DATE)[:\s]*(\d{2}[-\/]\d{2}[-\/]\d{4})/i,
    /\b(\d{2}[-\/]\d{2}[-\/]\d{4})\b/,
  ];

  for (const pattern of dobPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.dateOfBirth = match[1].replace(/[-]/g, '/');
      break;
    }
  }

  // Extract ID/DL Number
  const idPatterns = [
    /(?:DL|ID|LICENSE|NUMBER)[:\s#]*([A-Z0-9]{6,15})/i,
    /\b([A-Z]\d{7,8})\b/,
  ];

  for (const pattern of idPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      data.idNumber = match[1].trim();
      break;
    }
  }

  // Extract Address
  const addressPattern = /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)[,\s]+[A-Za-z\s]+[,\s]+[A-Z]{2}\s+\d{5})/i;
  const addressMatch = text.match(addressPattern);
  if (addressMatch) {
    data.address = addressMatch[1].trim();
  }

  // Extract State
  const statePattern = /\b([A-Z]{2})\s+\d{5}\b/;
  const stateMatch = text.match(statePattern);
  if (stateMatch) {
    data.state = stateMatch[1];
  }

  // Extract Expiration Date
  const expPatterns = [
    /(?:EXP|EXPIRES|EXPIRATION)[:\s]*(\d{2}[-\/]\d{2}[-\/]\d{4})/i,
    /\b(\d{2}[-\/]\d{2}[-\/]\d{4})\b/g,
  ];

  for (const pattern of expPatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 1) {
      // If multiple dates found, second one is likely expiration
      data.expirationDate = matches[1].replace(/[-]/g, '/');
      break;
    }
  }

  return data;
}

/**
 * Calculate similarity between two strings (0-100)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  
  // Simple character-based similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 100;
  
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  
  return Math.round((matches / longer.length) * 100);
}

/**
 * Verify extracted ID data against loan application
 */
export async function verifyDocumentData(
  loanApplicationId: number,
  extractedData: ExtractedIDData
): Promise<VerificationResult> {
  const application = await db.getLoanApplicationById(loanApplicationId);
  
  if (!application) {
    return {
      success: false,
      confidenceScore: 0,
      flags: [{ field: 'application', severity: 'error', message: 'Application not found' }],
      extractedData,
      autoApproved: false,
      message: 'Application not found',
    };
  }

  const flags: VerificationFlag[] = [];
  let totalScore = 0;
  let checksPerformed = 0;

  // Check Name
  if (extractedData.fullName) {
    const nameSimilarity = calculateSimilarity(
      extractedData.fullName,
      application.fullName
    );
    
    checksPerformed++;
    totalScore += nameSimilarity;

    if (nameSimilarity < 70) {
      flags.push({
        field: 'fullName',
        severity: nameSimilarity < 50 ? 'error' : 'warning',
        message: `Name mismatch: ${nameSimilarity}% match`,
        expected: application.fullName,
        actual: extractedData.fullName,
      });
    }
  }

  // Check Date of Birth
  if (extractedData.dateOfBirth && application.dateOfBirth) {
    const dobMatch = extractedData.dateOfBirth === application.dateOfBirth;
    
    checksPerformed++;
    totalScore += dobMatch ? 100 : 0;

    if (!dobMatch) {
      flags.push({
        field: 'dateOfBirth',
        severity: 'error',
        message: 'Date of birth does not match',
        expected: application.dateOfBirth,
        actual: extractedData.dateOfBirth,
      });
    }
  }

  // Check Address
  if (extractedData.address) {
    const applicationAddress = `${application.street}, ${application.city}, ${application.state} ${application.zipCode}`;
    const addressSimilarity = calculateSimilarity(
      extractedData.address,
      applicationAddress
    );
    
    checksPerformed++;
    totalScore += addressSimilarity;

    if (addressSimilarity < 60) {
      flags.push({
        field: 'address',
        severity: addressSimilarity < 40 ? 'error' : 'warning',
        message: `Address mismatch: ${addressSimilarity}% match`,
        expected: applicationAddress,
        actual: extractedData.address,
      });
    }
  }

  // Check State
  if (extractedData.state) {
    const stateMatch = extractedData.state === application.state;
    
    checksPerformed++;
    totalScore += stateMatch ? 100 : 50; // Partial credit if state extracted

    if (!stateMatch) {
      flags.push({
        field: 'state',
        severity: 'warning',
        message: 'State does not match',
        expected: application.state,
        actual: extractedData.state,
      });
    }
  }

  // Check Expiration Date (must be in future)
  if (extractedData.expirationDate) {
    try {
      const expDate = new Date(extractedData.expirationDate);
      const now = new Date();
      
      checksPerformed++;
      
      if (expDate < now) {
        totalScore += 0;
        flags.push({
          field: 'expirationDate',
          severity: 'error',
          message: 'ID has expired',
          actual: extractedData.expirationDate,
        });
      } else {
        totalScore += 100;
      }
    } catch {
      // Invalid date format
      flags.push({
        field: 'expirationDate',
        severity: 'warning',
        message: 'Could not parse expiration date',
        actual: extractedData.expirationDate,
      });
    }
  }

  // Calculate final confidence score
  const confidenceScore = checksPerformed > 0 
    ? Math.round(totalScore / checksPerformed) 
    : 0;

  // Auto-approve if confidence > 95% and no error-level flags
  const hasErrors = flags.some(f => f.severity === 'error');
  const autoApproved = confidenceScore >= 95 && !hasErrors;

  let message = '';
  if (autoApproved) {
    message = 'Document automatically verified and approved';
  } else if (confidenceScore >= 80) {
    message = 'Document requires manual review - minor discrepancies found';
  } else if (confidenceScore >= 60) {
    message = 'Document requires manual review - multiple discrepancies found';
  } else {
    message = 'Document verification failed - significant mismatches detected';
  }

  return {
    success: true,
    confidenceScore,
    flags,
    extractedData,
    autoApproved,
    message,
  };
}

/**
 * Process document verification (combines OCR + validation)
 */
export async function processDocumentVerification(
  loanApplicationId: number,
  documentPath: string
): Promise<VerificationResult> {
  console.log(`[Document Verification] Processing document for loan ${loanApplicationId}`);

  // Step 1: Extract text using OCR
  const ocrResult = await extractTextFromDocument(documentPath);
  
  if (!ocrResult.success || !ocrResult.text) {
    return {
      success: false,
      confidenceScore: 0,
      flags: [{ 
        field: 'ocr', 
        severity: 'error', 
        message: ocrResult.error || 'OCR processing failed' 
      }],
      extractedData: {},
      autoApproved: false,
      message: 'Could not extract text from document',
    };
  }

  // Step 2: Parse ID data from extracted text
  const extractedData = parseIDDocument(ocrResult.text);
  
  // Step 3: Verify against application data
  const verificationResult = await verifyDocumentData(loanApplicationId, extractedData);

  // Step 4: Update document status in database
  try {
    await db.updateDocumentVerificationStatus(
      loanApplicationId,
      verificationResult.autoApproved ? 'verified' : 'pending_review',
      {
        confidenceScore: verificationResult.confidenceScore,
        flags: JSON.stringify(verificationResult.flags),
        extractedData: JSON.stringify(extractedData),
      }
    );
  } catch (error) {
    console.error('[Document Verification] Failed to update status:', error);
  }

  return verificationResult;
}

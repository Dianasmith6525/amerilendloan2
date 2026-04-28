import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getLoanApplicationById,
  addLoanDocument,
  getLoanDocument
} from "../db";
import { sdk } from "./sdk";
import { logger } from "./logger";
import { storagePut, storageGet } from "../storage";
import { ENV } from "./env";

// Legacy uploads directory — only used as a fallback when external storage is
// unavailable, and to support reading documents uploaded by older builds. New
// uploads are pushed to the configured storage proxy via storagePut.
const UPLOADS_DIR = path.resolve('uploads');

// Configure multer with in-memory storage so the buffer can be streamed to
// external object storage. Disk storage is ephemeral on Railway/Vercel and
// is not shared between instances, so files would silently disappear.
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    cb(new Error('Invalid file extension. Only JPG, PNG, and PDF files are allowed.'));
    return;
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
    return;
  }
  
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10, // Max 10 files at once
  },
});

// Upload handler
export async function handleFileUpload(req: Request, res: Response) {
  try {
    // Authenticate user
    const user = await sdk.authenticateRequest(req);

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { loanApplicationId, documentType } = req.body;

    if (!loanApplicationId) {
      return res.status(400).json({ error: 'Loan application ID is required' });
    }

    // Verify user owns the loan application
    const loan = await getLoanApplicationById(parseInt(loanApplicationId));
    if (!loan || loan.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Persist file to durable storage. Prefer external object storage so files
    // survive container restarts and are reachable from every server instance.
    const safeName = req.file.originalname.replace(/[^A-Za-z0-9._-]/g, '_');
    const storageKey = `loan-documents/${loan.id}/${Date.now()}-${safeName}`;
    let storedPath = storageKey;

    if (ENV.forgeApiUrl && ENV.forgeApiKey) {
      try {
        await storagePut(storageKey, req.file.buffer, req.file.mimetype);
      } catch (storageError) {
        logger.error('Upload: external storage failed, falling back to local disk', storageError);
        storedPath = await writeToLocalFallback(storageKey, req.file.buffer);
      }
    } else {
      logger.warn('Upload: storage not configured, using local disk fallback');
      storedPath = await writeToLocalFallback(storageKey, req.file.buffer);
    }

    // Save document metadata. filePath stores the storage key (or local path
    // for the fallback); handleFileDownload routes appropriately on read.
    const document = await addLoanDocument({
      loanApplicationId: parseInt(loanApplicationId),
      documentType: documentType || 'other',
      fileName: req.file.originalname,
      filePath: storedPath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: user.id,
    });

    res.json({
      success: true,
      document,
    });

  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    });
  }
}

async function writeToLocalFallback(storageKey: string, buffer: Buffer): Promise<string> {
  await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
  // Flatten the storage key so we don't try to mkdir nested folders per upload.
  const flatName = storageKey.replace(/[\/]+/g, '_');
  const target = path.join(UPLOADS_DIR, flatName);
  await fs.promises.writeFile(target, buffer);
  return target;
}

// Download handler
export async function handleFileDownload(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);

    const documentId = parseInt(req.params.id);
    const document = await getLoanDocument(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Verify user has access to this document
    const loan = await getLoanApplicationById(document.loanApplicationId);
    if (!loan || (loan.userId !== user.id && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If the stored filePath is an absolute local path (legacy uploads or
    // fallback), serve the file directly. Otherwise treat it as a storage
    // key and fetch a fresh signed URL.
    if (path.isAbsolute(document.filePath)) {
      const resolvedPath = path.resolve(document.filePath);
      if (!resolvedPath.startsWith(UPLOADS_DIR)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ error: 'File no longer available' });
      }
      return res.download(resolvedPath, document.fileName);
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      logger.warn('Download: storage not configured but document references storage key', { documentId });
      return res.status(503).json({ error: 'File storage not configured' });
    }

    try {
      const { url } = await storageGet(document.filePath);
      return res.redirect(302, url);
    } catch (storageError) {
      logger.error('Download: failed to resolve storage URL', storageError);
      return res.status(502).json({ error: 'Failed to retrieve file from storage' });
    }

  } catch (error) {
    logger.error('Download error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Download failed' 
    });
  }
}

import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import { 
  getLoanApplicationById,
  addLoanDocument,
  getLoanDocument
} from "../db";
import { sdk } from "./sdk";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 50);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  
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

    // Save document metadata
    const document = await addLoanDocument({
      loanApplicationId: parseInt(loanApplicationId),
      documentType: documentType || 'other',
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: user.id,
    });

    res.json({
      success: true,
      document,
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    });
  }
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

    // Send file
    res.download(document.filePath, document.fileName);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Download failed' 
    });
  }
}

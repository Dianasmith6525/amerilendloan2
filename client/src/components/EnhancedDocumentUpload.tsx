import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  File, 
  FileText, 
  Image, 
  X, 
  CheckCircle, 
  AlertCircle,
  Eye,
  Download,
  Loader2
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface EnhancedDocumentUploadProps {
  loanApplicationId: number;
  onUploadComplete?: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

const ACCEPTED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function EnhancedDocumentUpload({ loanApplicationId, onUploadComplete }: EnhancedDocumentUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string } | null>(null);

  const utils = trpc.useUtils();

  // File validation
  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File ${file.name} is too large. Maximum size is 10MB.`;
    }

    // Check file type
    const fileType = file.type;
    if (!Object.keys(ACCEPTED_FILE_TYPES).includes(fileType)) {
      return `File ${file.name} has unsupported type. Please upload JPG, PNG, or PDF files.`;
    }

    // Check file name
    if (file.name.length > 255) {
      return `File name is too long. Maximum 255 characters.`;
    }

    // Check for malicious file names
    if (/[<>:"|?*]/.test(file.name)) {
      return `File name contains invalid characters.`;
    }

    return null;
  };

  // Drag and drop handler
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles: File[] = [];
    
    // Validate all files
    for (const file of acceptedFiles) {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Initialize upload tracking
    const newUploadingFiles = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload each file
    validFiles.forEach((file, index) => {
      uploadFile(file, newUploadingFiles.length - validFiles.length + index);
    });
  }, [loanApplicationId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  // Upload file with progress tracking
  const uploadFile = async (file: File, index: number) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('loanApplicationId', loanApplicationId.toString());
      formData.append('documentType', determineDocumentType(file.name));

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev => {
          const updated = [...prev];
          if (updated[index] && updated[index].progress < 90) {
            updated[index] = { ...updated[index], progress: updated[index].progress + 10 };
          }
          return updated;
        });
      }, 200);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      // Update to success
      setUploadingFiles(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], progress: 100, status: 'success' };
        return updated;
      });

      toast.success(`${file.name} uploaded successfully!`);
      
      // Refresh document list
      setTimeout(() => {
        // utils.loans.getLoanDocuments.invalidate({ loanApplicationId }); // TODO: Add getLoanDocuments endpoint
        onUploadComplete?.();
      }, 500);

    } catch (error) {
      setUploadingFiles(prev => {
        const updated = [...prev];
        updated[index] = { 
          ...updated[index], 
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed'
        };
        return updated;
      });

      toast.error(`Failed to upload ${file.name}`);
    }
  };

  // Determine document type from filename
  const determineDocumentType = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.includes('id') || lower.includes('license') || lower.includes('passport')) {
      return 'id';
    }
    if (lower.includes('income') || lower.includes('pay') || lower.includes('w2') || lower.includes('tax')) {
      return 'income';
    }
    if (lower.includes('bank') || lower.includes('statement')) {
      return 'bank_statement';
    }
    return 'other';
  };

  // Preview file
  const handlePreview = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewFile({ url, type: file.type });
  };

  // Remove file from upload queue
  const handleRemove = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Get file icon
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-5 w-5" />;
    }
    if (fileType === 'application/pdf') {
      return <FileText className="h-5 w-5" />;
    }
    return <File className="h-5 w-5" />;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>
            Drag and drop files or click to browse. Accepted formats: JPG, PNG, PDF (max 10MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            {isDragActive ? (
              <p className="text-lg font-medium text-blue-600">Drop files here...</p>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  JPG, PNG, PDF up to 10MB each
                </p>
              </>
            )}
          </div>

          {/* Uploading Files List */}
          {uploadingFiles.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold text-sm">Uploading Files</h3>
              {uploadingFiles.map((item, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(item.file.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'success' && (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      )}
                      {item.status === 'error' && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                      {item.status === 'uploading' && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}

                      {item.status !== 'success' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(item.file)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {item.status === 'uploading' && (
                    <Progress value={item.progress} className="h-2" />
                  )}

                  {/* Error Message */}
                  {item.status === 'error' && item.error && (
                    <p className="text-xs text-red-600">{item.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div className="max-w-4xl w-full bg-white rounded-lg p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">File Preview</h3>
              <Button variant="ghost" size="sm" onClick={() => setPreviewFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {previewFile.type.startsWith('image/') ? (
              <img src={previewFile.url} alt="Preview" className="max-w-full h-auto mx-auto" />
            ) : (
              <iframe src={previewFile.url} className="w-full h-[600px]" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

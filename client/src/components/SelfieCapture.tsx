import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { 
  Camera, 
  User, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  RefreshCw, 
  Upload,
  Shield,
  AlertTriangle,
  CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  under_review: "bg-blue-100 text-blue-800 border-blue-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  expired: "bg-gray-100 text-gray-800 border-gray-300",
};

const statusIcons = {
  pending: Clock,
  under_review: Loader2,
  approved: CheckCircle2,
  rejected: XCircle,
  expired: XCircle,
};

export default function SelfieCapture() {
  const { isAuthenticated } = useAuth();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const utils = trpc.useUtils();
  
  // Check if user already has a selfie_with_id document
  const { data: documents } = trpc.verification.myDocuments.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const selfieDocument = documents?.find(doc => doc.documentType === "selfie_with_id");

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          // Portrait framing — better suited to head + ID verification
          // than the default landscape webcam stream.
          width: { ideal: 720 },
          height: { ideal: 960 },
          aspectRatio: { ideal: 3 / 4 },
        },
        audio: false
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      setCameraActive(true);
    } catch (error: unknown) {
      console.error("Camera error:", error);
      const err = error as Error & { name?: string };
      if (err.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (err.name === "NotFoundError") {
        setCameraError("No camera found. Please connect a camera and try again.");
      } else {
        setCameraError("Unable to access camera. Please try again.");
      }
      setCameraActive(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Center-crop to a 3:4 portrait so the saved photo matches the on-screen
    // framing aperture instead of the raw (often landscape) sensor stream.
    const sw = video.videoWidth;
    const sh = video.videoHeight;
    const targetRatio = 3 / 4; // width / height
    let cropW = sw;
    let cropH = Math.round(sw / targetRatio);
    if (cropH > sh) {
      cropH = sh;
      cropW = Math.round(sh * targetRatio);
    }
    const sx = Math.round((sw - cropW) / 2);
    const sy = Math.round((sh - cropH) / 2);

    canvas.width = cropW;
    canvas.height = cropH;

    // Mirror image if using front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    // Draw the cropped video region to canvas
    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

    // Convert to data URL
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageDataUrl);
    stopCamera();
  }, [facingMode, stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const switchCamera = useCallback(() => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  }, []);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (cameraActive) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Attach the active stream to the <video> element after it mounts.
  // setCameraActive(true) triggers the render that creates the video node,
  // so assigning srcObject inside startCamera ran before the ref existed.
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.error("Video play() failed:", err);
      });
    }
  }, [cameraActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const uploadSelfie = async () => {
    if (!capturedImage) {
      toast.error("Please capture a photo first");
      return;
    }

    setUploading(true);

    try {
      // Convert data URL to Blob without using fetch() — fetch() against a
      // data: URI is blocked by our connect-src CSP. Decoding the base64
      // payload directly is faster and CSP-safe.
      const commaIdx = capturedImage.indexOf(",");
      const meta = capturedImage.slice(5, commaIdx); // strip leading "data:"
      const isBase64 = meta.endsWith(";base64");
      const mimeType = (isBase64 ? meta.slice(0, -7) : meta) || "image/jpeg";
      const payload = capturedImage.slice(commaIdx + 1);
      let blob: Blob;
      if (isBase64) {
        const binary = atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        blob = new Blob([bytes], { type: mimeType });
      } else {
        blob = new Blob([decodeURIComponent(payload)], { type: mimeType });
      }

      // Create file from blob
      const file = new File([blob], `selfie_with_id_${Date.now()}.jpg`, { type: "image/jpeg" });

      // Upload via FormData
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload-document", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadResponse.ok) {
        let errorMessage = "Upload failed";
        try {
          const errorData = await uploadResponse.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = uploadResponse.statusText || `Upload failed with status ${uploadResponse.status}`;
        }
        throw new Error(errorMessage);
      }

      const uploadedFile = await uploadResponse.json();

      if (!uploadedFile.url) {
        throw new Error("Upload endpoint did not return a file URL");
      }

      // Register document in database
      await utils.client.verification.uploadDocument.mutate({
        documentType: "selfie_with_id",
        fileName: uploadedFile.fileName,
        filePath: uploadedFile.url,
        fileSize: uploadedFile.fileSize,
        mimeType: uploadedFile.mimeType,
      });

      toast.success("Selfie with ID uploaded successfully! Verification will be processed shortly.");
      setCapturedImage(null);
      utils.verification.myDocuments.invalidate();
    } catch (error) {
      console.error("Upload error:", error);
      const message = error instanceof Error ? error.message : "Failed to upload selfie";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#0033A0]" />
          Identity Verification - Selfie with ID
        </CardTitle>
        <CardDescription>
          Take a clear photo of yourself holding your government-issued ID card to verify your identity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge if document exists */}
        {selfieDocument && (
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium">Selfie Verification</p>
                <p className="text-sm text-gray-500">
                  Uploaded {new Date(selfieDocument.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Badge className={`${statusColors[selfieDocument.status]} border`}>
              {React.createElement(statusIcons[selfieDocument.status], {
                className: `w-3 h-3 mr-1 ${selfieDocument.status === "under_review" ? "animate-spin" : ""}`
              })}
              {selfieDocument.status.replace("_", " ").toUpperCase()}
            </Badge>
          </div>
        )}

        {selfieDocument?.status === "rejected" && selfieDocument.rejectionReason && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Verification Rejected</p>
              <p className="text-sm text-red-600">{selfieDocument.rejectionReason}</p>
              <p className="text-sm text-red-600 mt-1">Please take a new photo following the guidelines below.</p>
            </div>
          </div>
        )}

        {/* Guidelines */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="font-semibold text-[#0033A0] mb-2 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Photo Requirements:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>Hold your ID card clearly visible next to your face</li>
            <li>Ensure your face and the ID photo are both clearly visible</li>
            <li>Make sure the ID details (name, photo, date of birth) are readable</li>
            <li>Use good lighting - avoid shadows on your face or ID</li>
            <li>Remove glasses, hats, or anything covering your face</li>
            <li>Look directly at the camera</li>
          </ul>
        </div>

        {/* Camera / Capture Area */}
        {!selfieDocument || selfieDocument.status === "rejected" ? (
          <div className="space-y-4">
            {!cameraActive && !capturedImage && (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <User className="w-16 h-16 text-gray-400 mb-4" />
                <p className="text-gray-600 text-center mb-4">
                  Click the button below to start your camera and take a verification photo
                </p>
                <Button onClick={startCamera} className="gap-2">
                  <Camera className="w-4 h-4" />
                  Start Camera
                </Button>
                {cameraError && (
                  <p className="text-red-500 text-sm mt-4 text-center">{cameraError}</p>
                )}
              </div>
            )}

            {cameraActive && !capturedImage && (
              <div className="space-y-4">
                <div className="relative bg-black rounded-lg overflow-hidden mx-auto w-full max-w-sm aspect-[3/4]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 w-full h-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
                  />
                  {/* Face/ID guide overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="w-44 h-56 border-2 border-white/60 rounded-[50%/40%] flex flex-col items-center justify-center">
                        <User className="w-12 h-12 text-white/60" />
                        <p className="text-white/70 text-xs mt-2 text-center px-2">
                          Center your face & ID here
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={switchCamera} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Switch Camera
                  </Button>
                  <Button onClick={capturePhoto} size="lg" className="gap-2 px-8">
                    <Camera className="w-5 h-5" />
                    Capture Photo
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="space-y-4">
                <div className="relative bg-gray-100 rounded-lg overflow-hidden mx-auto w-full max-w-sm aspect-[3/4]">
                  <img
                    src={capturedImage}
                    alt="Captured selfie"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={retakePhoto} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Retake Photo
                  </Button>
                  <Button 
                    onClick={uploadSelfie} 
                    disabled={uploading}
                    size="lg" 
                    className="gap-2 px-8"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Submit for Verification
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Hidden canvas for image capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : (
          <div className="text-center py-4">
            {selfieDocument.status === "approved" ? (
              <div className="flex flex-col items-center text-green-600">
                <CheckCircle2 className="w-12 h-12 mb-2" />
                <p className="font-medium">Identity Verified</p>
                <p className="text-sm text-gray-500">Your selfie verification has been approved</p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-blue-600">
                <Loader2 className="w-12 h-12 mb-2 animate-spin" />
                <p className="font-medium">Verification In Progress</p>
                <p className="text-sm text-gray-500">Your selfie is being reviewed by our team</p>
              </div>
            )}
          </div>
        )}

        {/* Security Notice */}
        <div className="flex items-start gap-2 p-3 bg-gray-50 border rounded-lg">
          <Shield className="w-5 h-5 text-[#0033A0] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-700">Your security matters</p>
            <p>
              This verification helps protect you from identity theft and ensures that only you 
              can access loans in your name. Your photo is encrypted and stored securely.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

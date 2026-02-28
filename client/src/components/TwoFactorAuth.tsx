import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Shield, Smartphone, Key, Copy, Check, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

export default function TwoFactorAuth() {
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [setupStep, setSetupStep] = useState<"method" | "qr" | "verify" | "backup">("method");
  const [selectedMethod, setSelectedMethod] = useState<"sms" | "authenticator">("authenticator");
  const [verificationCode, setVerificationCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<number | null>(null);
  const [disablePassword, setDisablePassword] = useState("");

  // Fetch current 2FA status from server
  const { data: twoFASettings, isLoading: settingsLoading } = trpc.auth.get2FASettings.useQuery();
  const twoFactorEnabled = !!(twoFASettings as any)?.enabled;

  // Fetch login activity when 2FA is enabled
  const { data: loginActivity } = trpc.twoFactor.getLoginActivity.useQuery(
    undefined,
    { enabled: twoFactorEnabled }
  );

  const utils = trpc.useUtils();

  // Setup mutation — generates secret + QR code
  const setupMutation = trpc.twoFactor.setup.useMutation({
    onSuccess: (res) => {
      const data = (res as any).data ?? res;
      setTotpSecret(data.secret);
      setQrCodeUrl(data.qrCodeDataUrl || "");
      if (selectedMethod === "authenticator") {
        setSetupStep("qr");
      } else {
        setSetupStep("verify");
      }
    },
    onError: (err) => toast.error(err.message || "Failed to set up 2FA"),
  });

  // Verify mutation — validates code and enables 2FA
  const verifyMutation = trpc.twoFactor.verify.useMutation({
    onSuccess: (res) => {
      const data = (res as any).data ?? res;
      setBackupCodes(data.backupCodes || []);
      setSetupStep("backup");
    },
    onError: (err) => toast.error(err.message || "Invalid verification code"),
  });

  // Disable mutation
  const disableMutation = trpc.twoFactor.disable.useMutation({
    onSuccess: () => {
      toast.success("Two-factor authentication disabled");
      setShowDisableDialog(false);
      setDisablePassword("");
      utils.auth.get2FASettings.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to disable 2FA"),
  });

  // Regenerate backup codes
  const regenBackupMutation = trpc.twoFactor.generateBackupCodes.useMutation({
    onSuccess: (res) => {
      const data = (res as any).data ?? res;
      setBackupCodes(data.backupCodes || []);
      toast.success("Backup codes regenerated");
    },
    onError: (err) => toast.error(err.message || "Failed to regenerate backup codes"),
  });

  const handleEnable2FA = () => {
    setShowSetupDialog(true);
    setSetupStep("method");
    setVerificationCode("");
    setTotpSecret("");
    setQrCodeUrl("");
    setBackupCodes([]);
  };

  const handleMethodSelect = (method: "sms" | "authenticator") => {
    setSelectedMethod(method);
    setupMutation.mutate({ method });
  };

  const handleVerifyCode = () => {
    if (verificationCode.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }
    verifyMutation.mutate({
      code: verificationCode,
      secret: totpSecret,
      method: selectedMethod,
    });
  };

  const handleFinishSetup = () => {
    setShowSetupDialog(false);
    utils.auth.get2FASettings.invalidate();
    toast.success("Two-factor authentication enabled!");
  };

  const handleDisable2FA = () => {
    if (!disablePassword.trim()) {
      toast.error("Please enter your password");
      return;
    }
    disableMutation.mutate({ password: disablePassword });
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(index);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const activityList = Array.isArray(loginActivity) ? loginActivity :
    (loginActivity as any)?.data && Array.isArray((loginActivity as any).data) ? (loginActivity as any).data : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[#0033A0] flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Banner */}
          <div className={`p-4 rounded-lg border-2 ${
            twoFactorEnabled
              ? "bg-green-50 border-green-300"
              : "bg-amber-50 border-amber-300"
          }`}>
            <div className="flex items-start gap-3">
              {twoFactorEnabled ? (
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-semibold ${
                  twoFactorEnabled ? "text-green-900" : "text-amber-900"
                }`}>
                  {twoFactorEnabled ? "2FA is Active" : "2FA is Not Enabled"}
                </p>
                <p className={`text-sm mt-1 ${
                  twoFactorEnabled ? "text-green-700" : "text-amber-700"
                }`}>
                  {twoFactorEnabled
                    ? `Your account is protected with ${(twoFASettings as any)?.method || "authenticator"} two-factor authentication`
                    : "Enable 2FA to secure your account with an additional verification step"}
                </p>
              </div>
            </div>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#0033A0]" />
              <div>
                <Label className="font-medium cursor-pointer">
                  Two-Factor Authentication
                </Label>
                <p className="text-sm text-gray-500">
                  {twoFactorEnabled
                    ? `Currently using ${(twoFASettings as any)?.method === "sms" ? "SMS" : "Authenticator App"}`
                    : "Require verification code on login"}
                </p>
              </div>
            </div>
            <Switch
              checked={twoFactorEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleEnable2FA();
                } else {
                  setShowDisableDialog(true);
                }
              }}
            />
          </div>

          {/* Regenerate backup codes */}
          {twoFactorEnabled && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Backup Codes</p>
                <p className="text-xs text-gray-500">Regenerate if you've used or lost your backup codes</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenBackupMutation.mutate()}
                disabled={regenBackupMutation.isPending}
              >
                {regenBackupMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Regenerate
              </Button>
            </div>
          )}

          {/* Show newly generated backup codes */}
          {backupCodes.length > 0 && !showSetupDialog && (
            <div className="space-y-3 border rounded-lg p-4 bg-amber-50">
              <p className="text-sm font-semibold text-amber-900">⚠️ Your Backup Codes (save these now)</p>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <button
                    key={index}
                    onClick={() => copyToClipboard(code, index)}
                    className="p-2 bg-white rounded border hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs font-mono">{code}</code>
                      {copiedCode === index ? (
                        <Check className="w-3 h-3 text-green-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Security Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Why Enable 2FA?
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✅ Protects against unauthorized access</li>
              <li>✅ Prevents account takeover even if password is compromised</li>
              <li>✅ Secures your financial information and transactions</li>
              <li>✅ Meets industry security standards</li>
            </ul>
          </div>

          {/* Login Activity */}
          {twoFactorEnabled && activityList.length > 0 && (
            <div className="border-t pt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Recent Login Activity</h4>
              <div className="space-y-3">
                {activityList.slice(0, 5).map((activity: any, idx: number) => (
                  <div key={activity.id ?? idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">
                        {activity.action || activity.description || "Login"}
                      </p>
                      <p className="text-xs text-gray-600">
                        {activity.ipAddress && `${activity.ipAddress} • `}
                        {activity.userAgent ? activity.userAgent.split(" ")[0] : ""}
                        {activity.createdAt && ` • ${new Date(activity.createdAt).toLocaleString()}`}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold ${idx === 0 ? "text-green-600" : "text-gray-500"}`}>
                      {idx === 0 ? "LATEST" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              {setupStep === "method" && "Choose your preferred verification method"}
              {setupStep === "qr" && "Scan the QR code with your authenticator app"}
              {setupStep === "verify" && "Enter the verification code"}
              {setupStep === "backup" && "Save your backup codes"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Step 1: Choose Method */}
            {setupStep === "method" && (
              <div className="space-y-3">
                <button
                  onClick={() => handleMethodSelect("authenticator")}
                  disabled={setupMutation.isPending}
                  className="w-full p-4 border-2 rounded-lg hover:border-[#0033A0] hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Key className="w-6 h-6 text-[#0033A0]" />
                    <div>
                      <p className="font-semibold">Authenticator App</p>
                      <p className="text-sm text-gray-600">Use Google Authenticator or similar</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleMethodSelect("sms")}
                  disabled={setupMutation.isPending}
                  className="w-full p-4 border-2 rounded-lg hover:border-[#0033A0] hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-6 h-6 text-[#0033A0]" />
                    <div>
                      <p className="font-semibold">SMS Text Message</p>
                      <p className="text-sm text-gray-600">Receive codes via text</p>
                    </div>
                  </div>
                </button>

                {setupMutation.isPending && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
                    <span className="text-sm text-gray-600">Setting up...</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: QR Code */}
            {setupStep === "qr" && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-block p-4 bg-white border-2 rounded-lg">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Or enter this code manually:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-sm bg-white p-2 rounded border break-all">
                      {totpSecret}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(totpSecret, -1)}
                    >
                      {copiedCode === -1 ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <Button onClick={() => setSetupStep("verify")} className="w-full">
                  Continue
                </Button>
              </div>
            )}

            {/* Step 3: Verify Code */}
            {setupStep === "verify" && (
              <div className="space-y-4">
                <div>
                  <Label>Enter 6-Digit Code</Label>
                  <Input
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl font-mono tracking-widest"
                  />
                </div>
                <Button
                  onClick={handleVerifyCode}
                  className="w-full"
                  disabled={verificationCode.length !== 6 || verifyMutation.isPending}
                >
                  {verifyMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                  ) : (
                    "Verify Code"
                  )}
                </Button>
              </div>
            )}

            {/* Step 4: Backup Codes */}
            {setupStep === "backup" && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-900 font-semibold mb-1">
                    ⚠️ Save These Codes
                  </p>
                  <p className="text-xs text-amber-700">
                    Store these backup codes in a safe place. Each can be used once if you lose access to your device.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <button
                      key={index}
                      onClick={() => copyToClipboard(code, index)}
                      className="p-2 bg-gray-50 rounded border hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs font-mono">{code}</code>
                        {copiedCode === index ? (
                          <Check className="w-3 h-3 text-green-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                <Button onClick={handleFinishSetup} className="w-full bg-green-600 hover:bg-green-700">
                  I've Saved My Backup Codes
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your password to confirm. This will make your account less secure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDisableDialog(false); setDisablePassword(""); }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisable2FA} disabled={disableMutation.isPending}>
              {disableMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

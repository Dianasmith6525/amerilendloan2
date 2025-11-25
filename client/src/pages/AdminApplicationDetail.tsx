import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, ArrowLeft, User, FileText, CreditCard, Send, 
  AlertCircle, CheckCircle, XCircle, Clock, Download,
  Shield, MapPin, Briefcase, DollarSign, Calendar,
  Phone, Mail, Hash, Building, Eye, EyeOff
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  under_review: "bg-blue-100 text-blue-800 border-blue-300",
  approved: "bg-green-100 text-green-800 border-green-300",
  fee_pending: "bg-orange-100 text-orange-800 border-orange-300",
  fee_paid: "bg-purple-100 text-purple-800 border-purple-300",
  disbursed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  cancelled: "bg-gray-100 text-gray-800 border-gray-300",
};

export default function AdminApplicationDetail() {
  const [, params] = useRoute("/admin/application/:id");
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const applicationId = params?.id ? parseInt(params.id) : 0;
  const [showBankCredentials, setShowBankCredentials] = useState(false);
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [loadingPassword, setLoadingPassword] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, setLocation]);

  const { data, isLoading, error } = trpc.loans.adminGetApplicationDetails.useQuery(
    { id: applicationId },
    { enabled: !!applicationId && user?.role === "admin" }
  );

  const getBankPasswordQuery = trpc.loans.adminGetBankPassword.useQuery(
    { applicationId },
    { 
      enabled: false, // Only fetch when showBankCredentials is true
    }
  );

  // Fetch decrypted password when showing credentials
  useEffect(() => {
    if (showBankCredentials && !decryptedPassword && !loadingPassword) {
      setLoadingPassword(true);
      getBankPasswordQuery.refetch().then((result) => {
        if (result.data?.password) {
          setDecryptedPassword(result.data.password);
        }
        setLoadingPassword(false);
      }).catch(() => {
        setLoadingPassword(false);
        toast.error("Failed to decrypt password");
      });
    }
  }, [showBankCredentials]);

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">{error?.message || "Application not found"}</p>
            <Button onClick={() => setLocation("/admin")} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { application, user: applicantUser, payments, disbursement, documents, verificationDocs, kycVerification, activityLog } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/admin")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Application #{application.id}
                </h1>
                <p className="text-sm text-gray-600">
                  Tracking: {application.trackingNumber}
                </p>
              </div>
            </div>
            <Badge className={statusColors[application.status] || "bg-gray-100"}>
              {application.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="applicant">Applicant Info</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="disbursement">Disbursement</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Application Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Application Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Requested Amount</p>
                      <p className="text-xl font-bold text-gray-900">
                        ${(application.requestedAmount / 100).toLocaleString()}
                      </p>
                    </div>
                    {application.approvedAmount && (
                      <div>
                        <p className="text-sm text-gray-600">Approved Amount</p>
                        <p className="text-xl font-bold text-green-600">
                          ${(application.approvedAmount / 100).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {application.processingFeeAmount && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Processing Fee</span>
                      <div className="text-right">
                        <p className="font-bold text-blue-900">
                          ${(application.processingFeeAmount / 100).toFixed(2)}
                        </p>
                        {application.feePaymentVerified ? (
                          <Badge className="mt-1 bg-green-100 text-green-800 text-xs">
                            ✓ Verified
                          </Badge>
                        ) : application.status === "fee_paid" ? (
                          <Badge className="mt-1 bg-amber-100 text-amber-800 text-xs">
                            Pending Verification
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Loan Type</span>
                      <span className="font-medium capitalize">{application.loanType.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Disbursement Method</span>
                      <span className="font-medium capitalize">{application.disbursementMethod.replace('_', ' ')}</span>
                    </div>
                    
                    {/* Bank Account Details for Direct Deposit */}
                    {application.disbursementMethod === 'bank_transfer' && application.bankName && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-[#0033A0] text-sm flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Bank Account Information
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowBankCredentials(!showBankCredentials)}
                            className="h-7 text-xs"
                          >
                            {showBankCredentials ? (
                              <><EyeOff className="h-3 w-3 mr-1" /> Hide Credentials</>
                            ) : (
                              <><Eye className="h-3 w-3 mr-1" /> Show Credentials</>
                            )}
                          </Button>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Bank Name</span>
                          <span className="font-medium">{application.bankName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Online Banking Username</span>
                          {showBankCredentials ? (
                            <span className="font-medium font-mono text-xs bg-white px-2 py-1 rounded border border-blue-300">
                              {application.bankUsername || 'Not provided'}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-gray-400">••••••••</span>
                          )}
                        </div>
                        <div className="flex justify-between text-sm items-start">
                          <span className="text-gray-600">Password</span>
                          <div className="text-right">
                            {application.bankPassword ? (
                              showBankCredentials ? (
                                loadingPassword ? (
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span className="text-xs text-gray-500">Decrypting...</span>
                                  </div>
                                ) : decryptedPassword ? (
                                  <div className="space-y-1">
                                    <div className="font-mono text-xs bg-green-50 px-3 py-1.5 rounded border border-green-300 text-green-800 select-all">
                                      {decryptedPassword}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      Click to select and copy
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="font-mono text-xs bg-yellow-50 px-2 py-1 rounded border border-yellow-300 text-yellow-800">
                                      ⚠️ Failed to decrypt
                                    </div>
                                    <p className="text-xs text-gray-500 max-w-xs">
                                      Unable to decrypt password. Please contact support.
                                    </p>
                                  </div>
                                )
                              ) : (
                                <span className="text-green-600 flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Encrypted & Stored
                                </span>
                              )
                            ) : (
                              <span className="text-gray-400">Not provided</span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-blue-700 mt-2">
                          🔒 Bank credentials are encrypted for security and can be decrypted by admins for verification
                        </p>
                      </div>
                    )}
                    
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Applied On</span>
                      <span className="font-medium">
                        {new Date(application.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {application.approvedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Approved On</span>
                        <span className="font-medium">
                          {new Date(application.approvedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {application.disbursedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Disbursed On</span>
                        <span className="font-medium">
                          {new Date(application.disbursedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {application.loanPurpose && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Loan Purpose</p>
                        <p className="text-sm text-gray-900">{application.loanPurpose}</p>
                      </div>
                    </>
                  )}

                  {application.adminNotes && (
                    <>
                      <Separator />
                      <div className="bg-amber-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-amber-900 mb-1">Admin Notes</p>
                        <p className="text-sm text-amber-800 whitespace-pre-wrap">{application.adminNotes}</p>
                      </div>
                    </>
                  )}

                  {application.rejectionReason && (
                    <>
                      <Separator />
                      <div className="bg-red-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-red-900 mb-1">Rejection Reason</p>
                        <p className="text-sm text-red-800">{application.rejectionReason}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Financial Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Financial Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Monthly Income</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${(application.monthlyIncome / 100).toLocaleString()}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Employment Status</span>
                      <span className="font-medium capitalize">{application.employmentStatus.replace('_', ' ')}</span>
                    </div>
                    {application.employer && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Employer</span>
                        <span className="font-medium">{application.employer}</span>
                      </div>
                    )}
                  </div>

                  {payments && payments.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Payment Summary</p>
                        <div className="space-y-1">
                          {payments.map((payment) => (
                            <div key={payment.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                              <span className="capitalize">{payment.paymentMethod.replace('_', ' ')}</span>
                              <span className="font-medium">${(payment.amount / 100).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Applicant Info Tab */}
          <TabsContent value="applicant" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Full Name</p>
                    <p className="font-medium text-gray-900">{application.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date of Birth</p>
                    <p className="font-medium text-gray-900">{application.dateOfBirth}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">SSN</p>
                    <p className="font-medium text-gray-900 font-mono">{application.ssn}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium text-gray-900">{application.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium text-gray-900">{application.phone}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium text-gray-900">{application.street}</p>
                  <p className="text-gray-600">
                    {application.city}, {application.state} {application.zipCode}
                  </p>
                </CardContent>
              </Card>

              {/* Account Information */}
              {applicantUser && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Account Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">User ID</p>
                      <p className="font-medium text-gray-900">#{applicantUser.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Login Method</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {applicantUser.loginMethod?.replace('_', ' ') || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Account Created</p>
                      <p className="font-medium text-gray-900">
                        {new Date(applicantUser.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {applicantUser.lastSignedIn && (
                      <div>
                        <p className="text-sm text-gray-600">Last Sign In</p>
                        <p className="font-medium text-gray-900">
                          {new Date(applicantUser.lastSignedIn).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* KYC Verification Status */}
              {kycVerification && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      KYC Verification Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <Badge className={
                          kycVerification.status === 'approved' ? 'bg-green-100 text-green-800' :
                          kycVerification.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }>
                          {kycVerification.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">SSN Verification</p>
                        <p className="font-medium">{kycVerification.ssnVerified ? '✓ Verified' : '✗ Not Verified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Address Verification</p>
                        <p className="font-medium">{kycVerification.addressVerified ? '✓ Verified' : '✗ Not Verified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">ITIN Verification</p>
                        <p className="font-medium">{kycVerification.itinVerified ? '✓ Verified' : '✗ Not Verified'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {/* Uploaded Documents */}
              <Card>
                <CardHeader>
                  <CardTitle>Uploaded Documents ({documents?.length || 0})</CardTitle>
                  <CardDescription>Documents submitted with the application</CardDescription>
                </CardHeader>
                <CardContent>
                  {!documents || documents.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No documents uploaded</p>
                  ) : (
                    <div className="space-y-3">
                      {documents.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900 capitalize">
                                {doc.documentType.replace('_', ' ')}
                              </p>
                              <p className="text-sm text-gray-600">
                                Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Verification Documents */}
              {verificationDocs && verificationDocs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Verification Documents ({verificationDocs.length})</CardTitle>
                    <CardDescription>Identity and address verification documents</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {verificationDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900 capitalize">
                                {doc.documentType.replace('_', ' ')}
                              </p>
                              <p className="text-sm text-gray-600">
                                Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment History ({payments?.length || 0})</CardTitle>
                <CardDescription>All payments related to this application</CardDescription>
              </CardHeader>
              <CardContent>
                  {!payments || payments.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No payments found</p>
                  ) : (
                    <div className="space-y-3">
                      {payments.map((payment: any) => (
                      <div key={payment.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              Payment #{payment.id}
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(payment.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-gray-900">
                              ${(payment.amount / 100).toFixed(2)}
                            </p>
                            <Badge className={
                              payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                              payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {payment.status}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600">Method</p>
                            <p className="font-medium capitalize">{payment.paymentMethod.replace('_', ' ')}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Type</p>
                            <p className="font-medium capitalize">{payment.paymentType}</p>
                          </div>
                          {payment.transactionId && (
                            <div className="col-span-2">
                              <p className="text-gray-600">Transaction ID</p>
                              <p className="font-medium font-mono text-xs">{payment.transactionId}</p>
                            </div>
                          )}
                          {payment.cardLast4 && (
                            <div>
                              <p className="text-gray-600">Card</p>
                              <p className="font-medium">****{payment.cardLast4}</p>
                            </div>
                          )}
                          {payment.cardBrand && (
                            <div>
                              <p className="text-gray-600">Brand</p>
                              <p className="font-medium">{payment.cardBrand}</p>
                            </div>
                          )}
                        </div>

                        {payment.completedAt && (
                          <div className="mt-2 text-sm text-gray-600">
                            Completed: {new Date(payment.completedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Disbursement Tab */}
          <TabsContent value="disbursement" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Disbursement Information</CardTitle>
                <CardDescription>Loan disbursement details and tracking</CardDescription>
              </CardHeader>
              <CardContent>
                {!disbursement ? (
                  <p className="text-center text-gray-500 py-8">No disbursement initiated</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Disbursement ID</p>
                        <p className="font-medium text-gray-900">#{disbursement.id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Amount</p>
                        <p className="text-xl font-bold text-gray-900">
                          ${(disbursement.amount / 100).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <Badge>{disbursement.status}</Badge>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Account Holder</p>
                        <p className="font-medium text-gray-900">{disbursement.accountHolderName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Account Number</p>
                        <p className="font-medium text-gray-900 font-mono">
                          ****{disbursement.accountNumber.slice(-4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Routing Number</p>
                        <p className="font-medium text-gray-900 font-mono">{disbursement.routingNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Method</p>
                        <p className="font-medium text-gray-900">Check</p>
                      </div>
                    </div>

                    {disbursement.trackingNumber && (
                      <>
                        <Separator />
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-2">Tracking Information</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-sm text-blue-700">Tracking Number</p>
                              <p className="font-mono font-medium text-blue-900">{disbursement.trackingNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm text-blue-700">Carrier</p>
                              <p className="font-medium text-blue-900">{disbursement.trackingCompany}</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {disbursement.adminNotes && (
                      <>
                        <Separator />
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm font-medium text-gray-900 mb-1">Admin Notes</p>
                          <p className="text-sm text-gray-700">{disbursement.adminNotes}</p>
                        </div>
                      </>
                    )}

                    <Separator />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Initiated At</p>
                        <p className="font-medium">{new Date(disbursement.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Status</p>
                        <p className="font-medium capitalize">{disbursement.status}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Log Tab */}
          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Admin Activity Log</CardTitle>
                <CardDescription>All admin actions on this application</CardDescription>
              </CardHeader>
              <CardContent>
                {!activityLog || activityLog.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No activity recorded</p>
                ) : (
                  <div className="space-y-3">
                    {activityLog.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className={`p-2 rounded-full ${
                          log.action.includes('approve') ? 'bg-green-100' :
                          log.action.includes('reject') ? 'bg-red-100' :
                          log.action.includes('verify') ? 'bg-blue-100' :
                          'bg-gray-100'
                        }`}>
                          {log.action.includes('approve') ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                           log.action.includes('reject') ? <XCircle className="h-4 w-4 text-red-600" /> :
                           log.action.includes('verify') ? <Shield className="h-4 w-4 text-blue-600" /> :
                           <Clock className="h-4 w-4 text-gray-600" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 capitalize">
                            {log.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(log.createdAt).toLocaleString()}
                          </p>
                          {log.details && (
                            <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(JSON.parse(log.details), null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

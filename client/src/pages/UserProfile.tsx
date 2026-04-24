import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useState, useRef, useEffect } from 'react';
import { toTitleCase } from '@shared/format';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { CheckCircle, AlertCircle, Plus, Trash2, Edit2, Upload } from 'lucide-react';
import { toast } from 'sonner';

// Form schemas
const personalInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required').transform(toTitleCase),
  lastName: z.string().min(1, 'Last name is required').transform(toTitleCase),
  email: z.string().email('Invalid email'),
  phone: z.string().min(10, 'Invalid phone number'),
  dateOfBirth: z.string(),
});

const addressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zip: z.string().min(5, 'Valid ZIP is required'),
  type: z.enum(['billing', 'shipping']),
});

type PersonalInfoForm = z.infer<typeof personalInfoSchema>;
type AddressForm = z.infer<typeof addressSchema>;

export function UserProfile() {
  const utils = trpc.useUtils();
  
  const { data: user, isLoading: userLoading, refetch: refetchUser } = trpc.auth.me.useQuery(undefined, {
    enabled: true,
  });

  const { data: kyc } = trpc.userFeatures.kyc.getStatus.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: documents } = trpc.userFeatures.kyc.getDocuments.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: addresses } = trpc.userFeatures.addresses.list.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: notificationPrefs } = trpc.auth.getNotificationPreferences.useQuery(undefined, {
    enabled: !!user,
  });

  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [kycDocType, setKycDocType] = useState<'drivers_license_front' | 'drivers_license_back' | 'passport' | 'national_id_front' | 'national_id_back' | 'ssn_card' | 'bank_statement' | 'utility_bill' | 'pay_stub' | 'tax_return' | 'other'>('drivers_license_front');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const kycFileInputRef = useRef<HTMLInputElement>(null);

  // Notification preferences state
  const [emailPaymentDue, setEmailPaymentDue] = useState(true);
  const [emailPaymentOverdue, setEmailPaymentOverdue] = useState(true);
  const [emailPaymentReceived, setEmailPaymentReceived] = useState(true);
  const [emailAccountUpdates, setEmailAccountUpdates] = useState(true);
  const [smsCriticalAlerts, setSmsCriticalAlerts] = useState(true);
  const [emailPromotions, setEmailPromotions] = useState(false);

  // Update notification preferences from server data
  useEffect(() => {
    if (notificationPrefs) {
      setEmailPaymentDue(notificationPrefs.emailUpdates ?? true);
      setEmailPaymentOverdue(notificationPrefs.emailUpdates ?? true);
      setEmailPaymentReceived(notificationPrefs.emailUpdates ?? true);
      setEmailAccountUpdates(notificationPrefs.loanUpdates ?? true);
      setSmsCriticalAlerts(notificationPrefs.sms ?? true);
      setEmailPromotions(notificationPrefs.promotions ?? false);
    }
  }, [notificationPrefs]);

  // Personal info form
  const personalForm = useForm<PersonalInfoForm>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phoneNumber || '',
      dateOfBirth: user?.dateOfBirth || '',
    },
  });

  // Reset form values whenever fresh user data arrives so the inputs reflect
  // the saved profile (defaultValues only run once on mount).
  useEffect(() => {
    if (user) {
      personalForm.reset({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phoneNumber || '',
        dateOfBirth: user.dateOfBirth || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.firstName, user?.lastName, user?.email, user?.phoneNumber, user?.dateOfBirth]);

  // Address form
  const addressForm = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      street: '',
      city: '',
      state: '',
      zip: '',
      type: 'billing',
    },
  });

  // Update user profile mutation
  const updateProfileMutation = trpc.auth.updateUserProfile.useMutation({
    onSuccess: () => {
      toast.success('Profile updated successfully');
      utils.auth.me.invalidate();
      refetchUser();
      setIsEditingPersonal(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  // Address mutations
  const addAddressMutation = trpc.userFeatures.addresses.add.useMutation({
    onSuccess: () => {
      toast.success('Address added successfully');
      utils.userFeatures.addresses.list.invalidate();
      setShowAddAddressForm(false);
      addressForm.reset();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add address');
    },
  });

  const deleteAddressMutation = trpc.userFeatures.addresses.delete.useMutation({
    onSuccess: () => {
      toast.success('Address deleted successfully');
      utils.userFeatures.addresses.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete address');
    },
  });

  // Update notification preferences mutation
  const updateNotificationPrefsMutation = trpc.auth.updateNotificationPreferences.useMutation({
    onSuccess: () => {
      toast.success('Notification preferences saved');
      utils.auth.getNotificationPreferences.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save preferences');
    },
  });

  // Document upload
  const uploadDocumentMutation = trpc.userFeatures.kyc.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      utils.userFeatures.kyc.getDocuments.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to upload document');
    },
  });

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            My Profile
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your personal information and account settings
          </p>
        </div>

        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="kyc">KYC</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          {/* Personal Info Tab */}
          <TabsContent value="personal" className="space-y-4">
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your basic information</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingPersonal(!isEditingPersonal)}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  {isEditingPersonal ? 'Cancel' : 'Edit'}
                </Button>
              </CardHeader>
              <CardContent>
                {!isEditingPersonal ? (
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">First Name</p>
                      <p className="text-lg font-medium text-slate-900 dark:text-white">
                        {user?.firstName || 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Last Name</p>
                      <p className="text-lg font-medium text-slate-900 dark:text-white">
                        {user?.lastName || 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Email</p>
                      <p className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        {user?.email}
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-950">
                          ✓ Verified
                        </Badge>
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Phone</p>
                      <p className="text-lg font-medium text-slate-900 dark:text-white">
                        {user?.phoneNumber || 'Not set'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Form {...personalForm}>
                    <form className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={personalForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={personalForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={personalForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input {...field} type="tel" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={personalForm.control}
                          name="dateOfBirth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date of Birth</FormLabel>
                              <FormControl>
                                <Input {...field} type="date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button 
                        type="button"
                        className="w-full"
                        disabled={updateProfileMutation.isPending}
                        onClick={() => {
                          const values = personalForm.getValues();
                          updateProfileMutation.mutate({
                            firstName: values.firstName,
                            lastName: values.lastName,
                            phoneNumber: values.phone,
                            dateOfBirth: values.dateOfBirth,
                          });
                        }}
                      >
                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses" className="space-y-4">
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Saved Addresses</CardTitle>
                  <CardDescription>Manage your billing and shipping addresses</CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAddAddressForm(!showAddAddressForm)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Address
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Address Form */}
                {showAddAddressForm && (
                  <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    <CardContent className="pt-6">
                      <Form {...addressForm}>
                        <form className="space-y-4">
                          <FormField
                            control={addressForm.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Address Type</FormLabel>
                                <FormControl>
                                  <select 
                                    {...field}
                                    className="w-full px-3 py-2 border border-input rounded-md"
                                  >
                                    <option value="billing">Billing</option>
                                    <option value="shipping">Shipping</option>
                                  </select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={addressForm.control}
                            name="street"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Street Address</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-3 gap-4">
                            <FormField
                              control={addressForm.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>City</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={addressForm.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>State</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={addressForm.control}
                              name="zip"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ZIP Code</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              type="button"
                              className="flex-1"
                              disabled={addAddressMutation.isPending}
                              onClick={() => {
                                const values = addressForm.getValues();
                                addAddressMutation.mutate({
                                  type: values.type as 'residential' | 'business' | 'mailing',
                                  street: values.street,
                                  city: values.city,
                                  state: values.state,
                                  zipCode: values.zip,
                                  country: 'US',
                                  isPrimary: false,
                                });
                              }}
                            >
                              {addAddressMutation.isPending ? 'Saving...' : 'Save Address'}
                            </Button>
                            <Button 
                              type="button"
                              variant="outline"
                              onClick={() => setShowAddAddressForm(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                )}

                {/* Address List */}
                {addresses && addresses.length > 0 ? (
                  <div className="space-y-3">
                    {addresses.map((addr: any) => (
                      <div
                        key={addr.id}
                        className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {addr.street}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {addr.city}, {addr.state} {addr.zip}
                            </p>
                            <Badge variant="outline" className="mt-2">
                              {addr.type}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            disabled={deleteAddressMutation.isPending}
                            onClick={() => deleteAddressMutation.mutate({ addressId: addr.id })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-600 dark:text-slate-400 py-8">
                    No addresses saved yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* KYC Tab */}
          <TabsContent value="kyc" className="space-y-4">
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle>KYC Verification</CardTitle>
                <CardDescription>Know Your Customer (KYC) verification status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Verification Status */}
                <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-100">
                        Verification Approved
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-300">
                        Your identity has been verified
                      </p>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white mb-4">
                    Uploaded Documents
                  </h3>
                  {documents && documents.length > 0 ? (
                    <div className="space-y-3">
                      {documents.map((doc: any) => (
                        <div
                          key={doc.id}
                          className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {doc.documentType}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400">
                            {doc.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      No documents uploaded
                    </p>
                  )}
                </div>

                {/* Upload New Document */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h3 className="font-medium text-slate-900 dark:text-white mb-3">
                    Upload Additional Document
                  </h3>
                  <div className="mb-3">
                    <label className="text-sm text-slate-600 dark:text-slate-400 block mb-1">Document Type</label>
                    <select
                      value={kycDocType}
                      onChange={(e) => setKycDocType(e.target.value as typeof kycDocType)}
                      title="Select document type"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                    >
                      <option value="drivers_license_front">Driver's License (Front)</option>
                      <option value="drivers_license_back">Driver's License (Back)</option>
                      <option value="passport">Passport</option>
                      <option value="national_id_front">National ID (Front)</option>
                      <option value="national_id_back">National ID (Back)</option>
                      <option value="ssn_card">SSN Card</option>
                      <option value="bank_statement">Bank Statement</option>
                      <option value="utility_bill">Utility Bill</option>
                      <option value="pay_stub">Pay Stub</option>
                      <option value="tax_return">Tax Return</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <input
                    ref={kycFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    title="Upload KYC document"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error('File must be under 10MB');
                        return;
                      }
                      // Convert file to base64 data URL as the document URL
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = reader.result as string;
                        uploadDocumentMutation.mutate({
                          documentType: kycDocType,
                          documentUrl: dataUrl.substring(0, 500), // Store reference only
                          expiryDate: undefined,
                        });
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                      isDraggingOver
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                    onClick={() => kycFileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(false);
                      const file = e.dataTransfer.files[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error('File must be under 10MB');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = reader.result as string;
                        uploadDocumentMutation.mutate({
                          documentType: kycDocType,
                          documentUrl: dataUrl.substring(0, 500),
                          expiryDate: undefined,
                        });
                      };
                      reader.readAsDataURL(file);
                    }}
                  >
                    {uploadDocumentMutation.isPending ? (
                      <>
                        <div className="w-8 h-8 mx-auto mb-2 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">Uploading...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Drag and drop documents here or click to browse
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                          Supported: PDF, JPG, PNG (Max 10MB)
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-4">
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle>Communication Preferences</CardTitle>
                <CardDescription>Manage how we contact you about payments and account updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email Notifications Section */}
                <div className="space-y-4">
                  <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    Email Notifications
                  </h3>
                  
                  <div className="space-y-3 ml-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">Payment Due Reminders</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Receive reminders 7 days before payment is due
                        </p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={emailPaymentDue}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        aria-label="Payment Due Reminders"
                        onChange={(e) => setEmailPaymentDue(e.target.checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">Payment Overdue Alerts</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Get notified immediately when a payment becomes overdue
                        </p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={emailPaymentOverdue}
                        className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        aria-label="Payment Overdue Alerts"
                        onChange={(e) => setEmailPaymentOverdue(e.target.checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">Payment Received Confirmations</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Receive confirmation when your payment is processed
                        </p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={emailPaymentReceived}
                        className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                        aria-label="Payment Received Confirmations"
                        onChange={(e) => setEmailPaymentReceived(e.target.checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">General Account Updates</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Stay informed about important account changes and news
                        </p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={emailAccountUpdates}
                        className="w-5 h-5 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                        aria-label="General Account Updates"
                        onChange={(e) => setEmailAccountUpdates(e.target.checked)}
                      />
                    </div>
                  </div>
                </div>

                {/* SMS Notifications Section */}
                <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                    <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                    Text Message (SMS) Alerts
                  </h3>
                  
                  <div className="space-y-3 ml-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">Critical Alerts Only</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Only receive urgent SMS for overdue payments and delinquencies
                        </p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={smsCriticalAlerts}
                        className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        aria-label="Critical SMS Alerts Only"
                        onChange={(e) => setSmsCriticalAlerts(e.target.checked)}
                      />
                    </div>

                    {user?.phoneNumber ? (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          SMS alerts will be sent to: <span className="font-medium">{user.phoneNumber}</span>
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          To update your phone number, please contact support.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          ⚠️ No phone number on file. Add a phone number to enable SMS alerts.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Marketing Communication */}
                <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Marketing & Promotions
                  </h3>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 dark:text-white text-sm">Promotions & Special Offers</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Learn about new features, refinancing offers, and special promotions
                      </p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={emailPromotions}
                      className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                      aria-label="Promotions and Special Offers"
                      onChange={(e) => setEmailPromotions(e.target.checked)}
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                    disabled={updateNotificationPrefsMutation.isPending}
                    onClick={() => {
                      updateNotificationPrefsMutation.mutate({
                        emailUpdates: emailPaymentDue || emailPaymentOverdue || emailPaymentReceived,
                        loanUpdates: emailAccountUpdates,
                        promotions: emailPromotions,
                        sms: smsCriticalAlerts,
                      });
                    }}
                  >
                    {updateNotificationPrefsMutation.isPending ? 'Saving...' : 'Save Preferences'}
                  </Button>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
                    Your preferences are saved immediately. You can change them anytime.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Notification History */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle>Notification History</CardTitle>
                <CardDescription>Recent notifications sent to your account</CardDescription>
              </CardHeader>
              <CardContent>
                <NotificationHistorySection />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Sub-component for real notification history
function NotificationHistorySection() {
  const { data: notifications = [], isLoading } = trpc.userFeatures.notifications.list.useQuery({ limit: 10 });

  if (isLoading) {
    return <p className="text-sm text-slate-400 text-center py-4">Loading notifications...</p>;
  }

  if ((notifications as any[]).length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400 text-center py-4">
        No notifications yet. They will appear here as they are sent.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {(notifications as any[]).map((notif: any) => (
        <div key={notif.id} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
          <div className="flex items-center">
            <Badge className={`mr-3 ${notif.isRead
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              : 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200'
            }`}>
              {notif.isRead ? 'Read' : 'New'}
            </Badge>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {notif.title || notif.message?.substring(0, 50) || 'Notification'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {new Date(notif.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default UserProfile;

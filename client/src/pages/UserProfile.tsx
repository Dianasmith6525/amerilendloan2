import { useQuery, useMutation } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
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
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
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
  const { data: user, isLoading: userLoading, refetch: refetchUser } = useQuery({
    queryKey: ['auth.me'],
    queryFn: () => trpc.auth.me.query(),
  });

  const { data: kyc } = useQuery({
    queryKey: ['userFeatures.kyc.getStatus'],
    queryFn: () => trpc.userFeatures.kyc.getStatus.query(),
    enabled: !!user,
  });

  const { data: documents } = useQuery({
    queryKey: ['userFeatures.kyc.getDocuments'],
    queryFn: () => trpc.userFeatures.kyc.getDocuments.query(),
    enabled: !!user,
  });

  const { data: addresses } = useQuery({
    queryKey: ['userFeatures.bankAccounts.list'],
    queryFn: () => trpc.userFeatures.bankAccounts.list.query(),
    enabled: !!user,
  });

  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);

  // Personal info form
  const personalForm = useForm<PersonalInfoForm>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      dateOfBirth: user?.dateOfBirth || '',
    },
  });

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

  // Document upload
  const uploadDocumentMutation = useMutation({
    mutationFn: (data: any) => trpc.userFeatures.kyc.uploadDocument.mutate(data),
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      // Refetch documents
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
                        {user?.phone || 'Not set'}
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
                        type="submit"
                        className="w-full"
                        onClick={() => {
                          setIsEditingPersonal(false);
                          toast.success('Profile updated successfully');
                        }}
                      >
                        Save Changes
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
                            <Button className="flex-1">Save Address</Button>
                            <Button 
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
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Drag and drop documents here or click to browse
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      Supported: PDF, JPG, PNG (Max 10MB)
                    </p>
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
                <CardDescription>Manage how we contact you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Email Notifications</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Receive payment reminders and updates via email
                      </p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">SMS Notifications</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Receive urgent alerts via SMS
                      </p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Marketing Emails</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Receive promotions and special offers
                      </p>
                    </div>
                    <input type="checkbox" className="w-5 h-5" />
                  </div>
                </div>
                <Button className="w-full">Save Preferences</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default UserProfile;

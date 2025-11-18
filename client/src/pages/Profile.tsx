import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit2, Save, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 mb-4">Please log in to view your profile.</p>
            <Link href="/login">
              <Button className="bg-[#0033A0] hover:bg-[#002080] text-white w-full">
                Go to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSave = () => {
    // In a real app, you would send this to the server
    toast.success("Profile updated successfully!");
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard">
              <a className="flex items-center gap-2 text-[#0033A0] hover:opacity-75">
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Dashboard</span>
              </a>
            </Link>
            <h1 className="text-xl font-bold text-[#0033A0]">My Profile</h1>
            <div className="w-24" />
          </div>
        </div>
      </header>

      <div className="py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl text-[#0033A0]">Profile Information</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="border-[#0033A0] text-[#0033A0]"
                >
                  {isEditing ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                {isEditing ? (
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="border-gray-300"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-gray-800">{formData.name || "Not provided"}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                {isEditing ? (
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="border-gray-300"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-gray-800">{formData.email || "Not provided"}</p>
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleSave}
                    className="bg-[#FFA500] hover:bg-[#FF8C00] text-white flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg text-[#0033A0]">Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <span className="text-gray-600">Account Status</span>
                <span className="font-semibold text-green-600">Active</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b">
                <span className="text-gray-600">Member Since</span>
                <span className="font-semibold text-gray-800">
                  {new Date().toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-gray-600">Account Type</span>
                <span className="font-semibold text-gray-800">Premium</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#0033A0] to-[#003366] text-white py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            <div>
              <h4 className="font-semibold mb-3">Need Help?</h4>
              <div className="space-y-2 text-sm text-white/80">
                <p>📞 <a href="tel:+19452121609" className="hover:text-[#FFA500] transition-colors">(945) 212-1609</a></p>
                <p>📧 <a href="mailto:support@amerilendloan.com" className="hover:text-[#FFA500] transition-colors">support@amerilendloan.com</a></p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="/" className="hover:text-[#FFA500] transition-colors">Home</a></li>
                <li><a href="/dashboard" className="hover:text-[#FFA500] transition-colors">Dashboard</a></li>
                <li><a href="/#faq" className="hover:text-[#FFA500] transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-white/80">
                <li><a href="/public/legal/privacy-policy" className="hover:text-[#FFA500] transition-colors">Privacy Policy</a></li>
                <li><a href="/public/legal/terms-of-service" className="hover:text-[#FFA500] transition-colors">Terms of Service</a></li>
                <li><a href="/public/legal/loan-agreement" className="hover:text-[#FFA500] transition-colors">Loan Agreement</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 pt-6 text-center text-xs text-white/70">
            <p>© 2025 AmeriLend, LLC. All Rights Reserved.</p>
            <p className="mt-2">Your trusted partner for consumer loans.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

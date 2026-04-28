import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import ComplianceFooter from "@/components/ComplianceFooter";
import SEOHead from "@/components/SEOHead";
import { useTurnstile } from "@/components/TurnstileWidget";

interface JobApplication {
  fullName: string;
  email: string;
  phone: string;
  position: string;
  resume: File | null;
  coverLetter: string;
}

export default function Careers() {
  const [formData, setFormData] = useState<JobApplication>({
    fullName: "",
    email: "",
    phone: "",
    position: "Not Specified",
    resume: null,
    coverLetter: "",
  });
  const [fileError, setFileError] = useState<string | null>(null);

  // Get current user data to auto-fill form
  const { data: user } = trpc.auth.me.useQuery();

  // Auto-fill form with user data when available
  useEffect(() => {
    if (user && user.email) {
      setFormData(prev => ({
        ...prev,
        email: user.email || "",
        fullName: user.name || "",
      }));
    }
  }, [user]);

  const sendJobApplicationMutation = trpc.contact.sendJobApplication.useMutation({
    onSuccess: () => {
      toast.success("Application submitted! We'll review and get back to you soon.");
      setFormData({
        fullName: user?.name || "",
        email: user?.email || "",
        phone: "",
        position: "Not Specified",
        resume: null,
        coverLetter: "",
      });
      const fileInput = document.getElementById("resume") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      turnstile.reset();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit application. Please try again.");
      turnstile.reset();
    },
  });

  const turnstile = useTurnstile({ action: "job-application" });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFileError("Resume must be less than 5MB");
        toast.error("Resume must be less than 5MB");
        e.target.value = "";
        return;
      }
      if (!["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type)) {
        setFileError("Resume must be PDF or Word document");
        toast.error("Resume must be PDF or Word document");
        e.target.value = "";
        return;
      }
      setFileError(null);
      setFormData((prev) => ({
        ...prev,
        resume: file,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.email || !formData.phone || !formData.position || !formData.coverLetter) {
      toast.error("Please fill in all fields");
      return;
    }

    if (formData.position === "Not Specified") {
      toast.error("Please select a position of interest");
      return;
    }

    if (!turnstile.isReady) {
      toast.error("Please complete the verification challenge.");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Phone validation (basic)
    const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s/g, ""))) {
      toast.error("Please enter a valid phone number");
      return;
    }

    // Upload the resume file first if one was selected
    let resumeFileUrl: string | undefined;
    if (formData.resume) {
      try {
        const uploadData = new FormData();
        uploadData.append("file", formData.resume);
        const uploadRes = await fetch("/api/upload-resume", {
          method: "POST",
          body: uploadData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
          toast.error(err.error || "Failed to upload resume");
          return;
        }
        const uploadResult = await uploadRes.json();
        resumeFileUrl = uploadResult.url;
      } catch {
        toast.error("Failed to upload resume. Please try again.");
        return;
      }
    }

    sendJobApplicationMutation.mutate({
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      position: formData.position,
      resumeFileName: formData.resume?.name || "Not provided",
      resumeFileUrl,
      coverLetter: formData.coverLetter,
      turnstileToken: turnstile.token ?? undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <SEOHead
        title="Careers"
        description="Join the AmeriLend team. Explore open positions in fintech, engineering, customer support, and more. Build your career helping people access fair lending."
        path="/careers"
      />
      {/* Header */}
      <div className="bg-[#0A2540] text-white py-12">
        <div className="container mx-auto px-4">
          <Link href="/">
            <a className="inline-flex items-center gap-2 text-white hover:text-blue-200 mb-6">
              <ArrowLeft className="w-5 h-5" />
              Back to Home
            </a>
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold">Join Our Team</h1>
          <p className="text-blue-100 mt-2 text-lg">
            Help us empower people to achieve their financial goals
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Job Positions */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-8 sticky top-20">
              <h2 className="text-2xl font-bold text-[#0A2540] mb-6">Open Positions</h2>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Loan Advocate</h3>
                  <p className="text-sm text-gray-600">
                    Help customers navigate their loan applications and provide exceptional support.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Loan Underwriter</h3>
                  <p className="text-sm text-gray-600">
                    Evaluate loan applications, assess creditworthiness, and make approval decisions.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Loan Processor</h3>
                  <p className="text-sm text-gray-600">
                    Collect and verify borrower documents to prepare loan files for underwriting.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Loan Officer</h3>
                  <p className="text-sm text-gray-600">
                    Originate and manage personal and business loan applications from start to close.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Risk Analyst</h3>
                  <p className="text-sm text-gray-600">
                    Analyze applications and ensure responsible lending practices.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Compliance Officer</h3>
                  <p className="text-sm text-gray-600">
                    Ensure lending operations comply with federal and state regulations.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Collections Specialist</h3>
                  <p className="text-sm text-gray-600">
                    Manage delinquent accounts and work with borrowers to resolve outstanding balances.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Customer Service Representative</h3>
                  <p className="text-sm text-gray-600">
                    Assist borrowers with account inquiries, payment support, and loan status updates.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Financial Analyst</h3>
                  <p className="text-sm text-gray-600">
                    Analyze financial data to support lending decisions and business strategy.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Marketing Specialist</h3>
                  <p className="text-sm text-gray-600">
                    Develop strategies to reach customers and educate them about borrowing options.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Business Development Manager</h3>
                  <p className="text-sm text-gray-600">
                    Build partnerships and grow AmeriLend's client base through strategic outreach.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Software Engineer</h3>
                  <p className="text-sm text-gray-600">
                    Build and maintain the platform powering AmeriLend's digital lending experience.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Data Analyst</h3>
                  <p className="text-sm text-gray-600">
                    Transform lending data into actionable insights to drive informed decisions.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#0A2540]">
                  <h3 className="font-semibold text-[#0A2540] mb-2">Account Manager</h3>
                  <p className="text-sm text-gray-600">
                    Manage existing borrower relationships and ensure long-term customer satisfaction.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-[#C9A227]">
                  <h3 className="font-semibold text-[#C9A227] mb-2">Other Positions</h3>
                  <p className="text-sm text-gray-600">
                    Don't see your fit? Apply for other roles below.
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Equal Opportunity:</strong> We're committed to building a diverse and inclusive team.
                </p>
              </div>
            </div>
          </div>

          {/* Application Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-[#0A2540] mb-2">Submit Your Application</h2>
              <p className="text-gray-600 mb-6">
                Tell us about yourself and why you'd be a great fit for AmeriLend. We review all applications and will be in touch within 5-7 business days.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <Input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A2540] focus:border-transparent"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A2540] focus:border-transparent"
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <Input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A2540] focus:border-transparent"
                    required
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Position of Interest *
                  </label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                    title="Select a job position"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A2540] focus:border-transparent bg-white"
                    required
                  >
                    <option value="Not Specified">Select a position...</option>
                    <option value="Loan Advocate">Loan Advocate</option>
                    <option value="Loan Underwriter">Loan Underwriter</option>
                    <option value="Loan Processor">Loan Processor</option>
                    <option value="Loan Officer">Loan Officer</option>
                    <option value="Risk Analyst">Risk Analyst</option>
                    <option value="Compliance Officer">Compliance Officer</option>
                    <option value="Collections Specialist">Collections Specialist</option>
                    <option value="Customer Service Representative">Customer Service Representative</option>
                    <option value="Financial Analyst">Financial Analyst</option>
                    <option value="Marketing Specialist">Marketing Specialist</option>
                    <option value="Business Development Manager">Business Development Manager</option>
                    <option value="Software Engineer">Software Engineer</option>
                    <option value="Data Analyst">Data Analyst</option>
                    <option value="Account Manager">Account Manager</option>
                    <option value="Other">Other Position</option>
                  </select>
                </div>

                {/* Resume */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Resume (PDF or Word) - Max 5MB <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      id="resume"
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx"
                      title="Upload your resume (PDF or Word document, max 5MB)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A2540] focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0A2540] file:text-white hover:file:bg-blue-700"
                    />
                  </div>
                  {formData.resume && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ {formData.resume.name} ({(formData.resume.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                  {fileError && (
                    <p className="text-sm text-red-600 mt-2">
                      ✗ {fileError}
                    </p>
                  )}
                </div>

                {/* Cover Letter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cover Letter / Why You'd Be a Great Fit *
                  </label>
                  <textarea
                    name="coverLetter"
                    value={formData.coverLetter}
                    onChange={handleInputChange}
                    placeholder="Tell us about your experience, skills, and why you're interested in joining AmeriLend..."
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0A2540] focus:border-transparent resize-none"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.coverLetter.length}/1000 characters
                  </p>
                </div>

                {/* Privacy Notice */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-600">
                    By submitting this application, you agree that AmeriLend may use your information for recruiting purposes and contact you about job opportunities. We respect your privacy and will not share your information with third parties.
                  </p>
                </div>

                {/* Submit Button */}
                {turnstile.widget}
                <Button
                  type="submit"
                  disabled={sendJobApplicationMutation.isPending || !!fileError || !turnstile.isReady}
                  className="w-full bg-[#0A2540] hover:bg-blue-800 text-white py-3 rounded-lg font-semibold text-lg transition-all"
                >
                  {sendJobApplicationMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting Application...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </form>

              {/* Contact Info */}
              <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-[#0A2540] mb-3">Questions?</h3>
                <p className="text-gray-700">
                  Email us at{" "}
                  <a href="mailto:admin@amerilendloan.com" className="text-[#0A2540] hover:underline font-semibold">
                    admin@amerilendloan.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-white rounded-xl shadow-lg p-8 mt-12">
          <h2 className="text-2xl font-bold text-[#0A2540] mb-6">Why Work at AmeriLend?</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#C9A227] text-white flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                💼
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Meaningful Work</h3>
              <p className="text-gray-600 text-sm">
                Help people achieve their financial goals and improve their lives.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#C9A227] text-white flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                🚀
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Growth Opportunities</h3>
              <p className="text-gray-600 text-sm">
                Develop your skills and advance your career in a growing company.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#C9A227] text-white flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                🤝
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Great Team</h3>
              <p className="text-gray-600 text-sm">
                Work with passionate professionals who care about excellence.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#C9A227] text-white flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                ⚡
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Competitive Benefits</h3>
              <p className="text-gray-600 text-sm">
                Competitive salary, health insurance, and professional development.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ComplianceFooter />
    </div>
  );
}

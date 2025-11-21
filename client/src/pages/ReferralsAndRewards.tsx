import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Gift, Users, TrendingUp, Share2, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface Referral {
  id: string;
  name: string;
  email: string;
  status: "pending" | "completed" | "expired";
  referralDate: string;
  rewardAmount: number;
}

interface Reward {
  id: string;
  title: string;
  description: string;
  rewardAmount: number;
  earnedDate: string;
  expiryDate: string;
  status: "active" | "expired" | "redeemed";
}

export function ReferralsAndRewards() {
  const [copied, setCopied] = useState(false);

  // Fetch referrals and rewards from backend
  const { data: referralsData = [], isLoading: loadingReferrals } = trpc.userFeatures.referrals.list.useQuery();
  const { data: rewardsData, isLoading: loadingRewards } = trpc.userFeatures.referrals.getRewardsBalance.useQuery();

  // Mock referral code and link (TODO: Get from user account or system settings)
  const referralCode = "AMERILEND2024";
  const referralLink = `https://amerilendloan.com/apply?ref=${referralCode}`;

  // Map referrals
  const referrals: Referral[] = referralsData.map((ref: any) => ({
    id: `REF-${String(ref.id).padStart(3, '0')}`,
    name: ref.referredUserId ? `User ${ref.referredUserId}` : "Pending",
    email: ref.referralCode || "",
    status: ref.status,
    referralDate: new Date(ref.createdAt).toLocaleDateString(),
    rewardAmount: ref.status === "completed" ? (ref.referrerBonus || 0) / 100 : 0,
  }));

  // Calculate stats from rewards balance
  const completedReferrals = referrals.filter((r) => r.status === "completed").length;
  const totalEarned = rewardsData ? rewardsData.totalEarned / 100 : 0;
  const rewardBalance = rewardsData ? rewardsData.creditBalance / 100 : 0;

  // Mock rewards list (since we only have balance, not individual reward transactions)
  const mockRewards: Reward[] = [];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-600">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-600">Pending</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return null;
    }
  };

  const getRewardStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-600">Active</Badge>;
      case "redeemed":
        return <Badge variant="secondary">Redeemed</Badge>;
      case "expired":
        return <Badge className="bg-red-600">Expired</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Gift className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">Referrals & Rewards</h1>
          </div>
          <p className="text-slate-400">Earn rewards by referring friends to Amerilend</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 border-purple-600/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Reward Balance</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {formatCurrency(rewardBalance)}
                  </p>
                </div>
                <div className="bg-purple-500/20 p-3 rounded-lg">
                  <Gift className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Total Earned</p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(totalEarned)}
                  </p>
                </div>
                <div className="bg-green-500/20 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Successful Referrals</p>
                  <p className="text-2xl font-bold text-blue-400">{completedReferrals}</p>
                </div>
                <div className="bg-blue-500/20 p-3 rounded-lg">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Active Referrals</p>
                  <p className="text-3xl font-bold text-white">
                    {referrals.filter((r) => r.status === "pending").length}
                  </p>
                </div>
                <div className="bg-yellow-500/20 p-3 rounded-lg">
                  <Share2 className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral Section */}
        <Card className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-600/20 mb-8">
          <CardHeader>
            <CardTitle>Invite Your Friends</CardTitle>
            <CardDescription>Share your referral code and earn rewards when they sign up</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-2">Your Referral Code</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white font-mono flex items-center">
                  {referralCode}
                </div>
                <Button
                  onClick={handleCopyCode}
                  variant="outline"
                  className="text-blue-400 border-blue-600 hover:bg-blue-600/20"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-slate-400 text-xs mt-2">
                Share this code with friends and earn {formatCurrency(50)} per successful referral
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-2">Referral Link</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm truncate">
                  {referralLink}
                </div>
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  className="text-blue-400 border-blue-600 hover:bg-blue-600/20"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Share2 className="w-4 h-4 mr-2" />
                Share on Facebook
              </Button>
              <Button className="bg-blue-500 hover:bg-blue-600">
                <Share2 className="w-4 h-4 mr-2" />
                Share on Twitter/X
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Referrals List */}
        <Card className="bg-slate-800 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle>Your Referrals</CardTitle>
            <CardDescription>Track the status of all your referrals</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingReferrals ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-400">Loading referrals...</p>
              </div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
                <p className="text-slate-400">No referrals yet. Start sharing your code!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="p-4 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 transition-all flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-semibold">{referral.name}</h3>
                        {getStatusBadge(referral.status)}
                      </div>
                      <p className="text-slate-400 text-sm">{referral.email}</p>
                      <p className="text-slate-500 text-xs mt-1">
                        Referred on {referral.referralDate}
                      </p>
                    </div>
                    <div className="text-right">
                      {referral.rewardAmount > 0 && (
                        <p className="text-green-400 font-semibold text-lg">
                          +{formatCurrency(referral.rewardAmount)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rewards Section */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle>Your Rewards</CardTitle>
            <CardDescription>Manage and redeem your earned rewards</CardDescription>
          </CardHeader>
          <CardContent>
            {mockRewards.length === 0 ? (
              <div className="text-center py-12">
                <Gift className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
                <p className="text-slate-400">No rewards yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mockRewards.map((reward) => (
                  <div
                    key={reward.id}
                    className="p-4 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-semibold">{reward.title}</h3>
                          {getRewardStatusBadge(reward.status)}
                        </div>
                        <p className="text-slate-400 text-sm">{reward.description}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-2xl font-bold text-purple-400">
                          {formatCurrency(reward.rewardAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Earned: {reward.earnedDate}</span>
                      <span>Expires: {reward.expiryDate}</span>
                      {reward.status === "active" && (
                        <Button size="sm" className="ml-2">
                          Apply to Loan
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="bg-slate-800 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle>How Referrals Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  step: "1",
                  title: "Share Your Code",
                  description: "Share your unique referral code with friends and family",
                },
                {
                  step: "2",
                  title: "They Apply",
                  description: "Your friend applies for a loan using your referral code",
                },
                {
                  step: "3",
                  title: "Get Approved",
                  description: "Once their loan is approved, you earn your reward",
                },
                {
                  step: "4",
                  title: "Earn Rewards",
                  description: "Use your earned rewards to reduce your loan interest rate",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                      {item.step}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">{item.title}</h4>
                    <p className="text-slate-400 text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ReferralsAndRewards;

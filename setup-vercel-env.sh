#!/bin/bash
# Vercel Environment Variables Setup Script
# This script adds OAuth credentials to your Vercel project

# Your credentials
GOOGLE_CLIENT_ID="914402975294-c445oav4stl7hvk9493um07ske47epti.apps.googleusercontent.com"
GITHUB_CLIENT_ID="Ov23liXHk1iYHB1nhIhB"

echo "🚀 Setting up Vercel Environment Variables..."
echo ""
echo "Prerequisites:"
echo "1. Install Vercel CLI: npm install -g vercel"
echo "2. Authenticate: vercel login"
echo ""
echo "Steps:"
echo "1. Run: vercel env add VITE_GOOGLE_CLIENT_ID"
echo "   Value: $GOOGLE_CLIENT_ID"
echo "   Select: production"
echo ""
echo "2. Run: vercel env add VITE_GITHUB_CLIENT_ID"
echo "   Value: $GITHUB_CLIENT_ID"
echo "   Select: production"
echo ""
echo "3. Run: vercel redeploy"
echo ""
echo "Or use Vercel Dashboard:"
echo "https://vercel.com/amerilendloan2/settings/environment-variables"

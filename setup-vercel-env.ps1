# Vercel Environment Variables Setup Script (PowerShell)
# This script adds OAuth credentials to your Vercel project

# Your credentials
$GOOGLE_CLIENT_ID = "914402975294-c445oav4stl7hvk9493um07ske47epti.apps.googleusercontent.com"
$GITHUB_CLIENT_ID = "Ov23liXHk1iYHB1nhIhB"

Write-Host "🚀 Setting up Vercel Environment Variables..." -ForegroundColor Green
Write-Host ""
Write-Host "METHOD 1: Using Vercel CLI (Recommended)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Prerequisites:"
Write-Host "1. Install Vercel CLI: npm install -g vercel"
Write-Host "2. Authenticate: vercel login"
Write-Host ""
Write-Host "Then run these commands:"
Write-Host ""
Write-Host "Step 1: Add Google Client ID"
Write-Host "vercel env add VITE_GOOGLE_CLIENT_ID" -ForegroundColor Cyan
Write-Host "Value: $GOOGLE_CLIENT_ID" -ForegroundColor Cyan
Write-Host "Environment: production" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 2: Add GitHub Client ID"
Write-Host "vercel env add VITE_GITHUB_CLIENT_ID" -ForegroundColor Cyan
Write-Host "Value: $GITHUB_CLIENT_ID" -ForegroundColor Cyan
Write-Host "Environment: production" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 3: Redeploy"
Write-Host "vercel redeploy" -ForegroundColor Cyan
Write-Host ""
Write-Host "==========================================="
Write-Host ""
Write-Host "METHOD 2: Using Vercel Dashboard (Easiest)" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to: https://vercel.com"
Write-Host "2. Select project: amerilendloan2"
Write-Host "3. Go to: Settings > Environment Variables"
Write-Host "4. Add these variables:"
Write-Host ""
Write-Host "   Variable 1:"
Write-Host "   Name: VITE_GOOGLE_CLIENT_ID" -ForegroundColor Cyan
Write-Host "   Value: $GOOGLE_CLIENT_ID" -ForegroundColor Cyan
Write-Host "   Environment: Production" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Variable 2:"
Write-Host "   Name: VITE_GITHUB_CLIENT_ID" -ForegroundColor Cyan
Write-Host "   Value: $GITHUB_CLIENT_ID" -ForegroundColor Cyan
Write-Host "   Environment: Production" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Click 'Save'"
Write-Host "6. Go to Deployments > Click latest > Redeploy"
Write-Host ""
Write-Host "==========================================="
Write-Host ""
Write-Host "After that, verify OAuth redirect URIs:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Google Cloud Console:"
Write-Host "1. Go to: https://console.cloud.google.com/"
Write-Host "2. Select your project"
Write-Host "3. Go to: Credentials > OAuth 2.0 Client ID"
Write-Host "4. Add Authorized Redirect URI:"
Write-Host "   https://www.amerilendloan.com/auth/google/callback" -ForegroundColor Cyan
Write-Host "   https://amerilendloan2.vercel.app/auth/google/callback" -ForegroundColor Cyan
Write-Host ""
Write-Host "GitHub Developer Settings:"
Write-Host "1. Go to: https://github.com/settings/apps"
Write-Host "2. Find your OAuth App"
Write-Host "3. Update Authorization callback URL:"
Write-Host "   https://www.amerilendloan.com/auth/github/callback" -ForegroundColor Cyan
Write-Host "   https://amerilendloan2.vercel.app/auth/github/callback" -ForegroundColor Cyan
Write-Host ""
Write-Host "==========================================="
Write-Host ""
Write-Host "Then TEST:" -ForegroundColor Green
Write-Host "1. Go to your site: https://www.amerilendloan.com"
Write-Host "2. Click Google or GitHub login button"
Write-Host "3. Authorize and login"
Write-Host ""

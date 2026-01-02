# Chrome Web Store Publishing Guide

## Prerequisites:
- One-time $5 developer registration fee
- Google account
- Extension icons (128x128, 48x48, 16x16)

## Steps:

### 1. Create Required Assets:
- **Icon**: 128x128px PNG (main icon)
- **Screenshots**: 1280x800px or 640x400px (at least 1, up to 5)
- **Promo tile**: 440x280px (optional but recommended)
- **Privacy Policy**: Required if collecting data

### 2. Prepare Extension:
- Ensure manifest.json is complete
- Test thoroughly
- Zip the extension folder (extension.zip)

### 3. Submit:
1. Go to: https://chrome.google.com/webstore/devconsole
2. Pay $5 registration fee (one-time)
3. Click "New Item"
4. Upload extension.zip
5. Fill in:
   - Name: "Form Field Explainer"
   - Summary: Short description (132 chars max)
   - Description: Detailed explanation
   - Category: Productivity
   - Language: English + others
   - Screenshots & icons
   - Privacy policy (if needed)
6. Submit for review (usually 1-3 days)

### 4. Privacy Policy:
Since you're using Azure OpenAI, you need to disclose:
- What data is sent to your backend
- That it's processed by Azure OpenAI
- That you don't store personal data
- How users can contact you

## Edge Add-ons (Microsoft Edge):
- Similar process at: https://partner.microsoft.com/
- Free (no registration fee)
- Uses same extension files (Manifest V3 compatible)

## Firefox Add-ons:
- Submit at: https://addons.mozilla.org/developers/
- Free
- May need minor manifest.json adjustments

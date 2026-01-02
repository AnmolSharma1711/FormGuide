# Render Deployment

## Steps:
1. Push your code to GitHub
2. Go to render.com and sign up
3. Create New > Web Service
4. Connect your GitHub repo
5. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add environment variables in dashboard

## Environment Variables to add:
- AZURE_OPENAI_ENDPOINT
- AZURE_OPENAI_DEPLOYMENT
- AZURE_OPENAI_API_KEY
- PORT=3000

Render will give you a URL like: https://your-app.onrender.com

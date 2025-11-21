# Azure Deployment Guide

This document provides instructions for deploying NC-Edit7 to Azure.

## Prerequisites

- Azure subscription
- Azure CLI installed (optional, for command-line deployment)
- Node.js and npm installed locally

## Build the Application

Before deploying, build the application:

```bash
npm install
npm run build
```

This will create a `dist` folder with all the static files ready for deployment.

## Deployment Options

### Option 1: Azure App Service (Web App)

Azure App Service is suitable for hosting static web applications with IIS.

#### Steps:

1. **Create an Azure App Service** (if not already created):
   - Go to Azure Portal
   - Create a new "Web App"
   - Choose a runtime stack (Node.js or Static Web App)
   - Select your preferred region

2. **Enable the App Service**:
   - If you're getting a "403 Site Disabled" error, ensure your App Service is running
   - In Azure Portal, go to your App Service
   - Click "Start" if the service is stopped

3. **Deploy using Azure CLI**:
   ```bash
   az webapp deployment source config-zip \
     --resource-group <your-resource-group> \
     --name <your-app-name> \
     --src dist.zip
   ```

4. **Deploy using VS Code**:
   - Install the "Azure App Service" extension
   - Right-click on the `dist` folder
   - Select "Deploy to Web App"
   - Follow the prompts

5. **Deploy using GitHub Actions** (recommended for CI/CD):
   - See `.github/workflows` for deployment workflow examples
   - Configure deployment credentials in GitHub Secrets

#### Configuration Files:

- `web.config`: Automatically included in the build (located in `public/web.config`)
  - Handles SPA routing (redirects all routes to index.html)
  - Sets proper MIME types for JavaScript and JSON files
  - Enables compression and security headers

### Option 2: Azure Static Web Apps

Azure Static Web Apps is optimized for static sites and SPAs.

#### Steps:

1. **Create an Azure Static Web App**:
   - Go to Azure Portal
   - Create a new "Static Web App"
   - Connect to your GitHub repository (or deploy manually)
   - Set build configuration:
     - App location: `/`
     - API location: *(leave empty)*
     - Output location: `dist`

2. **Manual Deployment**:
   ```bash
   # Install Azure Static Web Apps CLI
   npm install -g @azure/static-web-apps-cli
   
   # Deploy
   swa deploy ./dist --deployment-token <your-deployment-token>
   ```

#### Configuration Files:

- `staticwebapp.config.json`: Automatically included in the build (located in `public/staticwebapp.config.json`)
  - Configures navigation fallback for SPA routing
  - Sets cache headers for static assets
  - Adds security headers

## Troubleshooting

### 403 Site Disabled Error

If you encounter the error:
```
ERROR: error executing step command 'deploy --all': failed deploying service 'web'
RESPONSE 403: 403 Site Disabled
```

**Solutions**:

1. **Check if the App Service is running**:
   - Go to Azure Portal → Your App Service
   - Ensure the service is in "Running" state
   - If stopped, click "Start"

2. **Verify deployment credentials**:
   - Go to App Service → Deployment Center
   - Verify your deployment credentials are correct
   - Reset credentials if needed

3. **Check App Service Plan**:
   - Ensure your App Service Plan is active
   - Verify you haven't exceeded quota limits

4. **Check Application Settings**:
   - Ensure no custom settings are blocking deployment

5. **Review Deployment Logs**:
   - Go to App Service → Log Stream
   - Check for any errors during deployment

### 404 Errors After Deployment

If you get 404 errors when navigating to routes other than the home page:

- Verify `web.config` or `staticwebapp.config.json` is present in the deployed `dist` folder
- For App Service: Ensure URL Rewrite module is enabled
- For Static Web Apps: Check the `navigationFallback` configuration

### Missing Assets

If CSS or JavaScript files fail to load:

- Check that all files in `dist/assets` are deployed
- Verify MIME types are correctly configured
- Check browser console for CORS or content-type errors

## Production Considerations

1. **Environment Variables**: If you need environment-specific configuration, use Azure Application Settings
2. **Custom Domain**: Configure a custom domain in Azure Portal → App Service → Custom domains
3. **SSL/TLS**: Azure provides free SSL certificates through App Service Managed Certificates
4. **Monitoring**: Enable Application Insights for monitoring and diagnostics
5. **Scaling**: Configure auto-scaling rules based on your traffic patterns

## Local Testing

Before deploying, you can test the production build locally:

```bash
npm run preview
```

This will serve the `dist` folder locally at http://localhost:4173.

## Additional Resources

- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Azure Static Web Apps Documentation](https://docs.microsoft.com/azure/static-web-apps/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)

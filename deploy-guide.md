# 🚀 EsaEvent Deployment Guide

## Prerequisites
- Node.js installed
- Git repository
- Vercel account

## Step-by-Step Deployment

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy from Project Root
```bash
# Navigate to your project root
cd /path/to/EsaEvent

# Deploy to Vercel
vercel
```

### 4. Configure Environment Variables
After deployment, set these environment variables in Vercel Dashboard:

#### Database Configuration
- `DB_HOST`: Your production database host
- `DB_PORT`: 5432
- `DB_NAME`: esaevent_prod
- `DB_USER`: Your database username
- `DB_PASSWORD`: Your database password

#### JWT Configuration
- `JWT_SECRET`: A strong secret key (generate with: `openssl rand -base64 32`)
- `JWT_EXPIRES_IN`: 7d

#### Server Configuration
- `NODE_ENV`: production
- `FRONTEND_URL`: https://your-app-name.vercel.app

### 5. Set Up Production Database

#### Option A: Vercel Postgres
```bash
vercel postgres create
```

#### Option B: External Database
1. Create PostgreSQL database on your preferred provider
2. Run the schema:
```bash
psql -h your-host -U your-user -d your-db -f database/schema.sql
```
3. Run the seed data:
```bash
psql -h your-host -U your-user -d your-db -f database/seed_data.sql
```

### 6. Update Domain (Optional)
```bash
vercel domains add your-custom-domain.com
```

## Environment Variables Reference

### Required Variables
```
DB_HOST=your_production_db_host
DB_PORT=5432
DB_NAME=esaevent_prod
DB_USER=your_db_user
DB_PASSWORD=your_db_password
JWT_SECRET=your_super_secret_jwt_key
NODE_ENV=production
```

### Optional Variables
```
JWT_EXPIRES_IN=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Post-Deployment Checklist

- [ ] Environment variables configured
- [ ] Database schema deployed
- [ ] Seed data inserted
- [ ] Test login with admin/admin123
- [ ] Test all major features
- [ ] Set up custom domain (optional)
- [ ] Configure monitoring (optional)

## Troubleshooting

### Common Issues

1. **Build Errors**
   - Check Node.js version compatibility
   - Ensure all dependencies are installed
   - Check for TypeScript errors

2. **Database Connection Issues**
   - Verify environment variables
   - Check database host accessibility
   - Ensure database exists

3. **API Routes Not Working**
   - Check vercel.json configuration
   - Verify API routes are properly defined
   - Check server logs in Vercel dashboard

### Useful Commands

```bash
# Check deployment status
vercel ls

# View logs
vercel logs

# Redeploy
vercel --prod

# Remove deployment
vercel remove
```

## Default Login Credentials

After deployment, you can login with:
- **Username**: admin
- **Password**: admin123

**Important**: Change the default password after first login!

## Support

If you encounter issues:
1. Check Vercel dashboard logs
2. Verify environment variables
3. Test database connectivity
4. Check API endpoints manually
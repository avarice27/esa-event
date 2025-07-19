# EsaEvent Production Setup Guide

## 🚀 Production-Ready PostgreSQL Setup

This project has been converted to use **real PostgreSQL database** instead of mock data. All API endpoints now connect to a persistent database.

## 📋 Prerequisites

1. **PostgreSQL Database** (choose one):
   - [Supabase](https://supabase.com) - Recommended (Free tier available)
   - [Neon](https://neon.tech) - Serverless PostgreSQL
   - [Railway](https://railway.app) - Simple deployment
   - [Heroku Postgres](https://www.heroku.com/postgres)
   - Self-hosted PostgreSQL

## 🛠️ Setup Instructions

### Step 1: Create PostgreSQL Database

#### Option A: Supabase (Recommended)
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string (URI format)

#### Option B: Neon
1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string

### Step 2: Set Up Database Schema

1. Connect to your PostgreSQL database using a client (pgAdmin, DBeaver, or psql)
2. Run the SQL script from `database/schema.sql`
3. Optionally run `database/seed_data.sql` for sample data

### Step 3: Configure Environment Variables

#### For Vercel Deployment:
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables:

```bash
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=production
```

#### For Local Development:
Create a `.env` file in the root directory:

```bash
DATABASE_URL=postgresql://username:password@localhost:5432/esaevent
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=development
```

### Step 4: Deploy to Production

1. Commit all changes:
```bash
git add .
git commit -m "Convert to production PostgreSQL setup"
git push
```

2. Vercel will automatically redeploy with the new database configuration

## 🔧 API Endpoints

All API endpoints now use PostgreSQL:

- **Authentication**: `/api/auth` - User login with database validation
- **Clients**: `/api/clients` - Full CRUD operations
- **Vendors**: `/api/vendors` - Full CRUD operations  
- **Events**: `/api/events` - Full CRUD operations
- **Transactions**: `/api/transactions` - Full CRUD operations
- **Invoices**: `/api/invoices` - Full CRUD operations
- **Reports**: `/api/reports` - Real-time analytics from database
- **Dashboard**: `/api/dashboard` - Live dashboard metrics

## 📊 Features

### ✅ Production Features Added:
- **Real PostgreSQL database** with connection pooling
- **Proper error handling** and logging
- **Data validation** and sanitization
- **Soft deletes** for data integrity
- **Activity logging** for audit trails
- **Optimized queries** with indexes
- **Transaction support** for data consistency
- **Auto-generated invoice numbers**
- **Real-time financial reports**

### 🔒 Security Features:
- **SQL injection protection** with parameterized queries
- **Password hashing** with bcrypt
- **JWT token authentication**
- **CORS configuration**
- **Environment variable protection**

## 🗄️ Database Schema

The database includes these main tables:
- `users` - User authentication and roles
- `clients` - Client management
- `vendors` - Vendor management
- `events` - Event planning and tracking
- `transactions` - Financial transactions
- `invoices` - Invoice management
- `invoice_items` - Invoice line items
- `budget_categories` - Budget categorization
- `activity_logs` - Audit trail

## 📈 Performance Optimizations

- **Connection pooling** for efficient database connections
- **Database indexes** on frequently queried columns
- **Optimized SQL queries** with JOINs and aggregations
- **Proper data types** for storage efficiency
- **Automatic cleanup** of idle connections

## 🔧 Maintenance

### Regular Tasks:
1. **Monitor database performance** through your provider's dashboard
2. **Backup database** regularly (most providers do this automatically)
3. **Review activity logs** for security monitoring
4. **Update dependencies** periodically

### Scaling:
- Database can handle thousands of transactions
- Connection pooling supports concurrent users
- Indexes ensure fast query performance
- Can easily upgrade database plan as needed

## 🆘 Troubleshooting

### Common Issues:

1. **Connection Error**: Check DATABASE_URL format and credentials
2. **SSL Error**: Ensure `sslmode=require` in connection string
3. **Permission Error**: Verify database user has proper permissions
4. **Timeout Error**: Check connection pool settings

### Debug Mode:
Set `NODE_ENV=development` to see detailed error logs.

## 📞 Support

For issues with:
- **Database setup**: Check your provider's documentation
- **Vercel deployment**: Check Vercel deployment logs
- **Application errors**: Check browser console and network tab

---

**Your EsaEvent system is now production-ready with real PostgreSQL database! 🎉**
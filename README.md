# EsaEvent - Event Organizer Financial Management System

A comprehensive financial management system designed specifically for event organizers to track revenue, expenses, and profitability with an intuitive dashboard.

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + PostgreSQL
- **Database**: PostgreSQL with comprehensive schema

## Features

### 1. Dashboard
- Overview keuangan semua event
- Grafik revenue vs expenses
- Upcoming events dan deadlines
- Recent transactions
- Key performance indicators (KPIs)

### 2. Event Management
- CRUD operations untuk events
- Timeline dan milestone tracking
- Budget planning dan monitoring
- Document management
- Status tracking

### 3. Financial Management
- Transaction recording (income/expense)
- Budget vs actual comparison
- Automated calculations
- Multi-currency support
- Bank reconciliation

### 4. Vendor Management
- Vendor database
- Performance rating
- Payment tracking
- Contract management
- Communication history

### 5. Client Management
- Client database
- Contact management
- Payment history
- Credit terms
- Communication log

### 6. Invoicing System
- Invoice generation
- Payment tracking
- Automated reminders
- Tax calculations
- PDF export

### 7. Reporting & Analytics
- Profit & loss statements
- Budget variance reports
- Cash flow analysis
- Event profitability
- Custom reports
- Export to Excel/PDF

### 8. User Management
- Role-based access control
- User permissions
- Activity logging
- Profile management

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

3. Set up database:
   ```bash
   psql -U postgres -f database/schema.sql
   ```

4. Configure environment variables:
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your database credentials
   ```

5. Start the development servers:
   ```bash
   # Terminal 1 - Backend
   cd server && npm run dev
   
   # Terminal 2 - Frontend
   cd client && npm start
   ```

## Project Structure

```
esaevent/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts
│   │   ├── hooks/         # Custom hooks
│   │   ├── utils/         # Utility functions
│   │   └── types/         # TypeScript types
│   └── package.json
├── server/                # Node.js backend
│   ├── routes/           # API routes
│   ├── middleware/       # Express middleware
│   ├── config/          # Configuration files
│   ├── models/          # Database models
│   └── package.json
├── database/            # Database schema and migrations
└── README.md
```

## License

MIT License
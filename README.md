# Kyla Cafe System

A modern Point of Sale (POS) system built for growing Philippine cafes and businesses. This monorepo contains the backend API, web frontend application, and mobile app, providing a complete solution for sales processing, inventory management, product management, and business analytics.

## 🚀 Features

- **User Authentication & Authorization** - Secure JWT-based authentication with role-based access control (Admin, Manager, Cashier)
- **Sales Processing** - Real-time order processing with multiple payment methods
- **Product Management** - Create, update, and manage products with pricing and categories
- **Inventory Management** - Track stock levels, manage inventory, and receive low stock alerts
- **Order Management** - Process orders, apply discounts, and generate receipts
- **Dashboard & Analytics** - View sales reports, daily transactions, and business insights
- **Discount System** - Apply and manage discounts with approval workflows
- **Receipt Generation** - Generate professional receipts for transactions
- **Multi-role Support** - Different access levels for admins, managers, and cashiers

## 🛠️ Tech Stack

### Backend (`pos-backend`)

- **Runtime**: Node.js with Express.js 5
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens) with refresh token support
- **Password Hashing**: Argon2
- **Testing**: Vitest
- **Language**: TypeScript

### Web Frontend (`pos-web`)

- **Framework**: Next.js 16 with React 19
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript
- **State Management**: React Hooks

### Mobile App (`pos-mobile`)

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Platform**: iOS, Android, and Web
- **Development**: Expo Go for rapid development

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (v9 or higher) - Comes with Node.js
- **PostgreSQL** (v14 or higher) - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/)

## 🚀 Getting Started

Follow these step-by-step instructions to set up and run the project locally.

### Step 1: Clone the Repository

```bash
git clone <your-repository-url>
cd pos
```

### Step 2: Set Up PostgreSQL Database

1. **Create a PostgreSQL database**:

```bash
# Using psql command line
psql -U postgres
CREATE DATABASE pos;
\q
```

Or use your preferred PostgreSQL client (pgAdmin, DBeaver, etc.) to create a database named `pos`.

2. **Note your database connection details**:
   - Host: `localhost` (or your PostgreSQL host)
   - Port: `5432` (default PostgreSQL port)
   - Database: `pos`
   - Username: Your PostgreSQL username
   - Password: Your PostgreSQL password

### Step 3: Configure Backend Environment

1. **Navigate to the backend directory**:

```bash
cd pos-backend
```

2. **Create a `.env` file**:

```bash
cp env.example .env
```

3. **Edit the `.env` file** with your configuration:

```env
# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/pos"

# Server Configuration
PORT="4000"

# JWT Configuration
JWT_ACCESS_SECRET="your-super-secret-access-key-change-this-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-this-in-production"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
```

**Important**:

- Replace `username` and `password` with your actual PostgreSQL credentials
- Change the JWT secrets to strong, random strings in production
- You can generate secure secrets using: `openssl rand -base64 32`

### Step 4: Install Backend Dependencies

```bash
# Make sure you're in pos-backend directory
npm install
```

### Step 5: Set Up Database Schema

1. **Generate Prisma Client**:

```bash
npm run prisma:generate
```

2. **Run database migrations**:

```bash
npm run prisma:migrate
```

This will create all the necessary tables in your PostgreSQL database.

### Step 6: Configure Frontend Environment

1. **Navigate to the frontend directory**:

```bash
cd ../pos-web
```

2. **Create a `.env.local` file**:

```bash
# Create .env.local file
touch .env.local
```

3. **Add the backend API URL to `.env.local`**:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Step 7: Install Web Frontend Dependencies

```bash
# Make sure you're in pos-web directory
npm install
```

### Step 8: Configure Mobile App (Optional)

1. **Navigate to the mobile app directory**:

```bash
cd ../pos-mobile
```

2. **Create a `.env` file**:

```bash
# Create .env file
touch .env
```

3. **Add the backend API URL to `.env`**:

```env
EXPO_PUBLIC_API_URL=http://localhost:4000
```

**Note**: For physical devices, replace `localhost` with your computer's IP address (e.g., `http://192.168.1.xxx:4000`)

4. **Install mobile app dependencies**:

```bash
# Make sure you're in pos-mobile directory
npm install
```

### Step 9: Start the Development Servers

You'll need to run both the backend and frontend servers. Open two terminal windows:

**Terminal 1 - Backend Server**:

```bash
cd pos-backend
npm run dev
```

The backend server will start on `http://localhost:4000`

**Terminal 2 - Frontend Server**:

```bash
cd pos-web
npm run dev
```

The web frontend application will start on `http://localhost:3000`

**Terminal 3 - Mobile App (Optional)**:

```bash
cd pos-mobile
npm start
```

This will open Expo DevTools. You can then:
- Press `i` to open in iOS Simulator
- Press `a` to open in Android Emulator
- Scan the QR code with Expo Go app on your physical device

### Step 10: Access the Application

1. Open your web browser and navigate to: `http://localhost:3000`
2. You should see the Kyla Cafe System landing page
3. Click on "Sign up" to create your first account
4. After signing up, you can log in and start using the system

## 📁 Project Structure

```
pos/
├── pos-backend/                 # Backend API
│   ├── prisma/                 # Database schema and migrations
│   │   ├── schema.prisma       # Prisma schema definition
│   │   └── migrations/         # Database migration files
│   ├── src/
│   │   ├── auth/               # Authentication routes and services
│   │   ├── config/             # Configuration files
│   │   ├── dashboard/           # Dashboard routes and services
│   │   ├── discounts/          # Discount management
│   │   ├── inventory/          # Inventory management
│   │   ├── orders/             # Order processing and receipts
│   │   ├── products/           # Product management
│   │   ├── lib/                # Shared utilities
│   │   ├── test/               # Test utilities
│   │   ├── app.ts              # Express app configuration
│   │   └── index.ts            # Server entry point
│   ├── package.json
│   └── .env                    # Environment variables (not in git)
│
├── pos-web/                    # Web frontend application
    ├── src/
    │   ├── app/                # Next.js app router pages
    │   │   ├── dashboard/     # Dashboard page
    │   │   ├── login/          # Login page
    │   │   ├── signup/         # Signup page
    │   │   ├── sales-processing/  # POS checkout interface
    │   │   ├── product-management/ # Product management
    │   │   ├── inventory-management/ # Inventory management
    │   │   └── orders/         # Orders page
    │   ├── components/         # React components
    │   │   ├── auth/           # Authentication components
    │   │   ├── branding/       # Branding components
    │   │   └── dashboard/      # Dashboard components
    │   └── lib/                # Client libraries and utilities
    ├── public/                 # Static assets
    ├── package.json
    └── .env.local              # Environment variables (not in git)
│
└── pos-mobile/                 # Mobile application
    ├── src/
    │   ├── components/         # Reusable React components
    │   ├── lib/               # Utilities and API client
    │   ├── screens/           # Screen components
    │   └── types/             # TypeScript type definitions
    ├── assets/                # Images, fonts, and other static assets
    ├── App.tsx                # Main app component
    ├── app.json               # Expo configuration
    ├── package.json
    └── .env                   # Environment variables (not in git)
```

## 🔧 Available Scripts

### Backend Scripts (`pos-backend`)

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start            # Start production server
npm test             # Run tests
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate    # Run database migrations
```

### Web Frontend Scripts (`pos-web`)

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
```

### Mobile App Scripts (`pos-mobile`)

```bash
npm start            # Start Expo development server
npm run ios          # Run on iOS Simulator
npm run android      # Run on Android Emulator
npm run web          # Run in web browser
```

## 🧪 Testing

### Backend Tests

```bash
cd pos-backend
npm test
```

The backend uses Vitest for testing. Test files are located alongside the source files with `.test.ts` extension.

## 🔐 Authentication & User Roles

The system supports three user roles:

- **ADMIN**: Full system access, can manage users and all features
- **MANAGER**: Can manage products, inventory, and view reports
- **CASHIER**: Can process sales and view limited information

### Creating Your First Admin User

1. Sign up through the web interface at `/signup`
2. The first user is typically assigned the default role (CASHIER)
3. To change a user's role, you'll need to update it directly in the database or through an admin interface

## 🌐 API Endpoints

The backend API runs on `http://localhost:4000` by default. Key endpoints include:

- **Authentication**: `/api/auth/login`, `/api/auth/signup`, `/api/auth/refresh`
- **Products**: `/api/products` (GET, POST, PUT, DELETE)
- **Inventory**: `/api/inventory` (GET, POST, PUT)
- **Orders**: `/api/orders` (GET, POST, PUT)
- **Dashboard**: `/api/dashboard/stats`

All protected endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <your-access-token>
```

## 🐛 Troubleshooting

### Database Connection Issues

- **Error**: `Can't reach database server`
  - **Solution**: Ensure PostgreSQL is running and the connection string in `.env` is correct
  - Check: `psql -U postgres -l` to verify PostgreSQL is accessible

### Port Already in Use

- **Error**: `Port 4000 is already in use` (backend) or `Port 3000 is already in use` (frontend)
  - **Solution**: Change the port in `.env` (backend) or use `npm run dev -- -p 3001` (frontend)

### Prisma Client Not Generated

- **Error**: `Cannot find module '@prisma/client'`
  - **Solution**: Run `npm run prisma:generate` in the `pos-backend` directory

### Migration Issues

- **Error**: Migration conflicts or database schema issues
  - **Solution**:
    1. Reset the database: `npx prisma migrate reset` (⚠️ This will delete all data)
    2. Or create a fresh migration: `npx prisma migrate dev --name fix_schema`

### Frontend Can't Connect to Backend

- **Error**: API calls failing or CORS errors
  - **Solution**:
    1. Verify `NEXT_PUBLIC_API_URL` in `pos-web/.env.local` matches your backend URL
    2. Ensure the backend server is running
    3. Check browser console for specific error messages

### Mobile App Can't Connect to Backend

- **Error**: API calls failing or network errors
  - **Solution**:
    1. Verify `EXPO_PUBLIC_API_URL` in `pos-mobile/.env` matches your backend URL
    2. For physical devices, use your computer's IP address instead of `localhost`
    3. Ensure your phone and computer are on the same Wi-Fi network
    4. Check that the backend server is running and accessible

## 📦 Building for Production

### Backend

```bash
cd pos-backend
npm run build
npm start
```

### Web Frontend

```bash
cd pos-web
npm run build
npm start
```

### Mobile App

For mobile app builds, refer to the [Expo documentation](https://docs.expo.dev/build/introduction/) for building standalone apps:

```bash
cd pos-mobile
# For iOS
eas build --platform ios

# For Android
eas build --platform android
```

Or use Expo's build service:
```bash
expo build:ios
expo build:android
```

## 🔒 Security Notes

- **Never commit `.env` files** - They contain sensitive information
- **Change default JWT secrets** - Use strong, random strings in production
- **Use HTTPS in production** - Never expose JWT tokens over unencrypted connections
- **Keep dependencies updated** - Regularly run `npm audit` and update packages
- **Database credentials** - Use strong passwords and restrict database access

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 💬 Support

For support, please open an issue in the repository or contact the development team.

## 🙏 Acknowledgments

- Built with modern web technologies for optimal performance and developer experience
- Designed specifically for Philippine businesses with peso (₱) currency support
- Optimized for cafes and retail businesses

---

**Happy coding! 🎉**

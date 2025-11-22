# Kyla Cafe System - Mobile App

Mobile frontend for the Kyla Cafe POS system built with React Native and Expo.

## 🚀 Getting Started

### Prerequisites

- Node.js (v20.19.4 or higher recommended)
- npm or yarn
- Expo Go app on your mobile device (for development)
- Or iOS Simulator / Android Emulator

### Installation

1. **Install dependencies**:

```bash
cd pos-mobile
npm install
```

2. **Configure environment variables**:

Create a `.env` file in the `pos-mobile` directory:

```env
EXPO_PUBLIC_API_URL=http://localhost:4000
```

For physical devices, replace `localhost` with your computer's IP address:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.xxx:4000
```

### Running the App

**Start the development server**:

```bash
npm start
```

This will open the Expo DevTools. You can then:

- Press `i` to open in iOS Simulator
- Press `a` to open in Android Emulator
- Scan the QR code with Expo Go app on your physical device

**Platform-specific commands**:

```bash
npm run ios      # Open in iOS Simulator
npm run android  # Open in Android Emulator
npm run web      # Open in web browser
```

## 📁 Project Structure

```
pos-mobile/
├── src/
│   ├── components/     # Reusable React components
│   ├── lib/           # Utilities and API client
│   ├── screens/       # Screen components
│   └── types/         # TypeScript type definitions
├── assets/            # Images, fonts, and other static assets
├── App.tsx            # Main app component
├── app.json           # Expo configuration
└── package.json       # Dependencies and scripts
```

## 🔧 Available Scripts

- `npm start` - Start the Expo development server
- `npm run ios` - Run on iOS Simulator
- `npm run android` - Run on Android Emulator
- `npm run web` - Run in web browser

## 📱 Development Tips

1. **Using Physical Device**: Make sure your phone and computer are on the same Wi-Fi network
2. **API Connection**: Update `EXPO_PUBLIC_API_URL` in `.env` to use your computer's IP address instead of `localhost`
3. **Hot Reload**: Changes to your code will automatically reload in the app

## 🔗 Backend Connection

The mobile app connects to the backend API running on `http://localhost:4000` by default. Make sure:

1. The backend server is running (`cd pos-backend && npm run dev`)
2. The API URL in `.env` matches your backend server address
3. For physical devices, use your computer's IP address instead of `localhost`

## 📝 Next Steps

- Set up navigation (consider using `@react-navigation/native`)
- Implement authentication screens (login/signup)
- Create API service functions for backend endpoints
- Add state management (consider using Context API or Zustand)
- Implement secure token storage (using `expo-secure-store`)


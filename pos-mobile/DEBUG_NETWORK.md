# Debugging Network Requests in Expo Go

## Problem: "Network request failed"

This usually happens because:
1. **Using `localhost` on a physical device** - `localhost` refers to the device itself, not your computer
2. **API server not running** - Make sure your backend is running
3. **Wrong IP address** - The IP address in your `.env` file might be incorrect
4. **Firewall blocking** - Your computer's firewall might be blocking connections

## Solution Steps

### 1. Find Your Computer's IP Address

**On macOS:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually starts with 192.168.x.x or 10.x.x.x)

**On Linux:**
```bash
hostname -I
```

### 2. Update Your `.env` File

Create or update `pos-mobile/.env`:
```env
EXPO_PUBLIC_API_URL=http://YOUR_IP_ADDRESS:4000
```

For example:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:4000
```

### 3. Restart Expo

After updating `.env`, restart your Expo development server:
```bash
npm start
# Then press 'r' to reload, or shake your device and tap "Reload"
```

### 4. Verify Backend is Running

Make sure your backend server is running:
```bash
cd pos-backend
npm run dev
```

The backend should be accessible at `http://localhost:4000` on your computer.

### 5. Test Connection

You can test if your device can reach the backend by opening this URL in your phone's browser:
```
http://YOUR_IP_ADDRESS:4000/health
```

You should see: `{"status":"ok"}`

## Debugging Tools

### View Network Logs in Expo

1. **Shake your device** (or press `Cmd+D` on iOS simulator / `Cmd+M` on Android emulator)
2. Tap **"Debug Remote JS"**
3. Open Chrome DevTools (should open automatically)
4. Go to **Network** tab to see all requests

### View Console Logs

The app now logs all API requests and responses to the console. You can see them:
- In the Expo DevTools terminal
- In Chrome DevTools console (when debugging)
- In React Native Debugger

### Enable Network Inspector

1. Shake device → **"Show Dev Menu"**
2. Enable **"Network Inspector"** (if available)
3. Or use React Native Debugger: https://github.com/jhen0409/react-native-debugger

## Common Issues

### Issue: Still getting "Network request failed"

**Check:**
- ✅ Backend is running on port 4000
- ✅ IP address in `.env` matches your computer's IP
- ✅ Phone and computer are on the same Wi-Fi network
- ✅ Firewall allows connections on port 4000
- ✅ No VPN interfering with network

### Issue: CORS errors

If you see CORS errors, make sure your backend has CORS enabled (it should already be configured).

### Issue: Connection timeout

- Check if your computer's firewall is blocking port 4000
- Try temporarily disabling firewall to test
- Make sure backend is listening on `0.0.0.0` not just `localhost`

## Quick Test

Run this in your terminal to check if your backend is accessible:
```bash
curl http://YOUR_IP_ADDRESS:4000/health
```

If this works, your mobile device should be able to connect too.


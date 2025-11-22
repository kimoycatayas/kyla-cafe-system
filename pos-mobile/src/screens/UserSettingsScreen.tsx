import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList } from '../types/navigation';
import { RootStackParamList } from '../types/navigation';
import { logout } from '../lib/authClient';

type UserSettingsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Settings'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface UserProfile {
  fullName: string;
  email: string;
  contactNumber: string;
  businessName: string;
  industry: string;
  role: string;
}

export default function UserSettingsScreen() {
  const navigation = useNavigation<UserSettingsScreenNavigationProp>();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Mock user data - will be replaced with API call
  const profile: UserProfile = {
    fullName: 'Kyla Reyes',
    email: 'owner@kylacafe.ph',
    contactNumber: '+63 917 123 4567',
    businessName: 'Kyla Cafe System',
    industry: 'Food & Beverage',
    role: 'MANAGER',
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 4) {
      return value;
    }
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
              // Navigate to login screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Logout error:', error);
              // Even if logout API fails, clear tokens and navigate
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>User Settings</Text>
          <Text style={styles.subtitle}>
            Manage your account, security, and preferences
          </Text>

          {/* Account Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Profile</Text>
            <Text style={styles.sectionDescription}>
              These details will sync with your receipts, invoices, and staff directory.
            </Text>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>{profile.fullName}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue}>{profile.email}</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Contact Number</Text>
              <Text style={styles.infoValue}>
                {formatPhoneNumber(profile.contactNumber)}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Role & Access Level</Text>
              <Text style={styles.infoValue}>{profile.role}</Text>
            </View>
          </View>

          {/* Business Identity Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Identity</Text>
            <Text style={styles.sectionDescription}>
              Static preview of data that will drive receipt headers and tax reports.
            </Text>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Legal / Trading Name</Text>
              <Text style={styles.infoValue}>{profile.businessName}</Text>
              <Text style={styles.infoNote}>
                Once backend is wired, you'll be able to maintain your BIR registration details, branch codes, and OR series from here.
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Industry</Text>
              <Text style={styles.infoValue}>{profile.industry}</Text>
            </View>
          </View>

          {/* Security Preferences Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security Preferences</Text>
            <Text style={styles.sectionDescription}>
              Coming soon: enforce 2-factor authentication and manager PIN approvals.
            </Text>

            <View style={styles.preferenceCard}>
              <View style={styles.preferenceHeader}>
                <Text style={styles.preferenceTitle}>Device Approvals</Text>
                <View style={[styles.badge, styles.badgePlanned]}>
                  <Text style={styles.badgeText}>Planned</Text>
                </View>
              </View>
              <Text style={styles.preferenceDescription}>
                Restrict logins to whitelisted POS tablets. We'll store device fingerprints once the endpoint lands.
              </Text>
            </View>

            <View style={styles.preferenceCard}>
              <View style={styles.preferenceHeader}>
                <Text style={styles.preferenceTitle}>Manager PIN</Text>
                <View style={[styles.badge, styles.badgeEnabled]}>
                  <Text style={styles.badgeText}>Enabled</Text>
                </View>
              </View>
              <Text style={styles.preferenceDescription}>
                Configure approval overrides for voids, refunds, and discounts. Static badge mirrors your current plan.
              </Text>
            </View>

            <View style={styles.preferenceCard}>
              <View style={styles.preferenceHeader}>
                <Text style={styles.preferenceTitle}>Password Hygiene</Text>
                <View style={[styles.badge, styles.badgeMonitoring]}>
                  <Text style={styles.badgeText}>Monitoring</Text>
                </View>
              </View>
              <Text style={styles.preferenceDescription}>
                Force rotation every 90 days, plus email alerts for suspicious sign-ins. All static for now.
              </Text>
            </View>
          </View>

          {/* POS Configuration Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>POS Configuration</Text>
            <Text style={styles.sectionDescription}>
              Default settings that will be exposed via upcoming settings APIs.
            </Text>

            {[
              {
                title: 'Auto-close shift reminders',
                description: 'Send the cashier a push notification 5 minutes before closing time.',
                state: 'Enabled',
                badgeClass: styles.badgeEnabled,
              },
              {
                title: 'Auto-print receipts',
                description: 'Automatically print after successful payment. Manual override stays available per order.',
                state: 'Disabled',
                badgeClass: styles.badgeMonitoring,
              },
              {
                title: 'Barcode scanner sound',
                description: 'Play an audible tone whenever a barcode scans successfully.',
                state: 'Enabled',
                badgeClass: styles.badgeEnabled,
              },
              {
                title: 'Low-stock push alerts',
                description: 'Notify the assigned manager once a SKU dips below its threshold.',
                state: 'Enabled',
                badgeClass: styles.badgeEnabled,
              },
            ].map((item, index) => (
              <View key={index} style={styles.preferenceCard}>
                <View style={styles.preferenceHeader}>
                  <Text style={styles.preferenceTitle}>{item.title}</Text>
                  <View style={[styles.badge, item.badgeClass]}>
                    <Text style={styles.badgeText}>{item.state}</Text>
                  </View>
                </View>
                <Text style={styles.preferenceDescription}>
                  {item.description}
                </Text>
              </View>
            ))}
          </View>

          {/* Notification Channels Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Channels</Text>
            <Text style={styles.sectionDescription}>
              Target channels are static placeholders that we'll replace with real preferences once the messaging service is wired.
            </Text>

            {[
              {
                label: 'Email summaries',
                description: 'Daily sales digest every 10:00 PM PH time with branch breakdowns.',
                status: 'Scheduled',
                badgeClass: styles.badgeEnabled,
              },
              {
                label: 'SMS alerts',
                description: 'Instant SMS when voids, refunds, or manager overrides happen.',
                status: 'Planned',
                badgeClass: styles.badgePlanned,
              },
              {
                label: 'Slack integration',
                description: 'Post low-stock and large-transaction alerts to #ops channel.',
                status: 'Planned',
                badgeClass: styles.badgePlanned,
              },
            ].map((item, index) => (
              <View key={index} style={styles.preferenceCard}>
                <View style={styles.preferenceHeader}>
                  <Text style={styles.preferenceTitle}>{item.label}</Text>
                  <View style={[styles.badge, item.badgeClass]}>
                    <Text style={styles.badgeText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.preferenceDescription}>
                  {item.description}
                </Text>
              </View>
            ))}
          </View>

          {/* Connected Devices Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connected Devices & Sessions</Text>
            <Text style={styles.sectionDescription}>
              Static table to visualise future session management API responses.
            </Text>

            {[
              {
                name: 'iPad Mini 6 (Counter 1)',
                location: 'Makati Avenue',
                lastActive: 'Today, 10:24 AM',
                status: 'Active',
                badgeClass: styles.badgeEnabled,
              },
              {
                name: 'Sunmi V2 Handheld',
                location: 'BGC Central',
                lastActive: 'Yesterday, 9:02 PM',
                status: 'Idle',
                badgeClass: styles.badgeMonitoring,
              },
              {
                name: 'MacBook Pro (Back office)',
                location: 'Quezon City',
                lastActive: '2 days ago',
                status: 'Needs review',
                badgeClass: styles.badgePlanned,
              },
            ].map((device, index) => (
              <View key={index} style={styles.deviceCard}>
                <View style={styles.deviceHeader}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <View style={[styles.badge, device.badgeClass]}>
                    <Text style={styles.badgeText}>{device.status}</Text>
                  </View>
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceLabel}>Location:</Text>
                  <Text style={styles.deviceValue}>{device.location}</Text>
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceLabel}>Last active:</Text>
                  <Text style={styles.deviceValue}>{device.lastActive}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Logout Section */}
          <View style={styles.section}>
            <View style={styles.logoutCard}>
              <TouchableOpacity
                style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
                onPress={handleLogout}
                disabled={isLoggingOut}
              >
                <Text style={styles.logoutButtonText}>
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.logoutDescription}>
                Sign out of your account. You'll need to login again to access the app.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  infoNote: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    lineHeight: 16,
  },
  preferenceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  preferenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  preferenceDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeEnabled: {
    backgroundColor: '#d1fae5',
  },
  badgePlanned: {
    backgroundColor: '#fef3c7',
  },
  badgeMonitoring: {
    backgroundColor: '#e5e7eb',
  },
  deviceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  deviceInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  deviceLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
    minWidth: 80,
  },
  deviceValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  logoutCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});


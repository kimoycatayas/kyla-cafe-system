import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { MainTabParamList } from '../types/navigation';
import DashboardScreen from '../screens/DashboardScreen';
import SalesScreen from '../screens/SalesScreen';
import ProductsScreen from '../screens/ProductsScreen';
import OrdersScreen from '../screens/OrdersScreen';
import InventoryScreen from '../screens/InventoryScreen';
import UserSettingsScreen from '../screens/UserSettingsScreen';
import { storage } from '../lib/storage';
import type { User } from '../lib/authClient';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabsNavigator() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const userData = await storage.getUser();
      setUser(userData);
      setIsLoading(false);
    };
    loadUser();
  }, []);

  // For cashiers, only show Sales tab
  const isCashier = user?.role === 'CASHIER';

  if (isLoading) {
    // You could show a loading screen here
    return null;
  }

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTintColor: '#333',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
        },
      }}
      initialRouteName={isCashier ? 'Sales' : 'Dashboard'}
    >
      {!isCashier && (
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <TabIcon name="📊" size={size} />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Sales"
        component={SalesScreen}
        options={{
          tabBarLabel: 'Sales',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="💰" size={size} />
          ),
        }}
      />
      {!isCashier && (
        <>
          <Tab.Screen
            name="Products"
            component={ProductsScreen}
            options={{
              tabBarLabel: 'Products',
              tabBarIcon: ({ color, size }) => (
                <TabIcon name="📦" size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Orders"
            component={OrdersScreen}
            options={{
              tabBarLabel: 'Orders',
              tabBarIcon: ({ color, size }) => (
                <TabIcon name="📋" size={size} />
              ),
            }}
          />
          <Tab.Screen
            name="Inventory"
            component={InventoryScreen}
            options={{
              tabBarLabel: 'Inventory',
              tabBarIcon: ({ color, size }) => (
                <TabIcon name="📊" size={size} />
              ),
            }}
          />
        </>
      )}
      <Tab.Screen
        name="Settings"
        component={UserSettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="⚙️" size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Simple icon component using emoji (you can replace with react-native-vector-icons later)
function TabIcon({ name, size }: { name: string; size: number }) {
  return <Text style={{ fontSize: size }}>{name}</Text>;
}


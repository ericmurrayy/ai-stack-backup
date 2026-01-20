// Murray's FSM - Settings Screen
// ================================

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSelector } from '@legendapp/state/react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks';
import { appState$ } from '../../src/store';
import { Card } from '../../src/components';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const isOnline = useSelector(() => appState$.isOnline.get());
  const lastSyncTime = useSelector(() => appState$.lastSyncTime.get());

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            Alert.alert('Error', 'Failed to sign out');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Account Section */}
        <Text style={styles.sectionTitle}>Account</Text>
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Ionicons name="person" size={20} color="#1e40af" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{user?.email || 'Not signed in'}</Text>
            </View>
          </View>
        </Card>

        {/* Sync Status Section */}
        <Text style={styles.sectionTitle}>Sync Status</Text>
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Ionicons
                name={isOnline ? 'cloud-done' : 'cloud-offline'}
                size={20}
                color={isOnline ? '#16a34a' : '#f59e0b'}
              />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Connection</Text>
              <Text style={[styles.rowValue, { color: isOnline ? '#16a34a' : '#f59e0b' }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Ionicons name="sync" size={20} color="#1e40af" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Last Sync</Text>
              <Text style={styles.rowValue}>
                {lastSyncTime || 'Not synced yet'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Info Section */}
        <Text style={styles.sectionTitle}>About</Text>
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Ionicons name="information-circle" size={20} color="#1e40af" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconContainer}>
              <Ionicons name="construct" size={20} color="#1e40af" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>App</Text>
              <Text style={styles.rowValue}>Murray's FSM</Text>
            </View>
          </View>
        </Card>

        {/* Sign Out */}
        <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7}>
          <Card style={styles.signOutCard}>
            <Ionicons name="log-out" size={20} color="#dc2626" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Card>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  rowValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginLeft: 64,
  },
  signOutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 24,
    gap: 8,
  },
  signOutText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
});

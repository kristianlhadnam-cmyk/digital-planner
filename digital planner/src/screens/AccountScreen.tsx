import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { RootStackParamList } from '../types';
import { COLORS } from '../utils/constants';
import CalendarHeader from '../components/CalendarHeader';
import { getCurrentUser, logOut, AuthUser } from '../services/AuthService';
import { syncFromCloud } from '../services/StorageService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Account'>;
};

export default function AccountScreen({ navigation }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncFromCloud();
      setLastSync(new Date());
      Alert.alert('✅ Synced', 'Your data has been synced from the cloud.');
    } catch (e) {
      Alert.alert('Sync Error', 'Could not sync. Check your internet.');
    }
    setSyncing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure? Your data is safe in the cloud.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logOut();
              navigation.replace('Login');
            } catch (e) {
              Alert.alert('Error', 'Could not logout.');
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <CalendarHeader
          onHomePress={() => navigation.navigate('Home')}
          title="Account"
        />
        <View style={styles.notLoggedIn}>
          <Text style={styles.notLoggedInIcon}>👤</Text>
          <Text style={styles.notLoggedInTitle}>Not Logged In</Text>
          <Text style={styles.notLoggedInText}>
            Login to sync your data across devices
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => navigation.replace('Login')}
          >
            <Text style={styles.loginBtnText}>🔐 Login or Sign Up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        title="Account"
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Text style={styles.avatar}>
            {user.displayName ? user.displayName.charAt(0).toUpperCase() : '👤'}
          </Text>
          <Text style={styles.userName}>
            {user.displayName || 'User'}
          </Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>☁️ Cloud Sync Active</Text>
          </View>
        </View>

        {/* Sync Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Status</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, { color: COLORS.success }]}>
              ✓ Connected
            </Text>
          </View>

          {lastSync && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last sync:</Text>
              <Text style={styles.infoValue}>
                {format(lastSync, 'MMM d, HH:mm:ss')}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
            onPress={handleSync}
            disabled={syncing}
            activeOpacity={0.7}
          >
            {syncing ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.syncBtnText}>🔄 Sync Now</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Info</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{user.displayName || '—'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID:</Text>
            <Text style={[styles.infoValue, styles.smallText]} numberOfLines={1}>
              {user.uid}
            </Text>
          </View>
        </View>

        {/* What Syncs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What Syncs?</Text>
          <Text style={styles.syncItem}>📝 Notes & Journal entries</Text>
          <Text style={styles.syncItem}>✅ To-do lists</Text>
          <Text style={styles.syncItem}>📅 Custom events</Text>
          <Text style={styles.syncItem}>✏️ Daily handwriting</Text>
          <Text style={styles.syncItem}>📄 PDF annotations</Text>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutBtnText}>🚪 Logout</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Your data is encrypted and only accessible by you.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },

  notLoggedIn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  notLoggedInIcon: { fontSize: 64, marginBottom: 16 },
  notLoggedInTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  notLoggedInText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  loginBtn: {
    backgroundColor: COLORS.highlight,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },

  profileCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.highlight,
    color: COLORS.white,
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 80,
    marginBottom: 12,
    overflow: 'hidden',
  },
  userName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: COLORS.todayBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  statusBadgeText: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '700',
  },

  section: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  smallText: {
    fontSize: 10,
    fontFamily: 'monospace',
  },

  syncBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  syncBtnDisabled: {
    opacity: 0.6,
  },
  syncBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },

  syncItem: {
    color: COLORS.textSecondary,
    fontSize: 13,
    paddingVertical: 4,
  },

  logoutBtn: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  logoutBtnText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: '700',
  },

  footer: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
  },
});

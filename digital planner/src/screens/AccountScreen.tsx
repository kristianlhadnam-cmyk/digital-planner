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
  const [syncResult, setSyncResult] = useState<string>('');

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult('');
    try {
      const result = await syncFromCloud();
      setLastSync(new Date());
      
      const message = `Downloaded:
📝 ${result.notesCount} notes
✅ ${result.todosCount} todo lists
📅 ${result.eventsCount} days with events
✏️ ${result.drawingsCount} days with drawings`;
      
      setSyncResult(message);
      
      Alert.alert(
        '✅ Sync Complete!',
        message + '\n\nGo back to home to see your data!'
      );
    } catch (e: any) {
      Alert.alert('Sync Error', 'Could not sync: ' + String(e.message || e));
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

        {/* SYNC BUTTON - PROMINENT */}
        <TouchableOpacity
          style={[styles.bigSyncBtn, syncing && styles.bigSyncBtnDisabled]}
          onPress={handleSync}
          disabled={syncing}
          activeOpacity={0.7}
        >
          {syncing ? (
            <>
              <ActivityIndicator size="large" color={COLORS.white} />
              <Text style={styles.bigSyncText}>Syncing from cloud...</Text>
            </>
          ) : (
            <>
              <Text style={styles.bigSyncIcon}>🔄</Text>
              <Text style={styles.bigSyncText}>Download from Cloud</Text>
              <Text style={styles.bigSyncSub}>
                Tap to get latest data from other devices
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Sync Result */}
        {syncResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>✅ Last Sync</Text>
            <Text style={styles.resultText}>{syncResult}</Text>
            {lastSync && (
              <Text style={styles.resultTime}>
                {format(lastSync, 'MMM d, HH:mm:ss')}
              </Text>
            )}
          </View>
        ) : null}

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📖 How to Use Sync</Text>
          <Text style={styles.instructionStep}>
            <Text style={styles.bold}>1.</Text> On device A: Create notes, events, etc.
          </Text>
          <Text style={styles.instructionStep}>
            <Text style={styles.bold}>2.</Text> Data uploads to cloud automatically
          </Text>
          <Text style={styles.instructionStep}>
            <Text style={styles.bold}>3.</Text> On device B: Tap "🔄 Download from Cloud"
          </Text>
          <Text style={styles.instructionStep}>
            <Text style={styles.bold}>4.</Text> Your data appears on device B!
          </Text>
          <Text style={styles.tipText}>
            💡 Tip: Tap sync each time you switch devices
          </Text>
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

  bigSyncBtn: {
    backgroundColor: COLORS.highlight,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 140,
    justifyContent: 'center',
  },
  bigSyncBtnDisabled: {
    opacity: 0.7,
  },
  bigSyncIcon: { fontSize: 48, marginBottom: 8 },
  bigSyncText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  bigSyncSub: {
    color: COLORS.white,
    fontSize: 12,
    marginTop: 6,
    opacity: 0.9,
    textAlign: 'center',
  },

  resultCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  resultTitle: {
    color: COLORS.success,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  resultText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 20,
  },
  resultTime: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 8,
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
  instructionStep: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 22,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '800',
    color: COLORS.highlight,
  },
  tipText: {
    color: COLORS.accent,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 12,
    backgroundColor: COLORS.todayBg,
    padding: 10,
    borderRadius: 8,
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

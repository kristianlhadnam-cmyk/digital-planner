import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS } from '../utils/constants';
import { signIn, resetPassword } from '../services/AuthService';
import { syncFromCloud } from '../services/StorageService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Info', 'Please enter email and password.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      // Sync data from cloud
      await syncFromCloud();
      navigation.replace('Home');
    } catch (e: any) {
      Alert.alert('Login Failed', e.message);
    }
    setLoading(false);
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      Alert.alert(
        'Enter Email First',
        'Please enter your email address, then tap "Forgot Password" again.'
      );
      return;
    }

    Alert.alert(
      'Reset Password',
      `Send password reset email to ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              await resetPassword(email);
              Alert.alert(
                '✅ Email Sent',
                'Check your inbox for the password reset link.'
              );
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const continueOffline = () => {
    navigation.replace('Home');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.icon}>📓</Text>
            <Text style={styles.title}>Digital Planner</Text>
            <Text style={styles.subtitle}>Sign in to sync across devices</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={COLORS.textSecondary}
              secureTextEntry
              autoComplete="password"
              editable={!loading}
            />

            <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.loginBtnText}>🔐 Login</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.signUpBtn}
              onPress={() => navigation.navigate('SignUp')}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.signUpBtnText}>✨ Create New Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.offlineBtn}
              onPress={continueOffline}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.offlineBtnText}>📱 Continue Offline</Text>
              <Text style={styles.offlineBtnSub}>
                Use without account (no sync)
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              ✓ Your data stays private and secure{'\n'}
              ✓ Sync across phone, tablet, and more{'\n'}
              ✓ Free forever
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40 },

  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  icon: { fontSize: 64, marginBottom: 12 },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },

  form: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 14,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  forgotText: {
    color: COLORS.accent,
    fontSize: 13,
    textAlign: 'right',
    marginTop: 10,
    marginBottom: 16,
  },

  loginBtn: {
    backgroundColor: COLORS.highlight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.cardBorder,
  },
  dividerText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginHorizontal: 12,
    fontWeight: '700',
  },

  signUpBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  signUpBtnText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },

  offlineBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  offlineBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  offlineBtnSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },

  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
});

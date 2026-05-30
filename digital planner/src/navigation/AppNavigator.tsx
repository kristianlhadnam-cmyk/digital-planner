import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS } from '../utils/constants';
import { subscribeToAuthChanges } from '../services/AuthService';

import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import HomeScreen from '../screens/HomeScreen';
import YearlyViewScreen from '../screens/YearlyViewScreen';
import MonthlyViewScreen from '../screens/MonthlyViewScreen';
import WeeklyViewScreen from '../screens/WeeklyViewScreen';
import DailyViewScreen from '../screens/DailyViewScreen';
import TodoListScreen from '../screens/TodoListScreen';
import NotesJournalScreen from '../screens/NotesJournalScreen';
import NoteEditorScreen from '../screens/NoteEditorScreen';
import PdfViewerScreen from '../screens/PdfViewerScreen';
import AccountScreen from '../screens/AccountScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setIsLoggedIn(user !== null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={COLORS.highlight} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isLoggedIn ? 'Home' : 'Login'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
        <Stack.Screen name="YearlyView" component={YearlyViewScreen} />
        <Stack.Screen name="MonthlyView" component={MonthlyViewScreen} />
        <Stack.Screen name="WeeklyView" component={WeeklyViewScreen} />
        <Stack.Screen name="DailyView" component={DailyViewScreen} />
        <Stack.Screen name="TodoList" component={TodoListScreen} />
        <Stack.Screen name="NotesJournal" component={NotesJournalScreen} />
        <Stack.Screen name="NoteEditor" component={NoteEditorScreen} />
        <Stack.Screen name="PdfViewer" component={PdfViewerScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

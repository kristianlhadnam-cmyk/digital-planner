// FILE: digital-planner/src/navigation/AppNavigator.tsx

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS } from '../utils/constants';

import HomeScreen from '../screens/HomeScreen';
import YearlyViewScreen from '../screens/YearlyViewScreen';
import MonthlyViewScreen from '../screens/MonthlyViewScreen';
import WeeklyViewScreen from '../screens/WeeklyViewScreen';
import DailyViewScreen from '../screens/DailyViewScreen';
import TodoListScreen from '../screens/TodoListScreen';
import NotesJournalScreen from '../screens/NotesJournalScreen';
import NoteEditorScreen from '../screens/NoteEditorScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="YearlyView" component={YearlyViewScreen} />
        <Stack.Screen name="MonthlyView" component={MonthlyViewScreen} />
        <Stack.Screen name="WeeklyView" component={WeeklyViewScreen} />
        <Stack.Screen name="DailyView" component={DailyViewScreen} />
        <Stack.Screen name="TodoList" component={TodoListScreen} />
        <Stack.Screen name="NotesJournal" component={NotesJournalScreen} />
        <Stack.Screen name="NoteEditor" component={NoteEditorScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
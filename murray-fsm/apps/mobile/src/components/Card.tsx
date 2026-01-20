// Murray's FSM - Card Component
// ===============================

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 'medium',
}) => {
  return (
    <View style={[styles.card, styles[`padding_${padding}`], style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  padding_none: {
    padding: 0,
  },
  padding_small: {
    padding: 8,
  },
  padding_medium: {
    padding: 16,
  },
  padding_large: {
    padding: 24,
  },
});

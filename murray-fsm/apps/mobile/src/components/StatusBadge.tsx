// Murray's FSM - Status Badge Component
// =======================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { JobStatus } from '../types';

interface StatusBadgeProps {
  status: JobStatus;
  size?: 'small' | 'medium';
}

const statusConfig: Record<JobStatus, { bg: string; text: string; label: string }> = {
  scheduled: { bg: '#dbeafe', text: '#1e40af', label: 'Scheduled' },
  in_progress: { bg: '#fef3c7', text: '#d97706', label: 'In Progress' },
  completed: { bg: '#dcfce7', text: '#16a34a', label: 'Completed' },
  canceled: { bg: '#fee2e2', text: '#dc2626', label: 'Canceled' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'medium',
}) => {
  const config = statusConfig[status] || statusConfig.scheduled;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg },
        size === 'small' && styles.small,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: config.text },
          size === 'small' && styles.smallText,
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  smallText: {
    fontSize: 12,
  },
});

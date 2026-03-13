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
  new: { bg: '#dbeafe', text: '#2563eb', label: 'New' },
  contacted: { bg: '#e0e7ff', text: '#4338ca', label: 'Contacted' },
  scheduled: { bg: '#cffafe', text: '#0891b2', label: 'Scheduled' },
  in_progress: { bg: '#fef3c7', text: '#d97706', label: 'In Progress' },
  completed: { bg: '#dcfce7', text: '#16a34a', label: 'Completed' },
  cancelled: { bg: '#fee2e2', text: '#dc2626', label: 'Cancelled' },
  spam: { bg: '#f3f4f6', text: '#6b7280', label: 'Spam' },
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

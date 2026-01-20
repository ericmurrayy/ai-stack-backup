// Murray's FSM - Job Card Component
// ===================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSelector } from '@legendapp/state/react';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';
import { customers$, locations$ } from '../store';
import { formatScheduleLabel, formatAddressOneLine } from '../utils/format';
import type { Job } from '../types';

interface JobCardProps {
  job: Job;
  onPress: () => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onPress }) => {
  const customer = useSelector(() => customers$[job.customer_id]?.get());
  const location = useSelector(() =>
    job.location_id ? locations$[job.location_id]?.get() : null
  );

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {job.title}
            </Text>
            <StatusBadge status={job.status} size="small" />
          </View>
          {customer && (
            <Text style={styles.customer}>{customer.name}</Text>
          )}
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color="#64748b" />
            <Text style={styles.detailText}>
              {formatScheduleLabel(job.scheduled_start)}
            </Text>
          </View>

          {location && (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color="#64748b" />
              <Text style={styles.detailText} numberOfLines={1}>
                {formatAddressOneLine(location.address1, location.city, location.state)}
              </Text>
            </View>
          )}

          {job.service_type && (
            <View style={styles.detailRow}>
              <Ionicons name="construct-outline" size={16} color="#64748b" />
              <Text style={styles.detailText}>{job.service_type}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  customer: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  details: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  footer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
});

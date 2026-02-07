// Murray's FSM - Today Screen
// ============================

import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { Ionicons } from '@expo/vector-icons';
import { jobs$, appState$ } from '../../src/store';
import { JobCard, Card } from '../../src/components';
import { isToday, parseISO } from 'date-fns';
import type { Job } from '../../src/types';

export default function TodayScreen() {
  const router = useRouter();
  const allJobs = useSelector(() => jobs$.get());
  const isOnline = useSelector(() => appState$.isOnline.get());
  const isSyncing = useSelector(() => appState$.isSyncing.get());

  const todayJobs = useMemo(() => {
    if (!allJobs) return [];
    return Object.values(allJobs)
      .filter((job) => {
        if (!job.scheduled_start || job.deleted) return false;
        return isToday(parseISO(job.scheduled_start));
      })
      .sort((a, b) => {
        const dateA = new Date(a.scheduled_start!);
        const dateB = new Date(b.scheduled_start!);
        return dateA.getTime() - dateB.getTime();
      });
  }, [allJobs]);

  const handleJobPress = (job: Job) => {
    router.push(`/job/${job.id}`);
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color="#cbd5e1" />
      <Text style={styles.emptyTitle}>No Jobs Today</Text>
      <Text style={styles.emptyText}>
        You don't have any jobs scheduled for today.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={16} color="#ffffff" />
          <Text style={styles.offlineText}>Offline Mode</Text>
        </View>
      )}

      <FlatList
        data={todayJobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <JobCard job={item} onPress={() => handleJobPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        ListHeaderComponent={
          <View style={styles.header}>
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{todayJobs.length}</Text>
                  <Text style={styles.summaryLabel}>Jobs Today</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {todayJobs.filter((j) => j.status === 'completed').length}
                  </Text>
                  <Text style={styles.summaryLabel}>Completed</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {todayJobs.filter((j) => j.status === 'in_progress').length}
                  </Text>
                  <Text style={styles.summaryLabel}>In Progress</Text>
                </View>
              </View>
            </Card>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isSyncing}
            onRefresh={() => {
              // Trigger sync refresh
              appState$.isSyncing.set(true);
              setTimeout(() => appState$.isSyncing.set(false), 1000);
            }}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  offlineBanner: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  offlineText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  header: {
    marginBottom: 16,
  },
  summaryCard: {
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e40af',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#475569',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
});

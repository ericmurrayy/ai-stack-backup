// Murray's FSM - Schedule Screen
// ================================

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, startOfDay, addDays, isSameDay } from 'date-fns';
import { jobs$ } from '../../src/store';
import { JobCard } from '../../src/components';
import type { Job } from '../../src/types';

interface Section {
  title: string;
  date: Date;
  data: Job[];
}

export default function ScheduleScreen() {
  const router = useRouter();
  const allJobs = useSelector(() => jobs$.get());
  const [daysToShow, setDaysToShow] = useState(7);

  const sections = useMemo((): Section[] => {
    if (!allJobs) return [];

    const today = startOfDay(new Date());
    const endDate = addDays(today, daysToShow);

    // Filter jobs within date range
    const scheduledJobs = Object.values(allJobs)
      .filter((job) => {
        if (!job.scheduled_start || job.deleted) return false;
        const jobDate = parseISO(job.scheduled_start);
        return jobDate >= today && jobDate <= endDate;
      })
      .sort((a, b) => {
        const dateA = new Date(a.scheduled_start!);
        const dateB = new Date(b.scheduled_start!);
        return dateA.getTime() - dateB.getTime();
      });

    // Group by date
    const grouped = new Map<string, Job[]>();

    for (let i = 0; i < daysToShow; i++) {
      const date = addDays(today, i);
      const dateKey = format(date, 'yyyy-MM-dd');
      grouped.set(dateKey, []);
    }

    scheduledJobs.forEach((job) => {
      const jobDate = parseISO(job.scheduled_start!);
      const dateKey = format(jobDate, 'yyyy-MM-dd');
      const existing = grouped.get(dateKey) || [];
      grouped.set(dateKey, [...existing, job]);
    });

    return Array.from(grouped.entries()).map(([dateKey, jobs]) => {
      const date = parseISO(dateKey);
      let title = format(date, 'EEEE, MMMM d');

      if (isSameDay(date, today)) {
        title = 'Today - ' + title;
      } else if (isSameDay(date, addDays(today, 1))) {
        title = 'Tomorrow - ' + format(date, 'MMMM d');
      }

      return {
        title,
        date,
        data: jobs,
      };
    });
  }, [allJobs, daysToShow]);

  const handleJobPress = (job: Job) => {
    router.push(`/job/${job.id}`);
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>
        {section.data.length} {section.data.length === 1 ? 'job' : 'jobs'}
      </Text>
    </View>
  );

  const renderEmptySection = () => (
    <View style={styles.emptySection}>
      <Text style={styles.emptySectionText}>No jobs scheduled</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <JobCard job={item} onPress={() => handleJobPress(item)} />
        )}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? renderEmptySection() : null
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        ListFooterComponent={
          daysToShow < 30 ? (
            <TouchableOpacity
              style={styles.loadMore}
              onPress={() => setDaysToShow((prev) => prev + 7)}
            >
              <Text style={styles.loadMoreText}>Load More Days</Text>
              <Ionicons name="chevron-down" size={16} color="#1e40af" />
            </TouchableOpacity>
          ) : null
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
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  sectionCount: {
    fontSize: 14,
    color: '#64748b',
  },
  emptySection: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  emptySectionText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loadMoreText: {
    color: '#1e40af',
    fontWeight: '600',
    fontSize: 14,
  },
});

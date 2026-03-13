// Murray's FSM - Job Detail Screen
// ==================================

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useJob, usePayment } from '../../src/hooks';
import { Card, Button, StatusBadge, LineItemRow } from '../../src/components';
import {
  formatCents,
  formatPhone,
  formatAddress,
  formatScheduleLabel,
  formatDateTime,
} from '../../src/utils/format';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    job,
    customer,
    location,
    estimateItems,
    invoiceItems,
    estimateTotal,
    invoiceTotal,
    paidTotal,
    balanceDue,
    isOnline,
    updateStatus,
    markArrived,
  } = useJob(id);
  const { createPayment, loading: paymentLoading } = usePayment();
  const [activeTab, setActiveTab] = useState<'details' | 'estimate' | 'invoice'>('details');

  if (!job) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Job not found</Text>
      </View>
    );
  }

  const handleCall = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

  const handleNavigate = () => {
    if (location) {
      const address = `${location.address1}, ${location.city}, ${location.state} ${location.postal_code}`;
      const url = `maps://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
      Linking.openURL(url);
    }
  };

  const handleStatusChange = (newStatus: typeof job.status) => {
    Alert.alert(
      'Update Status',
      `Change job status to ${newStatus.replace('_', ' ')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => updateStatus(newStatus),
        },
      ]
    );
  };

  const handleMarkArrived = () => {
    Alert.alert('Arrived', 'Mark as arrived at job site?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: markArrived },
    ]);
  };

  const handlePayment = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Payment requires an internet connection');
      return;
    }

    if (balanceDue <= 0) {
      Alert.alert('No Balance', 'This job has no balance due');
      return;
    }

    const result = await createPayment(job.id, balanceDue, customer?.email || undefined);

    if (result.success) {
      Alert.alert('Success', 'Payment completed successfully');
    } else if (result.error !== 'Payment cancelled') {
      Alert.alert('Payment Failed', result.error);
    }
  };

  const renderStatusActions = () => {
    switch (job.status) {
      case 'scheduled':
        return (
          <View style={styles.actionButtons}>
            {!job.arrived_at && (
              <Button
                title="Mark Arrived"
                onPress={handleMarkArrived}
                variant="outline"
                icon={<Ionicons name="location" size={18} color="#1e40af" />}
              />
            )}
            <Button
              title="Start Job"
              onPress={() => handleStatusChange('in_progress')}
              variant="primary"
              icon={<Ionicons name="play" size={18} color="#ffffff" />}
            />
          </View>
        );
      case 'in_progress':
        return (
          <View style={styles.actionButtons}>
            <Button
              title="Complete Job"
              onPress={() => handleStatusChange('completed')}
              variant="success"
              icon={<Ionicons name="checkmark-circle" size={18} color="#ffffff" />}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerTitle: job.title ?? 'Job Details' }} />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Header Card */}
          <Card style={styles.headerCard}>
            <View style={styles.headerRow}>
              <StatusBadge status={job.status} />
              <Text style={styles.scheduleTime}>
                {formatScheduleLabel(job.scheduled_start)}
              </Text>
            </View>
            <Text style={styles.jobTitle}>{job.title}</Text>
            {job.service_type && (
              <Text style={styles.serviceType}>{job.service_type}</Text>
            )}
          </Card>

          {/* Customer Card */}
          {customer && (
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Customer</Text>
              <Text style={styles.customerName}>{customer.name}</Text>
              {customer.phone && (
                <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
                  <Ionicons name="call" size={18} color="#1e40af" />
                  <Text style={styles.contactText}>{formatPhone(customer.phone)}</Text>
                </TouchableOpacity>
              )}
              {customer.email && (
                <View style={styles.contactRow}>
                  <Ionicons name="mail" size={18} color="#64748b" />
                  <Text style={styles.contactTextMuted}>{customer.email}</Text>
                </View>
              )}
            </Card>
          )}

          {/* Location Card */}
          {location && (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Location</Text>
                <TouchableOpacity onPress={handleNavigate}>
                  <Ionicons name="navigate" size={22} color="#1e40af" />
                </TouchableOpacity>
              </View>
              <Text style={styles.addressText}>
                {formatAddress(
                  location.address1,
                  location.address2,
                  location.city,
                  location.state,
                  location.postal_code
                )}
              </Text>
              {location.access_notes && (
                <View style={styles.accessNotes}>
                  <Ionicons name="information-circle" size={16} color="#f59e0b" />
                  <Text style={styles.accessNotesText}>{location.access_notes}</Text>
                </View>
              )}
            </Card>
          )}

          {/* Problem Description */}
          {job.problem_description && (
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>Problem Description</Text>
              <Text style={styles.descriptionText}>{job.problem_description}</Text>
            </Card>
          )}

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'details' && styles.tabActive]}
              onPress={() => setActiveTab('details')}
            >
              <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>
                Details
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'estimate' && styles.tabActive]}
              onPress={() => setActiveTab('estimate')}
            >
              <Text style={[styles.tabText, activeTab === 'estimate' && styles.tabTextActive]}>
                Estimate ({estimateItems.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'invoice' && styles.tabActive]}
              onPress={() => setActiveTab('invoice')}
            >
              <Text style={[styles.tabText, activeTab === 'invoice' && styles.tabTextActive]}>
                Invoice ({invoiceItems.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {activeTab === 'details' && (
            <Card style={styles.card}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Arrived</Text>
                <Text style={styles.detailValue}>
                  {job.arrived_at ? formatDateTime(job.arrived_at) : '-'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Started</Text>
                <Text style={styles.detailValue}>
                  {job.started_at ? formatDateTime(job.started_at) : '-'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Completed</Text>
                <Text style={styles.detailValue}>
                  {job.completed_at ? formatDateTime(job.completed_at) : '-'}
                </Text>
              </View>
              {job.internal_notes && (
                <>
                  <Text style={[styles.cardTitle, { marginTop: 16 }]}>Internal Notes</Text>
                  <Text style={styles.notesText}>{job.internal_notes}</Text>
                </>
              )}
            </Card>
          )}

          {activeTab === 'estimate' && (
            <Card style={styles.card}>
              {estimateItems.length > 0 ? (
                <>
                  {estimateItems.map((item) => (
                    <LineItemRow key={item.id} item={item} />
                  ))}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Estimate Total</Text>
                    <Text style={styles.totalValue}>{formatCents(estimateTotal)}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>No estimate items</Text>
              )}
            </Card>
          )}

          {activeTab === 'invoice' && (
            <Card style={styles.card}>
              {invoiceItems.length > 0 ? (
                <>
                  {invoiceItems.map((item) => (
                    <LineItemRow key={item.id} item={item} />
                  ))}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Invoice Total</Text>
                    <Text style={styles.totalValue}>{formatCents(invoiceTotal)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Paid</Text>
                    <Text style={[styles.totalValue, { color: '#16a34a' }]}>
                      {formatCents(paidTotal)}
                    </Text>
                  </View>
                  {balanceDue > 0 && (
                    <View style={styles.totalRow}>
                      <Text style={styles.balanceLabel}>Balance Due</Text>
                      <Text style={styles.balanceValue}>{formatCents(balanceDue)}</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.emptyText}>No invoice items</Text>
              )}
            </Card>
          )}

          {/* Payment Button */}
          {balanceDue > 0 && (
            <Button
              title={`Collect Payment - ${formatCents(balanceDue)}`}
              onPress={handlePayment}
              loading={paymentLoading}
              disabled={!isOnline}
              variant="success"
              size="large"
              style={styles.paymentButton}
              icon={<Ionicons name="card" size={20} color="#ffffff" />}
            />
          )}

          {/* Status Actions */}
          {renderStatusActions()}

          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    padding: 16,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 18,
    color: '#64748b',
  },
  headerCard: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scheduleTime: {
    fontSize: 14,
    color: '#64748b',
  },
  jobTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
  },
  serviceType: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  contactText: {
    fontSize: 16,
    color: '#1e40af',
  },
  contactTextMuted: {
    fontSize: 16,
    color: '#64748b',
  },
  addressText: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 24,
  },
  accessNotes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  accessNotesText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
  },
  descriptionText: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 24,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#1e40af',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  notesText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 22,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  balanceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#dc2626',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 24,
  },
  paymentButton: {
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomPadding: {
    height: 32,
  },
});

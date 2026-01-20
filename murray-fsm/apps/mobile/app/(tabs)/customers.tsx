// Murray's FSM - Customers Screen
// =================================

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSelector } from '@legendapp/state/react';
import { Ionicons } from '@expo/vector-icons';
import { customers$ } from '../../src/store';
import { Card } from '../../src/components';
import { formatPhone, formatInitials } from '../../src/utils/format';
import type { Customer } from '../../src/types';

export default function CustomersScreen() {
  const allCustomers = useSelector(() => customers$.get());
  const [search, setSearch] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!allCustomers) return [];
    const list = Object.values(allCustomers).filter((c) => !c.deleted);

    if (!search.trim()) {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const searchLower = search.toLowerCase();
    return list
      .filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.phone?.includes(search) ||
          c.email?.toLowerCase().includes(searchLower)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCustomers, search]);

  const renderCustomer = ({ item }: { item: Customer }) => (
    <TouchableOpacity activeOpacity={0.7}>
      <Card style={styles.customerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{formatInitials(item.name)}</Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.name}</Text>
          {item.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={14} color="#64748b" />
              <Text style={styles.infoText}>{formatPhone(item.phone)}</Text>
            </View>
          )}
          {item.email && (
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={14} color="#64748b" />
              <Text style={styles.infoText}>{item.email}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search customers..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item.id}
        renderItem={renderCustomer}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>
              {search ? 'No Results' : 'No Customers'}
            </Text>
            <Text style={styles.emptyText}>
              {search
                ? 'Try a different search term'
                : 'Customers will appear here after jobs are created'}
            </Text>
          </View>
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
  searchContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  customerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
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

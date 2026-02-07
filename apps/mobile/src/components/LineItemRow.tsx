// Murray's FSM - Line Item Row Component
// ========================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCents } from '../utils/format';
import type { LineItem } from '../types';

interface LineItemRowProps {
  item: LineItem;
  onEdit?: () => void;
  onDelete?: () => void;
  editable?: boolean;
}

export const LineItemRow: React.FC<LineItemRowProps> = ({
  item,
  onEdit,
  onDelete,
  editable = false,
}) => {
  return (
    <View style={styles.row}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.total}>{formatCents(item.total_cents)}</Text>
        </View>
        {item.description && (
          <Text style={styles.description}>{item.description}</Text>
        )}
        <Text style={styles.details}>
          {item.qty} x {formatCents(item.unit_price_cents)}
        </Text>
      </View>

      {editable && (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
              <Ionicons name="pencil" size={18} color="#64748b" />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
              <Ionicons name="trash" size={18} color="#dc2626" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
    flex: 1,
  },
  total: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  details: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
  },
});

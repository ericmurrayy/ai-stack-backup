// Murray's FSM - Input Component
// ================================

import React, { forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, containerStyle, style, ...props }, ref) => {
    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            error && styles.inputError,
            props.multiline && styles.multiline,
            style,
          ]}
          placeholderTextColor="#94a3b8"
          {...props}
        />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
  },
});

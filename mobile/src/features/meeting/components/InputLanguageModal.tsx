/**
 * InputLanguageModal
 *
 * Popup chọn ngôn ngữ input — CHỈ hiện trên máy tier 'low' (không đủ sức chạy
 * language gate dual-decode). Máy strong đi thẳng vào gate, không thấy modal.
 *
 * @see Task 8 of the language-gate feature
 */

import React, {useState, useEffect} from 'react';
import {Modal, Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../../../shared/hooks/useTheme';
import type {InputLanguageMode} from '../../../shared/store/settingsStore';

interface Props {
  visible: boolean;
  initialChoice: InputLanguageMode;
  onConfirm: (choice: InputLanguageMode) => void;
  onCancel: () => void;
}

export function InputLanguageModal({visible, initialChoice, onConfirm, onCancel}: Props): React.JSX.Element {
  const {t} = useTranslation('meeting');
  const {theme} = useTheme();
  const [choice, setChoice] = useState<InputLanguageMode>(initialChoice);

  // Sync lại lựa chọn ghi nhớ mỗi lần mở modal.
  useEffect(() => {
    if (visible) setChoice(initialChoice);
  }, [visible, initialChoice]);

  const options: Array<{mode: InputLanguageMode; label: string; flag: string}> = [
    {mode: 'auto', label: t('inputLangModalAuto'), flag: '🌐'},
    {mode: 'vi', label: t('inputLangModalVi'), flag: '🇻🇳'},
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
          <Text style={[styles.title, {color: theme.colors.text.primary}]}>
            {t('inputLangModalTitle')}
          </Text>
          {options.map((opt) => {
            const active = choice === opt.mode;
            return (
              <TouchableOpacity
                key={opt.mode}
                style={[
                  styles.option,
                  active
                    ? {backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary}
                    : {backgroundColor: theme.colors.surface.secondary, borderColor: theme.colors.border.subtle},
                ]}
                onPress={() => setChoice(opt.mode)}
                activeOpacity={0.75}>
                <Text style={styles.optionFlag}>{opt.flag}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    {color: active ? theme.colors.primary : theme.colors.text.primary},
                  ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={onCancel} activeOpacity={0.75}>
              <Text style={[styles.actionText, {color: theme.colors.text.secondary}]}>
                {t('inputLangModalCancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={() => onConfirm(choice)}
              activeOpacity={0.85}>
              <Text style={[styles.actionText, styles.actionPrimaryText]}>
                {t('inputLangModalStart')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24},
  card: {borderRadius: 16, padding: 20},
  title: {fontSize: 17, fontWeight: '600', marginBottom: 16},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  optionFlag: {fontSize: 20, marginRight: 12},
  optionLabel: {fontSize: 15, fontWeight: '500'},
  actions: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 12},
  actionBtn: {paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10},
  actionPrimary: {backgroundColor: '#6C5CE7'},
  actionText: {fontSize: 15, fontWeight: '600'},
  actionPrimaryText: {color: '#FFFFFF'},
});

/**
 * MeetingStartModal
 *
 * Popup duy nhất khi bấm "Bắt đầu cuộc họp":
 * - Phần "Dịch sang" (5 ngôn ngữ đích) hiện cho MỌI máy — thay cho chip chọn
 *   target ở màn hình record (đã bỏ theo yêu cầu UX 18/08).
 * - Phần ngôn ngữ đầu vào (Auto/Vi) chỉ hiện thêm trên máy tier 'low'
 *   (không đủ sức chạy language gate dual-decode); máy strong dùng gate tự
 *   nhận diện nên không cần hỏi input.
 * Lựa chọn cuối luôn được lưu làm mặc định (hiển thị lại trong Settings).
 */

import React, {useState, useEffect, useRef} from 'react';
import {Modal, ScrollView, Text, TouchableOpacity, View, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../../../shared/hooks/useTheme';
import {getLanguageFlag, UNKNOWN_LANGUAGE_FLAG} from '../../../shared/utils/languageFlag';
import {
  TARGET_LANGUAGE_OPTIONS,
  type InputLanguageMode,
  type SupportedTargetLanguage,
} from '../../../shared/store/settingsStore';

export interface MeetingStartSelection {
  input: InputLanguageMode;
  target: SupportedTargetLanguage;
}

interface Props {
  visible: boolean;
  /** true trên máy tier 'low' — hiện thêm phần chọn ngôn ngữ đầu vào. */
  showInputSection: boolean;
  initialInput: InputLanguageMode;
  initialTarget: SupportedTargetLanguage;
  onConfirm: (selection: MeetingStartSelection) => void;
  onCancel: () => void;
}

export function MeetingStartModal({
  visible,
  showInputSection,
  initialInput,
  initialTarget,
  onConfirm,
  onCancel,
}: Props): React.JSX.Element {
  const {t} = useTranslation('meeting');
  const {theme} = useTheme();
  const [input, setInput] = useState<InputLanguageMode>(initialInput);
  const [target, setTarget] = useState<SupportedTargetLanguage>(initialTarget);
  const prevVisibleRef = useRef(visible);

  // Sync lại lựa chọn ghi nhớ CHỈ ở thời điểm mở modal (transition false→true),
  // để initial* đổi giữa chừng lúc modal đang mở không xoá lựa chọn dở dang.
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setInput(initialInput);
      setTarget(initialTarget);
    }
    prevVisibleRef.current = visible;
  }, [visible, initialInput, initialTarget]);

  const inputOptions: Array<{mode: InputLanguageMode; label: string; flag: string}> = [
    {mode: 'auto', label: t('inputLangModalAuto'), flag: UNKNOWN_LANGUAGE_FLAG},
    {mode: 'vi', label: t('inputLangModalVi'), flag: getLanguageFlag('vi')},
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, {backgroundColor: theme.colors.surface.primary}]}>
          <ScrollView bounces={false}>
            {/* Dịch sang — cho mọi máy */}
            <Text style={[styles.sectionTitle, {color: theme.colors.text.primary}]}>
              {t('langSelectTarget')}
            </Text>
            {TARGET_LANGUAGE_OPTIONS.map((opt) => {
              const active = target === opt.code;
              return (
                <TouchableOpacity
                  key={opt.code}
                  style={[
                    styles.option,
                    active
                      ? {backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary}
                      : {backgroundColor: theme.colors.surface.secondary, borderColor: theme.colors.border.subtle},
                  ]}
                  onPress={() => setTarget(opt.code)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{selected: active}}
                  accessibilityLabel={opt.label}>
                  <Text style={styles.optionFlag}>{getLanguageFlag(opt.code)}</Text>
                  <View style={styles.optionInfo}>
                    <Text
                      style={[
                        styles.optionLabel,
                        {color: active ? theme.colors.primary : theme.colors.text.primary},
                      ]}>
                      {opt.nativeLabel}
                    </Text>
                    <Text style={[styles.optionSub, {color: theme.colors.text.tertiary}]}>
                      {opt.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Ngôn ngữ đầu vào — chỉ máy yếu */}
            {showInputSection && (
              <>
                <Text
                  style={[styles.sectionTitle, styles.sectionTitleSpaced, {color: theme.colors.text.primary}]}>
                  {t('inputLangModalTitle')}
                </Text>
                {inputOptions.map((opt) => {
                  const active = input === opt.mode;
                  return (
                    <TouchableOpacity
                      key={opt.mode}
                      style={[
                        styles.option,
                        active
                          ? {backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary}
                          : {backgroundColor: theme.colors.surface.secondary, borderColor: theme.colors.border.subtle},
                      ]}
                      onPress={() => setInput(opt.mode)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityState={{selected: active}}
                      accessibilityLabel={opt.label}>
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
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onCancel}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t('inputLangModalCancel')}>
              <Text style={[styles.actionText, {color: theme.colors.text.secondary}]}>
                {t('inputLangModalCancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={() => onConfirm({input, target})}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('inputLangModalStart')}>
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
  card: {borderRadius: 16, padding: 20, maxHeight: '85%'},
  sectionTitle: {fontSize: 17, fontWeight: '600', marginBottom: 16},
  sectionTitleSpaced: {marginTop: 10},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  optionFlag: {fontSize: 20, marginRight: 12},
  optionInfo: {flex: 1},
  optionLabel: {fontSize: 15, fontWeight: '500'},
  optionSub: {fontSize: 12, marginTop: 1},
  actions: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 12},
  actionBtn: {paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10},
  actionPrimary: {backgroundColor: '#6C5CE7'},
  actionText: {fontSize: 15, fontWeight: '600'},
  actionPrimaryText: {color: '#FFFFFF'},
});

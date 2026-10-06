import { useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { videoAtNumber, type VideoItem } from '@/lib/feed';

type Props = { videos: VideoItem[]; index: number; onClose: () => void; onJump: (video: VideoItem) => void };

export function JumpToVideo(props: Props) {
  const insets = useSafeAreaInsets();
  const [number, setNumber] = useState(String(props.index + 1));
  const input = useRef<TextInput>(null);
  const submitted = useRef(false);
  const target = videoAtNumber(props.videos, number);
  const invalid = number.length > 0 && !target;
  const close = () => { Keyboard.dismiss(); props.onClose(); };
  const jump = () => {
    if (!target || submitted.current) return;
    submitted.current = true;
    Keyboard.dismiss();
    props.onJump(target);
  };

  return <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent
    onShow={() => input.current?.focus()} onRequestClose={close}>
    <View style={[styles.overlay, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Закрыть переход к видео" onPress={close} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.panel} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">Перейти к видео</Text>
          <Text style={styles.description}>Введи номер от 1 до {props.videos.length.toLocaleString('ru-RU')} в текущей ленте.</Text>
          <TextInput ref={input} value={number} onChangeText={setNumber} selectTextOnFocus
            accessibilityLabel="Номер видео" accessibilityHint={`От 1 до ${props.videos.length}`}
            inputMode="numeric" keyboardType="number-pad" returnKeyType="go" submitBehavior="submit"
            onSubmitEditing={jump} autoCorrect={false} maxLength={16} selectionColor="#B9CCFF"
            underlineColorAndroid="transparent" style={[styles.input, invalid && styles.invalidInput]} />
          {invalid && <Text style={styles.error} accessibilityLiveRegion="polite">Нужно целое число от 1 до {props.videos.length.toLocaleString('ru-RU')}.</Text>}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={close} style={({ pressed }) => [styles.button, pressed && styles.dim]}><Text style={styles.cancelText}>Отмена</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !target }} disabled={!target} onPress={jump}
              style={({ pressed }) => [styles.button, styles.confirm, (pressed || !target) && styles.dim]}><Text style={styles.confirmText}>Перейти</Text></Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.7)' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center' },
  panel: { width: '100%', maxWidth: 380, alignSelf: 'center', borderRadius: 22, backgroundColor: '#101520', padding: 24, borderWidth: 1, borderColor: '#283247' },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  description: { color: '#BCC5D7', fontSize: 14, lineHeight: 21, marginTop: 12 },
  input: { minHeight: 60, marginTop: 24, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#B9CCFF', color: '#FFFFFF', backgroundColor: '#000000', fontSize: 26, fontVariant: ['tabular-nums'] },
  invalidInput: { borderColor: '#FFB4AB' },
  error: { color: '#FFB4AB', fontSize: 13, lineHeight: 20, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  cancelText: { color: '#BCC5D7', fontSize: 15 },
  confirm: { backgroundColor: '#B9CCFF' },
  confirmText: { color: '#17233D', fontSize: 15, fontWeight: '600' },
  dim: { opacity: 0.5 },
});

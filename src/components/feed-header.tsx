import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedIcon } from '@/components/feed-icon';

type Props = { index: number; count: number; favorites: boolean; limited: boolean; changed: boolean; disabled: boolean; onJump: () => void; onFilter: () => void; onRefresh: () => void };

export function FeedHeader(props: Props) {
  const insets = useSafeAreaInsets();
  // Absorb touches in the title/empty space; only the three explicit buttons act.
  return <View collapsable={false} onStartShouldSetResponder={() => true} style={[styles.safeHeader, { paddingTop: insets.top }]}>
    <View style={styles.header}>
      <View style={styles.brandBlock} pointerEvents="none">
        <Text style={styles.brand} selectable={false} numberOfLines={1}>Свои</Text>
        <Text style={styles.subtitle} selectable={false} numberOfLines={1}>{props.favorites ? 'Отмеченные' : props.limited ? 'Выбранные видео' : 'Все видео'}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Видео ${props.count ? props.index + 1 : 0} из ${props.count}. Перейти к видео по номеру`}
        accessibilityHint="Открывает ввод номера видео" accessibilityState={{ disabled: props.disabled || props.count === 0 }}
        disabled={props.disabled || props.count === 0} onPress={props.onJump}
        pressRetentionOffset={{ top: 0, bottom: 0, left: 0, right: 0 }}
        style={({ pressed }) => [styles.counterButton, (pressed || props.disabled || props.count === 0) && styles.dim]}>
        <Text style={styles.counter}>{props.count ? props.index + 1 : 0} из {props.count.toLocaleString('ru-RU')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Фильтр и порядок видео" disabled={props.disabled} onPress={props.onFilter} style={({ pressed }) => [styles.button, (pressed || props.disabled) && styles.dim]}>
        <FeedIcon name="filter" color={props.favorites ? '#B9CCFF' : '#FFFFFF'} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Обновить видео" disabled={props.disabled} onPress={props.onRefresh} style={({ pressed }) => [styles.button, (pressed || props.disabled) && styles.dim]}>
        <FeedIcon name="refresh" />{props.changed && <View style={styles.dot} />}
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  safeHeader: { backgroundColor: '#000000', zIndex: 2, borderBottomColor: '#20242C', borderBottomWidth: StyleSheet.hairlineWidth },
  header: { height: 68, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 6 },
  brandBlock: { flex: 1, minWidth: 0 },
  brand: { color: '#FFFFFF', fontSize: 25, lineHeight: 29, fontWeight: '700', letterSpacing: -0.9 },
  subtitle: { color: '#A3AEC3', fontSize: 11, marginTop: 2 },
  counterButton: { minHeight: 48, minWidth: 64, paddingHorizontal: 10, marginLeft: 8, borderRadius: 12, backgroundColor: '#101520', alignItems: 'center', justifyContent: 'center' },
  counter: { color: '#B9CCFF', fontSize: 12, fontVariant: ['tabular-nums'] },
  button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.5 },
  dot: { position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: '#B9CCFF', right: 9, top: 8 },
});

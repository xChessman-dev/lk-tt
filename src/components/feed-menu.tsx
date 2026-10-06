import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedIcon, type IconName } from '@/components/feed-icon';
import type { FeedSettings } from '@/lib/feed';

type Props = { visible: boolean; onClose: () => void; settings: FeedSettings; onChange: (patch: Partial<FeedSettings>) => void; count: number; favoriteCount: number; limited: boolean; storageWarning: boolean };

function Choice({ icon, title, detail, selected, onPress }: { icon: IconName; title: string; detail?: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.dim]}>
    <FeedIcon name={icon} color={selected ? '#B9CCFF' : '#BCC5D7'} filled={icon === 'bookmark' && selected} />
    <Text style={[styles.rowTitle, selected && styles.selected]}>{title}</Text>
    {detail && <Text style={styles.detail}>{detail}</Text>}
    {selected && <FeedIcon name="check" color="#B9CCFF" size={20} />}
  </Pressable>;
}

export function FeedMenu(props: Props) {
  const insets = useSafeAreaInsets();
  return <Modal visible={props.visible} animationType="fade" transparent statusBarTranslucent onRequestClose={props.onClose}>
    <View style={[styles.modal, { paddingTop: insets.top + 68, paddingBottom: insets.bottom + 16 }]}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Закрыть фильтр" onPress={props.onClose} />
      <View style={styles.panel} accessibilityViewIsModal>
        <View style={styles.heading}><Text style={styles.title}>Фильтр</Text><Pressable accessibilityRole="button" accessibilityLabel="Закрыть фильтр" onPress={props.onClose} style={styles.close}><FeedIcon name="close" size={22} /></Pressable></View>
        <ScrollView>
          <Text style={styles.label}>Показывать</Text>
          <Choice icon="video" title="Все видео" detail={String(props.count)} selected={props.settings.scope === 'all'} onPress={() => props.onChange({ scope: 'all' })} />
          <Choice icon="bookmark" title="Отмеченные" detail={String(props.favoriteCount)} selected={props.settings.scope === 'favorites'} onPress={() => props.onChange({ scope: 'favorites' })} />
          <View style={styles.divider} />
          <Text style={styles.label}>Порядок просмотра</Text>
          <Choice icon="arrow" title="Сначала новые" selected={props.settings.order === 'newest'} onPress={() => props.onChange({ order: 'newest' })} />
          <Choice icon="shuffle" title="Вперемешку" selected={props.settings.order === 'random'} onPress={() => props.onChange({ order: 'random' })} />
          {props.settings.order === 'random' && <Pressable accessibilityRole="button" onPress={() => props.onChange({ seed: Math.floor(Math.random() * 2147483647), currentId: null })} style={styles.reshuffle}><Text style={styles.selected}>Перемешать заново</Text></Pressable>}
          {props.limited && <View style={styles.notice}><Text style={styles.note}>Android разрешил доступ только к выбранным видео.</Text><Pressable accessibilityRole="button" onPress={() => { props.onClose(); void Linking.openSettings().catch(() => {}); }} style={styles.reshuffle}><Text style={styles.selected}>Настройки доступа</Text></Pressable></View>}
          {props.storageWarning && <Text style={styles.warning}>Не удалось сохранить настройки и отметки. Проверь свободное место на телефоне.</Text>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, alignItems: 'flex-end' },
  panel: { width: '100%', maxWidth: 380, maxHeight: '100%', borderRadius: 22, backgroundColor: '#101520', padding: 20, borderWidth: 1, borderColor: '#283247' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 22, color: '#FFFFFF', fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#8390A8', fontSize: 12, marginBottom: 4 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { color: '#FFFFFF', fontSize: 15, flex: 1 },
  detail: { color: '#8390A8', fontSize: 12, marginRight: 4 },
  selected: { color: '#B9CCFF' },
  dim: { opacity: 0.6 },
  divider: { height: 1, backgroundColor: '#283247', marginVertical: 16 },
  reshuffle: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  notice: { marginTop: 12 },
  note: { color: '#BCC5D7', fontSize: 13, lineHeight: 20 },
  warning: { color: '#FFB4AB', fontSize: 13, lineHeight: 20, marginTop: 12 },
});

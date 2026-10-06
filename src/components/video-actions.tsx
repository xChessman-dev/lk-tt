import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { FeedIcon, type IconName } from '@/components/feed-icon';

function Action({ icon, label, active, onPress, disabled, busy }: {
  icon: IconName; label: string; active?: boolean; onPress: () => void; disabled?: boolean; busy?: boolean;
}) {
  return <Pressable accessibilityRole={active === undefined ? 'button' : 'switch'} accessibilityLabel={label}
    accessibilityState={active === undefined ? { disabled, busy } : { checked: active, disabled }}
    onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, active && styles.active, (pressed || disabled) && styles.dim]}>
    {busy ? <ActivityIndicator color="#B9CCFF" /> : <FeedIcon name={icon} size={25} color={active ? '#B9CCFF' : '#FFFFFF'} filled={icon === 'bookmark' && active} />}
    {active && <View style={styles.dot} />}
  </Pressable>;
}

type Props = { bookmarked: boolean; muted: boolean; repeat: boolean; autoAdvance: boolean; sharing: boolean; onBookmark: () => void; onMute: () => void; onRepeat: () => void; onAutoAdvance: () => void; onShare: () => void };

export function VideoActions(props: Props) {
  return <View style={styles.rail}>
    <Action icon="bookmark" label="Отметить видео" active={props.bookmarked} onPress={props.onBookmark} disabled={props.sharing} />
    <Action icon={props.muted ? 'muted' : 'sound'} label="Звук выключен" active={props.muted} onPress={props.onMute} disabled={props.sharing} />
    <Action icon="repeat" label="Повтор видео" active={props.repeat} onPress={props.onRepeat} disabled={props.sharing} />
    <Action icon="auto" label="Автолистание после окончания" active={props.autoAdvance} onPress={props.onAutoAdvance} disabled={props.sharing} />
    <Action icon="share" label="Поделиться видео" onPress={props.onShare} disabled={props.sharing} busy={props.sharing} />
  </View>;
}

const styles = StyleSheet.create({
  rail: { position: 'absolute', right: 12, top: '50%', transform: [{ translateY: -136 }], gap: 8 },
  button: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.44)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  active: { borderColor: 'rgba(185,204,255,0.58)', backgroundColor: 'rgba(23,35,61,0.85)' },
  dim: { opacity: 0.55 },
  dot: { position: 'absolute', bottom: 4, width: 3, height: 3, borderRadius: 2, backgroundColor: '#B9CCFF' },
});

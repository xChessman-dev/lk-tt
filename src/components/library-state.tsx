import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedIcon } from '@/components/feed-icon';

type Props = {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: string;
  onSecondary?: () => void;
};

export function LibraryState(props: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}>
      <View style={styles.brand}><FeedIcon name="video" size={30} color="#B9CCFF" /><Text style={styles.brandText}>Свои видео</Text></View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.main} showsVerticalScrollIndicator={false}>
        <View style={styles.frames} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.backFrame} />
          <View style={styles.frontFrame}><FeedIcon name="play" size={52} color="#B9CCFF" /></View>
        </View>
        <Text style={styles.title} accessibilityRole="header">{props.title}</Text>
        <Text style={styles.description}>{props.description}</Text>
        {props.loading && <ActivityIndicator style={styles.spinner} color="#B9CCFF" size="large" />}
        {props.action && <Pressable accessibilityRole="button" disabled={props.disabled} onPress={props.onAction} style={({ pressed }) => [styles.button, (pressed || props.disabled) && styles.pressed]}><Text style={styles.buttonText}>{props.disabled ? 'Подождите…' : props.action}</Text></Pressable>}
        {props.secondary && <Pressable accessibilityRole="button" onPress={props.onSecondary} style={styles.secondary}><Text style={styles.secondaryText}>{props.secondary}</Text></Pressable>}
      </ScrollView>
      <Text style={styles.footer}>Твоя галерея. Твой ритм.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000', paddingHorizontal: 28 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  scroll: { flex: 1 },
  main: { flexGrow: 1, justifyContent: 'center', maxWidth: 440, width: '100%', alignSelf: 'center', paddingVertical: 28 },
  frames: { height: 174, marginBottom: 34 },
  backFrame: { position: 'absolute', width: 103, height: 146, borderRadius: 22, borderWidth: 1, borderColor: '#536381', transform: [{ rotate: '-12deg' }], left: 8, top: 2 },
  frontFrame: { width: 108, height: 150, borderRadius: 23, backgroundColor: '#17233D', alignItems: 'center', justifyContent: 'center', left: 40, top: 16, transform: [{ rotate: '7deg' }] },
  title: { color: '#FFFFFF', fontSize: 34, lineHeight: 39, fontWeight: '700', letterSpacing: -1, marginBottom: 16 },
  description: { color: '#BCC5D7', fontSize: 16, lineHeight: 25 },
  button: { minHeight: 56, backgroundColor: '#B9CCFF', borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 30 },
  buttonText: { color: '#17233D', fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.65 },
  spinner: { marginTop: 28, alignSelf: 'flex-start' },
  secondary: { padding: 16, alignItems: 'center' },
  secondaryText: { color: '#BCC5D7', fontSize: 14 },
  footer: { color: '#8390A8', fontSize: 13 },
});
